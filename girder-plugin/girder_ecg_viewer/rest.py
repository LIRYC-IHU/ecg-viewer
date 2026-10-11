"""REST endpoints, added to the core ``item`` and ``file`` resources.

- ``GET /item/{id}/ecg`` lists the item's files that can be shown as an ECG.
- ``GET /file/{id}/ecg`` returns a file as DICOM ECG, converted on the fly
  when it is in a vendor format.
"""

from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import boundHandler, setResponseHeader, setRawResponse
from girder.constants import AccessType, TokenScope
from girder.exceptions import RestException
from girder.models.file import File
from girder.models.item import Item

from . import convert
from .formats import FORMATS, HEAD_BYTES, detectFormat, isCandidate

#: Cap on files inspected per item, so a huge item can't fan out reads.
MAX_INSPECTED_FILES = 50


def readHead(file):
    """First bytes of a file, read straight from its assetstore.

    Going through the adapter rather than ``File().download`` keeps this
    inspection out of download statistics and the audit log: nothing leaves
    the server here.
    """
    adapter = File().getAssetstoreAdapter(file)
    endByte = min(file['size'], HEAD_BYTES)
    return b''.join(adapter.downloadFile(file, offset=0, endByte=endByte, headers=False)())


def fileFormat(file):
    """ECG format key of a Girder file, or None."""
    if not isCandidate(file):
        return None
    try:
        head = readHead(file)
    except Exception:
        return None
    return detectFormat(file['name'], head)


@boundHandler
@access.public(scope=TokenScope.DATA_READ)
@autoDescribeRoute(
    Description('List the files of an item that can be displayed as an ECG.')
    .notes('Formats other than DICOM are listed only when their ecg-bridge '
           'converter is installed on the server.')
    .modelParam('id', model=Item, level=AccessType.READ)
    .errorResponse('Read access was denied on the item.', 403)
)
def listItemEcgFiles(self, item):
    result = []
    for file in Item().childFiles(item, limit=MAX_INSPECTED_FILES, sort=[('name', 1)]):
        key = fileFormat(file)
        if key is None or not convert.isSupported(key):
            continue
        result.append({
            '_id': file['_id'],
            'name': file['name'],
            'size': file['size'],
            'format': key,
            'formatLabel': FORMATS[key].label,
            'converted': key != 'dicom',
        })
    return result


@boundHandler
@access.public(scope=TokenScope.DATA_READ, cookie=True)
@autoDescribeRoute(
    Description('Get a file as a DICOM ECG, converting it from its vendor format if needed.')
    .modelParam('id', model=File, level=AccessType.READ)
    .produces('application/dicom')
    .errorResponse('The file is not a supported ECG, or could not be converted.')
    .errorResponse('Read access was denied on the file.', 403)
)
def getFileAsDicomEcg(self, file):
    key = fileFormat(file)
    if key is None:
        raise RestException('This file is not a recognised ECG.')

    if key == 'dicom':
        body = File().download(file, headers=False)
    else:
        try:
            body = convert.toDicom(key, file)
        except convert.ConversionError as exc:
            raise RestException(str(exc)) from None

    setResponseHeader('Content-Type', 'application/dicom')
    setRawResponse()
    return body


def addRoutes(apiRoot):
    apiRoot.item.route('GET', (':id', 'ecg'), listItemEcgFiles)
    apiRoot.file.route('GET', (':id', 'ecg'), getFileAsDicomEcg)

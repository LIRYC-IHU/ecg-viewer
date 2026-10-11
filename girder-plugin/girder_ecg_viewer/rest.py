"""REST endpoints, added to the core ``item`` and ``file`` resources.

- ``GET /item/{id}/ecg`` lists the item's files that can be shown as an ECG.
- ``GET /file/{id}/ecg`` returns a file as DICOM ECG, converted on the fly
  when it is in a vendor format (what the viewer loads).
- ``GET /file/{id}/ecg/download?format=dicom|fda`` downloads a file as DICOM
  or FDA HL7 aECG XML, converted if needed.
"""

from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import (
    boundHandler, setContentDisposition, setResponseHeader, setRawResponse)
from girder.constants import AccessType, TokenScope
from girder.exceptions import RestException
from girder.models.file import File
from girder.models.item import Item

from . import convert
from .formats import FORMATS, HEAD_BYTES, TARGETS, detectFormat, exportName, isCandidate

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


def _ecgFormatOrFail(file):
    key = fileFormat(file)
    if key is None:
        raise RestException('This file is not a recognised ECG.')
    return key


def _converted(file, source, target):
    """Body of a response serving ``file`` in the ``target`` format."""
    if source == target:
        return File().download(file, headers=False)
    try:
        return convert.convert(source, target, file)
    except convert.ConversionError as exc:
        raise RestException(str(exc)) from None


@boundHandler
@access.public(scope=TokenScope.DATA_READ)
@autoDescribeRoute(
    Description('List the files of an item that can be displayed as an ECG.')
    .notes('Formats other than DICOM are listed only when their ecg-bridge '
           'converter to DICOM is installed on the server. `exports` lists the '
           'formats each file can be downloaded as with `GET /file/{id}/ecg/download`.')
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
            'exports': convert.exportTargets(key),
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
    body = _converted(file, _ecgFormatOrFail(file), 'dicom')
    setResponseHeader('Content-Type', 'application/dicom')
    setRawResponse()
    return body


@boundHandler
@access.public(scope=TokenScope.DATA_READ, cookie=True)
@autoDescribeRoute(
    Description('Download an ECG file as DICOM or as FDA HL7 aECG XML.')
    .notes('The file is converted with ecg-bridge unless it already is in the '
           'requested format, in which case it is sent unchanged.')
    .modelParam('id', model=File, level=AccessType.READ)
    .param('format', 'Format to download the ECG as.', enum=list(TARGETS))
    .produces([t.mimeType for t in TARGETS.values()])
    .errorResponse('The file is not a supported ECG, or could not be converted.')
    .errorResponse('Read access was denied on the file.', 403)
)
def downloadEcgAs(self, file, format):
    body = _converted(file, _ecgFormatOrFail(file), format)
    target = TARGETS[format]
    setResponseHeader('Content-Type', target.mimeType)
    setContentDisposition(exportName(file['name'], format))
    setRawResponse()
    return body


def addRoutes(apiRoot):
    apiRoot.item.route('GET', (':id', 'ecg'), listItemEcgFiles)
    apiRoot.file.route('GET', (':id', 'ecg'), getFileAsDicomEcg)
    apiRoot.file.route('GET', (':id', 'ecg', 'download'), downloadEcgAs)

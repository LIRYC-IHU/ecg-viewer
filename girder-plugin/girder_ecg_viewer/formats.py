"""Recognise ECG files from their name and first bytes.

DICOM ECGs are handed to the browser as they are; every other format is
converted to DICOM by the matching ecg-bridge CLI (see ``convert.py``), so the
viewer only ever parses DICOM. Files can also be downloaded as DICOM or as FDA
HL7 aECG XML, whatever their source format.
"""

import dataclasses
import re

#: Bytes read from the head of a file to recognise it.
HEAD_BYTES = 64 * 1024

#: Larger files are not offered: the whole file is converted and parsed.
MAX_ECG_BYTES = 64 * 1024 * 1024


@dataclasses.dataclass(frozen=True)
class ExportTarget:
    key: str
    label: str
    extension: str
    mimeType: str


#: Formats a file can be downloaded as. Each is also a source format (below).
TARGETS = {t.key: t for t in (
    ExportTarget('dicom', 'DICOM', '.dcm', 'application/dicom'),
    ExportTarget('fda', 'FDA HL7 aECG (XML)', '.xml', 'application/xml'),
)}


@dataclasses.dataclass(frozen=True)
class EcgFormat:
    key: str
    label: str
    #: Extension the ecg-bridge CLIs expect on an input file of this format.
    inputExtension: str
    #: ecg-bridge CLI converting this format to each target format.
    converters: dict = dataclasses.field(default_factory=dict)


FORMATS = {f.key: f for f in (
    EcgFormat('dicom', 'DICOM ECG', '.dcm', {'fda': 'dicom-to-fda'}),
    EcgFormat('fda', 'FDA HL7 aECG', '.xml', {'dicom': 'fda-to-dicom'}),
    EcgFormat('philips', 'Philips SierraECG', '.xml',
              {'dicom': 'philips-to-dicom', 'fda': 'philips-to-fda'}),
    EcgFormat('muse', 'GE MUSE', '.xml', {'dicom': 'muse-to-dicom', 'fda': 'muse-to-fda'}),
    EcgFormat('nk', 'Nihon Kohden', '.dat', {'dicom': 'nk-to-dicom', 'fda': 'nk-to-fda'}),
    EcgFormat('fukuda', 'Fukuda Denshi', '.ecg',
              {'dicom': 'fukuda-to-dicom', 'fda': 'fukuda-to-fda'}),
    EcgFormat('mindray', 'Mindray BeneHeart', '.pat',
              {'dicom': 'mindray-to-dicom', 'fda': 'mindray-to-fda'}),
)}

# 12-lead, General and Ambulatory ECG waveform storage. The UID must stand on
# its own: a longer UID that merely contains one of these is something else.
_DICOM_ECG_UID = re.compile(rb'(?<![\d.])1\.2\.840\.10008\.5\.1\.4\.1\.1\.9\.1\.[123](?![\d.])')

_MINDRAY_MAGIC = b'\xeb\xec\x12\x34\x20'

_XML_ROOTS = {
    'AnnotatedECG': 'fda',
    'restingecgdata': 'philips',
    'RestingECG': 'muse',
}

#: Extensions worth reading the head of. Anything else (images, PDFs, …) is
#: skipped without touching the assetstore.
_CANDIDATE_EXTENSIONS = {'dcm', 'dicom', 'dic', 'xml', 'dat', 'ecg', 'pat'}


def isCandidate(file):
    """Whether a Girder file document could plausibly hold an ECG."""
    if file.get('linkUrl') or file.get('assetstoreId') is None:
        return False
    if not file.get('size') or file['size'] > MAX_ECG_BYTES:
        return False
    mimeType = (file.get('mimeType') or '').lower()
    if 'dicom' in mimeType or mimeType.endswith('/xml'):
        return True
    name = file.get('name', '').lower()
    dot = name.rfind('.')
    if dot <= 0:
        # DICOM and Mindray files often come without extension.
        return True
    ext = name[dot + 1:]
    # UID-named DICOM files (1.2.840.…) end in digits.
    return ext.isdigit() or ext in _CANDIDATE_EXTENSIONS


def _xmlRoot(head):
    """Local name of the root element of an XML document, or None."""
    if head.startswith((b'\xff\xfe', b'\xfe\xff')):
        text = head.decode('utf-16', errors='ignore')
    else:
        text = head.decode('utf-8', errors='ignore')
    text = text.lstrip('﻿ \t\r\n')
    if not text.startswith('<'):
        return None
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    match = re.search(r'<(?![?!/])([^\s>/]+)', text)
    if not match:
        return None
    return match.group(1).rpartition(':')[2]


def exportName(name, target):
    """Download name of a file converted to a target format.

    A recognised ECG extension is replaced (``ecg.DAT`` → ``ecg.xml``); any
    other name only gets the new one appended, so that UID-style names
    (``1.2.840.….3``) keep their last component.
    """
    stem, dot, ext = name.rpartition('.')
    if dot and stem and ext.lower() in _CANDIDATE_EXTENSIONS:
        name = stem
    return name + TARGETS[target].extension


def detectFormat(name, head):
    """Return the key of the ECG format of a file, or None if it isn't one."""
    if _DICOM_ECG_UID.search(head):
        return 'dicom'
    if head[128:132] == b'DICM':
        # Some other DICOM object (an image, a report, …).
        return None
    if head.startswith(_MINDRAY_MAGIC):
        return 'mindray'
    root = _xmlRoot(head)
    if root is not None:
        return _XML_ROOTS.get(root)
    # The vendor binary formats below have no reliable magic in their first
    # bytes; the extension decides and a failed conversion reports otherwise.
    ext = name.lower().rpartition('.')[2]
    if ext == 'dat':
        return 'nk'
    if ext == 'ecg':
        return 'fukuda'
    return None

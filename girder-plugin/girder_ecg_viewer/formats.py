"""Recognise ECG files from their name and first bytes.

DICOM ECGs are handed to the browser as they are; every other format is
converted to DICOM by the matching ecg-bridge CLI (see ``convert.py``), so the
viewer only ever parses DICOM.
"""

import dataclasses
import re

#: Bytes read from the head of a file to recognise it.
HEAD_BYTES = 64 * 1024

#: Larger files are not offered: the whole file is converted and parsed.
MAX_ECG_BYTES = 64 * 1024 * 1024


@dataclasses.dataclass(frozen=True)
class EcgFormat:
    key: str
    label: str
    #: ecg-bridge CLI converting this format to DICOM; None for DICOM itself.
    converter: str | None = None
    #: Extension the converter expects on its input file.
    inputExtension: str = ''


FORMATS = {f.key: f for f in (
    EcgFormat('dicom', 'DICOM ECG'),
    EcgFormat('fda', 'FDA HL7 aECG', 'fda-to-dicom', '.xml'),
    EcgFormat('philips', 'Philips SierraECG', 'philips-to-dicom', '.xml'),
    EcgFormat('muse', 'GE MUSE', 'muse-to-dicom', '.xml'),
    EcgFormat('nk', 'Nihon Kohden', 'nk-to-dicom', '.dat'),
    EcgFormat('fukuda', 'Fukuda Denshi', 'fukuda-to-dicom', '.ecg'),
    EcgFormat('mindray', 'Mindray BeneHeart', 'mindray-to-dicom', '.pat'),
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

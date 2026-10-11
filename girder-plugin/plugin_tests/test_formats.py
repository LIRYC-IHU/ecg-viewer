"""Format recognition, from file names and first bytes only."""

import pathlib

import pytest

from girder_ecg_viewer.formats import HEAD_BYTES, detectFormat, exportName, isCandidate

REPO = pathlib.Path(__file__).resolve().parents[2]
DATA = pathlib.Path(__file__).resolve().parent / 'data'


def head(path):
    return path.read_bytes()[:HEAD_BYTES]


@pytest.mark.parametrize('sample', sorted((REPO / 'server' / 'samples').glob('*.dcm')),
                         ids=lambda p: p.name)
def test_bundled_dicom_samples(sample):
    assert detectFormat(sample.name, head(sample)) == 'dicom'


def test_fda_aecg_fixture():
    assert detectFormat('ecg.xml', head(DATA / 'aecg.xml')) == 'fda'


@pytest.mark.parametrize('content, expected', [
    (b'<?xml version="1.0"?>\n<!-- x --><AnnotatedECG xmlns="urn:hl7-org:v3">', 'fda'),
    (b'\xef\xbb\xbf<?xml version="1.0"?><restingecgdata xmlns="http://www3.medical.philips.com">',
     'philips'),
    (b'<?xml version="1.0" encoding="ISO-8859-1"?>\r\n'
     b'<!DOCTYPE RestingECG SYSTEM "restecg.dtd">\r\n<RestingECG>', 'muse'),
    ('<?xml version="1.0" encoding="UTF-16"?><RestingECG>'.encode('utf-16'), 'muse'),
    (b'<ns0:AnnotatedECG xmlns:ns0="urn:hl7-org:v3">', 'fda'),
    (b'<?xml version="1.0"?><svg/>', None),
])
def test_xml_roots(content, expected):
    assert detectFormat('ecg.xml', content) == expected


def test_mindray_magic_any_name():
    assert detectFormat('12lead_data_v1', b'\xeb\xec\x12\x34\x20rest') == 'mindray'


def test_binary_vendor_formats_by_extension():
    assert detectFormat('00000005.DAT', b'\x00\x01binary') == 'nk'
    assert detectFormat('PATIENT.ECG', b'\x00\x01binary') == 'fukuda'
    assert detectFormat('blob.bin', b'\x00\x01binary') is None


def test_dicom_uid_must_stand_alone():
    assert detectFormat('x', b'\x001.2.840.10008.5.1.4.1.1.9.1.1\x00') == 'dicom'
    assert detectFormat('x', b'\x001.2.840.10008.5.1.4.1.1.9.1.3 ') == 'dicom'
    assert detectFormat('x', b'\x001.2.840.10008.5.1.4.1.1.9.1.10\x00') is None
    assert detectFormat('x', b'\x002.1.2.840.10008.5.1.4.1.1.9.1.1\x00') is None


def test_non_ecg_dicom_is_not_taken_for_a_vendor_file():
    ct = b'\x00' * 128 + b'DICM' + b'\x001.2.840.10008.5.1.4.1.1.2\x00'
    assert detectFormat('scan.dat', ct) is None


def test_candidates():
    def f(name, **extra):
        return {'name': name, 'size': 1000, 'assetstoreId': 'a', **extra}

    for name in ('ecg.dcm', 'IM0001', '1.2.840.113619.2.55.3', 'ecg.xml', 'x.DAT',
                 'x.ECG', 'x.pat'):
        assert isCandidate(f(name)), name
    assert isCandidate(f('blob.bin', mimeType='application/dicom'))
    assert not isCandidate(f('report.pdf'))
    assert not isCandidate(f('photo.jpg'))
    assert not isCandidate(f('ecg.dcm', size=0))
    assert not isCandidate(f('ecg.dcm', size=10**9))
    assert not isCandidate({'name': 'ecg.dcm', 'size': 1000, 'linkUrl': 'http://x'})


@pytest.mark.parametrize('name, target, expected', [
    ('ecg.dcm', 'fda', 'ecg.xml'),
    ('ecg.xml', 'dicom', 'ecg.dcm'),
    ('00000005.DAT', 'fda', '00000005.xml'),
    ('ecg.dcm', 'dicom', 'ecg.dcm'),
    ('IM0001', 'dicom', 'IM0001.dcm'),
    ('1.2.840.113619.2.55.3', 'fda', '1.2.840.113619.2.55.3.xml'),
    ('12lead_data_v1', 'fda', '12lead_data_v1.xml'),
])
def test_export_names(name, target, expected):
    assert exportName(name, target) == expected

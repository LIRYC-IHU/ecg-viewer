"""The plugin loads, publishes its web client and serves ECGs as DICOM."""

import io
import os
import pathlib

import pytest
from pytest_girder.assertions import assertStatus, assertStatusOk
from pytest_girder.utils import getResponseBody

from girder_ecg_viewer import convert

REPO = pathlib.Path(__file__).resolve().parents[2]
DATA = pathlib.Path(__file__).resolve().parent / 'data'
DICOM_SAMPLE = REPO / 'server' / 'samples' / '1.dcm'

# CI installs the ecg-bridge converters and sets this, so a missing converter
# fails the run instead of silently skipping the conversion tests.
requiresConverter = pytest.mark.skipif(
    not (convert.converterPath('fda', 'dicom') and convert.converterPath('dicom', 'fda'))
    and not os.environ.get('ECG_VIEWER_REQUIRE_CONVERTERS'),
    reason='ecg-bridge fda-to-dicom / dicom-to-fda not installed')


def test_plugin_registered():
    from girder.plugin import getPlugin

    plugin = getPlugin('ecg_viewer')
    assert plugin is not None
    assert plugin.name == 'ecg_viewer'
    assert plugin.displayName == 'ECG Viewer'


@pytest.mark.plugin('ecg_viewer')
def test_web_client_registered(server):
    from girder.plugin import getPluginStaticContent

    content = getPluginStaticContent()['ecg_viewer']
    assert [url.split('?')[0] for url in content.js] == [
        'plugin_static/ecg_viewer/girder-plugin-ecg-viewer.umd.cjs']
    assert [url.split('?')[0] for url in content.css] == [
        'plugin_static/ecg_viewer/style.css']


@pytest.fixture
def ecgItem(server, admin, fsAssetstore):
    from girder.models.folder import Folder
    from girder.models.item import Item
    from girder.models.upload import Upload

    folder = Folder().findOne({'parentId': admin['_id'], 'name': 'Private'})
    item = Item().createItem('ECGs', admin, folder)
    files = {}
    for name, content in (
        ('rest.dcm', DICOM_SAMPLE.read_bytes()),
        ('aecg.xml', (DATA / 'aecg.xml').read_bytes()),
        ('notes.txt', b'not an ECG'),
        ('other.xml', b'<?xml version="1.0"?><svg/>'),
    ):
        files[name] = Upload().uploadFromFile(
            io.BytesIO(content), len(content), name, 'item', item, admin)
    return item, files


def _listed(server, item, user):
    resp = server.request(f'/item/{item["_id"]}/ecg', user=user)
    assertStatusOk(resp)
    return {f['name']: f for f in resp.json}


@pytest.mark.plugin('ecg_viewer')
def test_list_without_converters(server, admin, ecgItem, monkeypatch):
    monkeypatch.setattr(convert, 'converterPath', lambda source, target: None)
    item, files = ecgItem
    listed = _listed(server, item, admin)
    assert list(listed) == ['rest.dcm']
    assert listed['rest.dcm']['format'] == 'dicom'
    assert listed['rest.dcm']['converted'] is False
    # Without dicom-to-fda, a DICOM can still be downloaded as itself.
    assert listed['rest.dcm']['exports'] == ['dicom']


@pytest.mark.plugin('ecg_viewer')
def test_dicom_is_served_unchanged(server, admin, ecgItem):
    item, files = ecgItem
    resp = server.request(f'/file/{files["rest.dcm"]["_id"]}/ecg', user=admin, isJson=False)
    assertStatusOk(resp)
    assert resp.headers['Content-Type'] == 'application/dicom'
    assert getResponseBody(resp, text=False) == DICOM_SAMPLE.read_bytes()


@pytest.mark.plugin('ecg_viewer')
def test_non_ecg_file_is_refused(server, admin, ecgItem):
    item, files = ecgItem
    resp = server.request(f'/file/{files["notes.txt"]["_id"]}/ecg', user=admin)
    assertStatus(resp, 400)
    assert 'not a recognised ECG' in resp.json['message']


@pytest.mark.plugin('ecg_viewer')
def test_access_is_checked(server, user, ecgItem):
    item, files = ecgItem
    assertStatus(server.request(f'/item/{item["_id"]}/ecg', user=user), 403)
    assertStatus(server.request(f'/file/{files["rest.dcm"]["_id"]}/ecg', user=user), 403)


@requiresConverter
@pytest.mark.plugin('ecg_viewer')
def test_fda_aecg_is_listed_and_converted(server, admin, ecgItem):
    item, files = ecgItem
    listed = _listed(server, item, admin)
    assert sorted(listed) == ['aecg.xml', 'rest.dcm']
    assert listed['aecg.xml']['format'] == 'fda'
    assert listed['aecg.xml']['converted'] is True
    assert listed['aecg.xml']['exports'] == ['dicom', 'fda']
    assert listed['rest.dcm']['exports'] == ['dicom', 'fda']

    resp = server.request(f'/file/{files["aecg.xml"]["_id"]}/ecg', user=admin, isJson=False)
    assertStatusOk(resp)
    body = getResponseBody(resp, text=False)
    assert body[128:132] == b'DICM'
    assert b'1.2.840.10008.5.1.4.1.1.9.1.1' in body[:4096]


@requiresConverter
@pytest.mark.plugin('ecg_viewer')
def test_conversion_failure_is_reported(server, admin, fsAssetstore):
    from girder.models.folder import Folder
    from girder.models.item import Item
    from girder.models.upload import Upload

    folder = Folder().findOne({'parentId': admin['_id'], 'name': 'Private'})
    item = Item().createItem('Broken', admin, folder)
    broken = b'<?xml version="1.0"?><AnnotatedECG xmlns="urn:hl7-org:v3"><component>'
    file = Upload().uploadFromFile(io.BytesIO(broken), len(broken), 'b.xml', 'item', item, admin)
    resp = server.request(f'/file/{file["_id"]}/ecg', user=admin)
    assertStatus(resp, 400)
    message = resp.json['message']
    assert message.startswith('FDA HL7 aECG to DICOM conversion failed: ')
    assert 'XML syntax error' in message
    assert 'Usage:' not in message


def _download(server, file, format, user):
    return server.request(f'/file/{file["_id"]}/ecg/download', params={'format': format},
                          user=user, isJson=False)


@pytest.mark.plugin('ecg_viewer')
def test_download_in_own_format_is_unchanged(server, admin, ecgItem):
    item, files = ecgItem
    resp = _download(server, files['rest.dcm'], 'dicom', admin)
    assertStatusOk(resp)
    assert resp.headers['Content-Type'] == 'application/dicom'
    assert 'filename="rest.dcm"' in resp.headers['Content-Disposition']
    assert resp.headers['Content-Disposition'].startswith('attachment')
    assert getResponseBody(resp, text=False) == DICOM_SAMPLE.read_bytes()


@requiresConverter
@pytest.mark.plugin('ecg_viewer')
def test_download_dicom_as_fda(server, admin, ecgItem):
    item, files = ecgItem
    resp = _download(server, files['rest.dcm'], 'fda', admin)
    assertStatusOk(resp)
    assert resp.headers['Content-Type'] == 'application/xml'
    assert 'filename="rest.xml"' in resp.headers['Content-Disposition']
    body = getResponseBody(resp, text=False)
    assert b'<AnnotatedECG' in body[:1024]


@requiresConverter
@pytest.mark.plugin('ecg_viewer')
def test_download_fda_as_dicom(server, admin, ecgItem):
    item, files = ecgItem
    resp = _download(server, files['aecg.xml'], 'dicom', admin)
    assertStatusOk(resp)
    assert 'filename="aecg.dcm"' in resp.headers['Content-Disposition']
    assert getResponseBody(resp, text=False)[128:132] == b'DICM'


@pytest.mark.plugin('ecg_viewer')
def test_download_refusals(server, admin, user, ecgItem):
    item, files = ecgItem
    assertStatus(_download(server, files['rest.dcm'], 'pdf', admin), 400)
    resp = _download(server, files['notes.txt'], 'dicom', admin)
    assertStatus(resp, 400)
    assertStatus(_download(server, files['rest.dcm'], 'dicom', user), 403)

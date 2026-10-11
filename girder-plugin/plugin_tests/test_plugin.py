"""The plugin loads and publishes its web client to Girder."""

import pytest


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

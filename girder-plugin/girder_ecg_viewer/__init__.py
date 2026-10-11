from pathlib import Path

from girder.plugin import GirderPlugin, registerPluginStaticContent

from . import rest

WEB_CLIENT_DIST = Path(__file__).parent / 'web_client' / 'dist'


class EcgViewerPlugin(GirderPlugin):
    DISPLAY_NAME = 'ECG Viewer'

    def load(self, info):
        # The server recognises ECG files and hands them to the browser as
        # DICOM, converting vendor formats with ecg-bridge on the fly; the
        # browser parses the DICOM and renders it.
        rest.addRoutes(info['apiRoot'])

        registerPluginStaticContent(
            plugin='ecg_viewer',
            css=['/style.css'],
            js=['/girder-plugin-ecg-viewer.umd.cjs'],
            staticDir=WEB_CLIENT_DIST,
            tree=info['serverRoot'],
        )

from pathlib import Path

from girder.plugin import GirderPlugin, registerPluginStaticContent

WEB_CLIENT_DIST = Path(__file__).parent / 'web_client' / 'dist'


class EcgViewerPlugin(GirderPlugin):
    DISPLAY_NAME = 'ECG Viewer'

    def load(self, info):
        # Everything happens in the browser: the client sniffs the item's files
        # for an ECG SOP class, downloads the DICOM through the regular file
        # endpoints (so Girder's access control applies as-is) and parses it
        # locally. The server only has to serve the bundle.
        registerPluginStaticContent(
            plugin='ecg_viewer',
            css=['/style.css'],
            js=['/girder-plugin-ecg-viewer.umd.cjs'],
            staticDir=WEB_CLIENT_DIST,
            tree=info['serverRoot'],
        )

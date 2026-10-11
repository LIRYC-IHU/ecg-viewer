"""Pytest configuration for the ECG viewer plugin tests.

The server fixtures and the ``@pytest.mark.plugin('ecg_viewer')`` marker come
from ``pytest-girder``. Loading the plugin registers its built web client, and
Girder hashes those files for cache busting, so placeholders are written when
the bundle hasn't been built (CI runs the Python tests without node).
"""

import pathlib

_dist = pathlib.Path(__file__).resolve().parents[1] / 'girder_ecg_viewer' / 'web_client' / 'dist'
_dist.mkdir(parents=True, exist_ok=True)
for _name in ('girder-plugin-ecg-viewer.umd.cjs', 'style.css'):
    _placeholder = _dist / _name
    if not _placeholder.exists():
        _placeholder.write_text('/* test placeholder */\n')

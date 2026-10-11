# girder-ecg-viewer

[Girder 5](https://girder.readthedocs.io/) plugin that displays DICOM ECGs
directly on Girder item pages, using the
[ECG viewer](https://github.com/LIRYC-IHU/ecg-viewer) (WebGL rendering,
12 × 1 / 6 × 2 / 3 × 4 layouts, calipers, zoom, PNG export).

Josselin Duchateau @ IHU Liryc

## What it does

When an item page opens, the plugin looks at the item's files and shows an
**ECG** section above the item info for every DICOM ECG it finds:

- Supported SOP classes: 12-lead ECG (`1.2.840.10008.5.1.4.1.1.9.1.1`),
  General ECG (`…9.1.2`) and Ambulatory ECG (`…9.1.3`). Missing limb leads
  (III, aVR, aVL, aVF) are derived from I and II.
- Detection is cheap: only files that look like DICOM (`.dcm`, `.dicom`,
  no extension, UID-style names, `application/dicom`) and are under 64 MB are
  considered, and for those only the first 16 KB are fetched to look for an ECG
  SOP Class UID. Other files are never downloaded.
- Several ECGs in one item → a selector in the section header.
- Toolbar: export the current view as PNG, clear calipers, fullscreen
  (or <kbd>F</kbd>), download the DICOM file.
- The first 10 s of the recording are displayed.

Everything runs in the browser: the DICOM file is downloaded through Girder's
regular `file/{id}/download` endpoint — so Girder's access control applies
unchanged — and parsed client-side. The plugin adds no REST endpoint and no
Python dependency besides Girder itself.

## Installation

Install the wheel from the
[GitHub release](https://github.com/LIRYC-IHU/ecg-viewer/releases) into the
Python environment running Girder, then restart Girder. Girder 5 loads
installed plugins automatically; the web client is pre-built and shipped in
the wheel, there is no `girder build` step.

```bash
pip install https://github.com/LIRYC-IHU/ecg-viewer/releases/download/girder-v0.1.0/girder_ecg_viewer-0.1.0-py3-none-any.whl
```

In a Dockerfile based on the official image:

```dockerfile
FROM girder/girder:v5.0.17-py3
ARG ECG_VIEWER_VERSION=0.1.0
RUN pip install --no-cache-dir \
  "https://github.com/LIRYC-IHU/ecg-viewer/releases/download/girder-v${ECG_VIEWER_VERSION}/girder_ecg_viewer-${ECG_VIEWER_VERSION}-py3-none-any.whl"
```

## Development

The plugin lives in this repository next to the viewer it embeds; its web
client imports the viewer and the DICOM parser straight from `src/`,
`shared/` and `server/`.

```
girder-plugin/
├── pyproject.toml                 # Python package, `girder.plugin` entry point
├── girder_ecg_viewer/
│   ├── __init__.py                # registers the web client bundle
│   └── web_client/
│       ├── main.tsx               # hooks into Girder's ItemView
│       ├── EcgPanel.tsx           # the ECG section (React)
│       ├── girderApi.ts           # byte-level file download + parsing
│       ├── sniff.ts               # SOP Class UID detection
│       └── dist/                  # build output (shipped in the wheel)
├── plugin_tests/                  # pytest-girder tests
└── dev/                           # local Girder 5 + MongoDB (docker compose)
```

From the repository root:

```bash
npm ci
npm run build:girder   # → girder-plugin/girder_ecg_viewer/web_client/dist
npm test               # includes the sniffing tests
npm run typecheck
```

Local Girder with the plugin installed in editable mode (served on
<http://localhost:8089>), seeded with the sample ECGs:

```bash
docker compose -p girder-ecg-viewer -f girder-plugin/dev/docker-compose.yml up --build -d
girder-plugin/dev/seed.sh
```

The source is bind-mounted, so after `npm run build:girder` a page reload is
enough to pick up client changes. Python tests run against that MongoDB:

```bash
docker compose -p girder-ecg-viewer -f girder-plugin/dev/docker-compose.yml exec \
  -w /plugins/girder-ecg-viewer girder pytest -q plugin_tests --mongo-uri mongodb://mongodb:27017
```

## Releasing

Bump `version` in `girder-plugin/pyproject.toml`, then push a matching
`girder-v<version>` tag. The `Girder plugin release` workflow builds the web
client, the wheel and the sdist, checks that the bundle is inside the wheel,
and publishes them as a GitHub release.

## License

Apache 2.0

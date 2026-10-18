# girder-ecg-viewer

[Girder 5](https://girder.readthedocs.io/) plugin that displays ECGs
directly on Girder item pages, using the
[ECG viewer](https://github.com/LIRYC-IHU/ecg-viewer) (WebGL rendering,
12 × 1 / 6 × 2 / 3 × 4 layouts, calipers, zoom, PNG export). DICOM ECGs are
shown as they are; vendor formats are converted to DICOM on the fly with
[ecg-bridge](https://github.com/LIRYC-IHU/ecg-bridge).

Josselin Duchateau @ IHU Liryc

## What it does

When an item page opens, the plugin asks the server which of the item's files
are ECGs and shows an **ECG** section above the item info:

| Format | Recognised by | To DICOM | To FDA aECG |
| --- | --- | --- | --- |
| DICOM 12-lead / General / Ambulatory ECG | SOP Class UID (`1.2.840.10008.5.1.4.1.1.9.1.{1,2,3}`) | — | `dicom-to-fda` |
| FDA HL7 v3 aECG XML | root element `AnnotatedECG` | `fda-to-dicom` | — |
| Philips SierraECG XML | root element `restingecgdata` | `philips-to-dicom` | `philips-to-fda` |
| GE MUSE XML | root element `RestingECG` | `muse-to-dicom` | `muse-to-fda` |
| Mindray BeneHeart R12 | magic bytes `EB EC 12 34 20` | `mindray-to-dicom` | `mindray-to-fda` |
| Nihon Kohden (PEC) | `.DAT` extension | `nk-to-dicom` | `nk-to-fda` |
| Fukuda Denshi | `.ECG` extension | `fukuda-to-dicom` | `fukuda-to-fda` |

- Recognition reads only the first 64 KB of files whose name or MIME type
  could be an ECG (`.dcm`, `.xml`, `.dat`, `.ecg`, `.pat`, no extension,
  UID-style names, DICOM/XML MIME types) and that are under 64 MB. It reads
  straight from the assetstore, so it does not count as a download.
- A vendor format is offered only if its converter to DICOM is installed on
  the server; without ecg-bridge the plugin shows DICOM ECGs only.
- Every ECG can be downloaded as it is, as DICOM or as FDA HL7 aECG XML
  (download menu of the section), as far as the converters are installed.
- Several ECGs in one item → a selector in the section header; a badge shows
  the source format.
- Toolbar: export the current view as PNG, clear calipers, fullscreen
  (or <kbd>F</kbd>), download menu (original file, DICOM, FDA aECG).
- The first 10 s of the recording are displayed. Missing limb leads (III, aVR,
  aVL, aVF) are derived from I and II.

### REST endpoints

All require read access, like a normal download; the file routes also
accept the session cookie, so they work as plain links.

- `GET /item/{id}/ecg` — the item's ECG files: `_id`, `name`, `size`,
  `format`, `formatLabel`, `converted`, and `exports`, the formats each one
  can be downloaded as (`dicom`, `fda`).
- `GET /file/{id}/ecg` — the file as `application/dicom`, what the viewer
  loads: DICOM files unchanged, other formats converted.
- `GET /file/{id}/ecg/download?format=dicom|fda` — the file as an attachment,
  as DICOM (`.dcm`, `application/dicom`) or FDA HL7 aECG (`.xml`,
  `application/xml`): unchanged if it already is in that format, converted
  otherwise. The download is named after the file (`ecg.DAT` → `ecg.xml`).

Conversions count as downloads of the file (statistics, audit log). A file
that is not a recognised ECG, or fails to convert, gets a 400 with the
converter's error message.

The browser parses the DICOM and renders it.

## Installation

Install the wheel from the
[GitHub release](https://github.com/LIRYC-IHU/ecg-viewer/releases) into the
Python environment running Girder, then restart Girder. Girder 5 loads
installed plugins automatically; the web client is pre-built and shipped in
the wheel, there is no `girder build` step.

```bash
pip install https://github.com/LIRYC-IHU/ecg-viewer/releases/download/girder-v0.3.1/girder_ecg_viewer-0.3.1-py3-none-any.whl
```

For vendor formats and exports, put the ecg-bridge `*-to-dicom` and
`*-to-fda` binaries (from its
[releases](https://github.com/LIRYC-IHU/ecg-bridge/releases)) on the server's
`PATH`, or in a directory named by `ECG_BRIDGE_PATH` (a `PATH`-style list).
In a Dockerfile based on the official image:

```dockerfile
FROM girder/girder:v5.0.17-py3
ARG ECG_VIEWER_VERSION=0.3.1
# Latest ecg-bridge release, or a fixed one (--build-arg ECG_BRIDGE_VERSION=1.4.1).
# The ADD rebuilds the layer below when a new release comes out.
ARG ECG_BRIDGE_VERSION=latest
ARG TARGETARCH=amd64
ADD https://github.com/LIRYC-IHU/ecg-bridge/releases/latest/download/checksums.txt /tmp/ecg-bridge-latest.txt
RUN set -eux; \
    releases="https://github.com/LIRYC-IHU/ecg-bridge/releases"; \
    if [ "$ECG_BRIDGE_VERSION" = latest ]; then base="$releases/latest/download"; \
    else base="$releases/download/v${ECG_BRIDGE_VERSION}"; fi; \
    cd /tmp; curl -fsSLO "$base/checksums.txt"; \
    tarball=$(grep -o "ecg-bridge_v[^ ]*_linux_${TARGETARCH}\.tar\.gz" checksums.txt); \
    curl -fsSLO "$base/$tarball"; \
    grep " $tarball\$" checksums.txt | sha256sum -c -; \
    mkdir -p /opt/ecg-bridge/bin; \
    tar -xzf "$tarball" --strip-components=1 -C /opt/ecg-bridge/bin --wildcards '*-to-dicom' '*-to-fda'; \
    rm "$tarball" checksums.txt ecg-bridge-latest.txt
ENV ECG_BRIDGE_PATH=/opt/ecg-bridge/bin
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
│   ├── __init__.py                # registers the REST routes and web client
│   ├── formats.py                 # ECG format recognition
│   ├── convert.py                 # ecg-bridge conversion to DICOM
│   ├── rest.py                    # GET /item/{id}/ecg, GET /file/{id}/ecg
│   └── web_client/
│       ├── main.tsx               # hooks into Girder's ItemView
│       ├── EcgPanel.tsx           # the ECG section (React)
│       ├── girderApi.ts           # REST calls + DICOM parsing
│       └── dist/                  # build output (shipped in the wheel)
├── plugin_tests/                  # pytest-girder tests; data/aecg.xml is server/samples/1.dcm
│                                  # converted with `dicom-to-fda --anonymize`
└── dev/                           # local Girder 5 + MongoDB (docker compose)
```

From the repository root:

```bash
npm ci
npm run build:girder   # → girder-plugin/girder_ecg_viewer/web_client/dist
npm test
npm run typecheck
```

Local Girder with the plugin installed in editable mode (served on
<http://localhost:8089>), seeded with the sample ECGs:

```bash
docker compose -p girder-ecg-viewer -f girder-plugin/dev/docker-compose.yml up --build -d
girder-plugin/dev/seed.sh
```

The image includes the ecg-bridge converters, and the seed adds an FDA aECG
item to exercise the conversion. The repository is bind-mounted, so after
`npm run build:girder` a page reload is enough to pick up client changes, and
a container restart picks up Python changes. Python tests run against that
MongoDB:

```bash
docker compose -p girder-ecg-viewer -f girder-plugin/dev/docker-compose.yml exec \
  -w /src/ecg-viewer/girder-plugin -e ECG_VIEWER_REQUIRE_CONVERTERS=1 girder \
  pytest -q plugin_tests --mongo-uri mongodb://mongodb:27017
```

## Releasing

Bump `version` in `girder-plugin/pyproject.toml`, then push a matching
`girder-v<version>` tag. The `Girder plugin release` workflow builds the web
client, the wheel and the sdist, checks that the bundle is inside the wheel,
and publishes them as a GitHub release.

## License

Apache 2.0

# Local Girder 5 for developing and testing the plugin.
ARG GIRDER_IMAGE=girder/girder:v5.0.9-py3
FROM ${GIRDER_IMAGE}

# ecg-bridge converters (vendor ECG formats → DICOM), checksum-verified.
ARG ECG_BRIDGE_VERSION=1.4.0
ARG TARGETARCH=amd64
RUN set -eux; \
    base="https://github.com/LIRYC-IHU/ecg-bridge/releases/download/v${ECG_BRIDGE_VERSION}"; \
    tarball="ecg-bridge_v${ECG_BRIDGE_VERSION}_linux_${TARGETARCH}.tar.gz"; \
    cd /tmp; \
    curl -fsSLO "$base/$tarball"; curl -fsSLO "$base/checksums.txt"; \
    grep " $tarball\$" checksums.txt | sha256sum -c -; \
    mkdir -p /opt/ecg-bridge/bin; \
    tar -xzf "$tarball" --strip-components=1 -C /opt/ecg-bridge/bin --wildcards '*-to-dicom'; \
    rm "$tarball" checksums.txt
ENV ECG_BRIDGE_PATH=/opt/ecg-bridge/bin

RUN pip install --no-cache-dir pytest pytest-girder

# docker-compose.yml bind-mounts the repository over /src/ecg-viewer, so a
# rebuilt bundle (`npm run build:girder`) is served live after a page reload.
COPY . /src/ecg-viewer
RUN pip install --no-cache-dir -e /src/ecg-viewer/girder-plugin

EXPOSE 8080

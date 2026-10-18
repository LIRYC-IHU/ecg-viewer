# Local Girder 5 for developing and testing the plugin.
ARG GIRDER_IMAGE=girder/girder:v5.0.9-py3
FROM ${GIRDER_IMAGE}

# ecg-bridge converters (ECG formats → DICOM and FDA aECG), checksum-verified:
# the latest release, or the one given with --build-arg ECG_BRIDGE_VERSION=1.4.1.
# The ADD only busts the cache: its checksums.txt changes with each release, so
# a new ecg-bridge release rebuilds this layer instead of keeping old binaries.
ARG ECG_BRIDGE_VERSION=latest
ARG TARGETARCH=amd64
ADD https://github.com/LIRYC-IHU/ecg-bridge/releases/latest/download/checksums.txt /tmp/ecg-bridge-latest.txt
RUN set -eux; \
    releases="https://github.com/LIRYC-IHU/ecg-bridge/releases"; \
    if [ "$ECG_BRIDGE_VERSION" = latest ]; then base="$releases/latest/download"; \
    else base="$releases/download/v${ECG_BRIDGE_VERSION}"; fi; \
    cd /tmp; \
    curl -fsSLO "$base/checksums.txt"; \
    tarball=$(grep -o "ecg-bridge_v[^ ]*_linux_${TARGETARCH}\.tar\.gz" checksums.txt); \
    curl -fsSLO "$base/$tarball"; \
    grep " $tarball\$" checksums.txt | sha256sum -c -; \
    mkdir -p /opt/ecg-bridge/bin; \
    tar -xzf "$tarball" --strip-components=1 -C /opt/ecg-bridge/bin --wildcards '*-to-dicom' '*-to-fda'; \
    rm "$tarball" checksums.txt ecg-bridge-latest.txt
ENV ECG_BRIDGE_PATH=/opt/ecg-bridge/bin

RUN pip install --no-cache-dir pytest pytest-girder

# docker-compose.yml bind-mounts the repository over /src/ecg-viewer, so a
# rebuilt bundle (`npm run build:girder`) is served live after a page reload.
COPY . /src/ecg-viewer
RUN pip install --no-cache-dir -e /src/ecg-viewer/girder-plugin

EXPOSE 8080

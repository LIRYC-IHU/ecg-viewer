# Local Girder 5 for developing and testing the plugin.
ARG GIRDER_IMAGE=girder/girder:v5.0.9-py3
FROM ${GIRDER_IMAGE}

RUN pip install --no-cache-dir pytest pytest-girder

# docker-compose.yml bind-mounts the source over /plugins/girder-ecg-viewer, so
# a rebuilt bundle (`npm run build:girder`) is served live after a page reload.
COPY . /plugins/girder-ecg-viewer
RUN pip install --no-cache-dir -e /plugins/girder-ecg-viewer

EXPOSE 8080

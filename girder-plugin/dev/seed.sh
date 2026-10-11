#!/usr/bin/env bash
# Seed the local dev Girder (docker-compose.yml) with an admin, an assetstore
# and a few items holding the bundled sample ECGs. Dev-only credentials.
set -euo pipefail

API=${API:-http://localhost:8089/api/v1}
LOGIN=${GIRDER_ADMIN_LOGIN:-admin}
PASSWORD=${GIRDER_ADMIN_PASSWORD:-ecg-viewer-dev}
SAMPLES="$(cd "$(dirname "$0")/../../server/samples" && pwd)"
AECG="$(cd "$(dirname "$0")/../plugin_tests/data" && pwd)/aecg.xml"

json() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }

# First registered user becomes the site admin; ignore "already exists".
curl -sf -X POST "$API/user" \
  --data-urlencode "login=$LOGIN" --data-urlencode "password=$PASSWORD" \
  --data-urlencode "email=$LOGIN@example.test" \
  --data-urlencode "firstName=Dev" --data-urlencode "lastName=Admin" >/dev/null || true

TOKEN=$(curl -sf -u "$LOGIN:$PASSWORD" "$API/user/authentication" | json "['authToken']['token']")
H=(-H "Girder-Token: $TOKEN")

if [ "$(curl -sf "${H[@]}" "$API/assetstore" | json '.__len__()')" = 0 ]; then
  curl -sf "${H[@]}" -X POST "$API/assetstore" \
    -d name=local -d type=0 -d root=/assetstore >/dev/null
fi

COLL=$(curl -sf "${H[@]}" "$API/collection" | python3 -c "
import json,sys; c=[x for x in json.load(sys.stdin) if x['name']=='ECG samples']; print(c[0]['_id'] if c else '')")
if [ -z "$COLL" ]; then
  COLL=$(curl -sf "${H[@]}" -X POST "$API/collection" -d "name=ECG samples" -d public=true | json "['_id']")
fi
FOLDER=$(curl -sf "${H[@]}" -X POST "$API/folder" -d parentType=collection -d "parentId=$COLL" \
  -d name=Samples -d reuseExisting=true | json "['_id']")

upload() {  # upload <itemId> <path> <name>
  local size; size=$(wc -c < "$2" | tr -d ' ')
  local up; up=$(curl -sf "${H[@]}" -X POST "$API/file" -d parentType=item -d "parentId=$1" \
    --data-urlencode "name=$3" -d "size=$size" | json "['_id']")
  curl -sf "${H[@]}" -X POST "$API/file/chunk?uploadId=$up&offset=0" \
    -H 'Content-Type: application/octet-stream' --data-binary "@$2" >/dev/null
}

item() {  # item <name> -> id
  curl -sf "${H[@]}" -X POST "$API/item" -d "folderId=$FOLDER" --data-urlencode "name=$1" \
    -d reuseExisting=true | json "['_id']"
}

for f in "$SAMPLES"/*.dcm; do
  name=$(basename "$f")
  id=$(item "ECG $name")
  if [ "$(curl -sf "${H[@]}" "$API/item/$id/files" | json '.__len__()')" = 0 ]; then
    upload "$id" "$f" "$name"
  fi
done

# A vendor format, converted to DICOM on the fly by ecg-bridge.
fda=$(item "FDA aECG")
if [ "$(curl -sf "${H[@]}" "$API/item/$fda/files" | json '.__len__()')" = 0 ]; then
  upload "$fda" "$AECG" "ecg-aecg.xml"
fi

# One item with several ECGs plus a non-ECG file, and one with no ECG at all.
multi=$(item "Several ECGs")
if [ "$(curl -sf "${H[@]}" "$API/item/$multi/files" | json '.__len__()')" = 0 ]; then
  upload "$multi" "$SAMPLES/1.dcm" "rest-1.dcm"
  upload "$multi" "$SAMPLES/2.dcm" "1.2.826.0.1.3680043.8.498.2"
  upload "$multi" "$SAMPLES/../index.ts" "notes.txt"
fi
plain=$(item "Not an ECG")
if [ "$(curl -sf "${H[@]}" "$API/item/$plain/files" | json '.__len__()')" = 0 ]; then
  upload "$plain" "$SAMPLES/../index.ts" "notes.dcm"
fi

echo "Seeded. Log in at ${API%/api/v1} as $LOGIN."
echo "Items: $(curl -sf "${H[@]}" "$API/item?folderId=$FOLDER" | python3 -c "import json,sys; print(', '.join(i['name']+'='+i['_id'] for i in json.load(sys.stdin)))")"

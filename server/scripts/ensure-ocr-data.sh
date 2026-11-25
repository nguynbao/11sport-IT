#!/usr/bin/env sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

for LANG in eng vie; do
  TARGET="$SERVER_DIR/${LANG}.traineddata"
  if [ ! -f "$TARGET" ]; then
    echo "[OCR] Downloading ${LANG}.traineddata..."
    curl -fsSL "https://github.com/tesseract-ocr/tessdata_fast/raw/main/${LANG}.traineddata" -o "$TARGET"
  fi
done

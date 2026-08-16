#!/usr/bin/env bash
# Build a zip people can download and Load unpacked.
set -euo pipefail
cd "$(dirname "$0")"
VER=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUT="dist/md-in-chrome-${VER}"
rm -rf dist
mkdir -p "$OUT"
# Ship only what Chrome needs — no git, no tests.
cp manifest.json background.js blocks.js edits.js md.js saving.js pdf.js format.js editor.html editor.js editor.css LICENSE README.md "$OUT/"
cp -r icons lib "$OUT/"
(
  cd dist
  zip -r "md-in-chrome-${VER}.zip" "md-in-chrome-${VER}"
)
echo "Wrote dist/md-in-chrome-${VER}.zip"
echo "Unzip, then chrome://extensions → Load unpacked → that folder."

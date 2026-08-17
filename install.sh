#!/usr/bin/env bash
# Put Markdown in Chrome in a stable folder and open the extensions page.
# Chrome still needs one click: Developer mode → Load unpacked → that folder.
#
# From this repo:
#   ./install.sh
# From a release, with no repo on disk:
#   ./install.sh --download
#
# Do not save documents inside the folder this script installs to.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
NO_OPEN=0
FORCE_DOWNLOAD=0
for arg in "$@"; do
  case "$arg" in
    --no-open) NO_OPEN=1 ;;
    --download) FORCE_DOWNLOAD=1 ;;
    -h|--help)
      printf '%s\n' \
        "Usage: ./install.sh [--download] [--no-open]" \
        "  copies the extension to a stable folder" \
        "  then opens chrome://extensions" \
        "  --download   fetch the latest GitHub release zip" \
        "  --no-open    do not launch the browser"
      exit 0
      ;;
    *)
      printf 'unknown option: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

os="$(uname -s)"
case "$os" in
  Darwin) DEST="${HOME}/Library/Application Support/md-in-chrome" ;;
  *)      DEST="${XDG_DATA_HOME:-$HOME/.local/share}/md-in-chrome" ;;
esac

SHIP=(
  manifest.json background.js blocks.js edits.js md.js saving.js
  pdf.js format.js editor.html editor.js editor.css LICENSE README.md
)

copy_tree() {
  local src="$1"
  mkdir -p "$DEST/icons" "$DEST/lib"
  local f
  for f in "${SHIP[@]}"; do
    if [[ ! -f "$src/$f" ]]; then
      printf 'missing %s in %s\n' "$f" "$src" >&2
      exit 1
    fi
    cp "$src/$f" "$DEST/$f"
  done
  cp "$src/icons/icon128.png" "$DEST/icons/icon128.png"
  cp "$src"/lib/* "$DEST/lib/"
}

download_release() {
  local tmp zip url
  tmp="$(mktemp -d)"
  url="$(python3 "$HERE/latest-zip-url.py")"
  zip="$tmp/md-in-chrome.zip"
  curl -fsSL -o "$zip" "$url"
  unzip -q "$zip" -d "$tmp/unz"
  # Release zip is md-in-chrome-<ver>/... ; GitHub source zip is <repo>-<ref>/...
  local root
  root="$(find "$tmp/unz" -name manifest.json -print -quit)"
  if [[ -z "$root" ]]; then
    rm -rf "$tmp"
    printf 'unzipped archive has no manifest.json\n' >&2
    exit 1
  fi
  copy_tree "$(dirname "$root")"
  rm -rf "$tmp"
}

if [[ "$FORCE_DOWNLOAD" -eq 1 ]]; then
  download_release
elif [[ -f "$HERE/manifest.json" ]]; then
  copy_tree "$HERE"
else
  download_release
fi

ver="$(python3 -c "import json; print(json.load(open('$DEST/manifest.json'))['version'])")"
printf 'Installed Markdown in Chrome %s\n' "$ver"
printf 'Folder:\n  %s\n' "$DEST"
printf '\nIn Chrome or Edge:\n'
printf '  1. Open chrome://extensions  (or edge://extensions)\n'
printf '  2. Turn Developer mode on (top right)\n'
printf '  3. Load unpacked — choose the folder above\n'
printf '  4. Do not save your documents inside that folder\n'

if [[ "$NO_OPEN" -eq 1 ]]; then
  exit 0
fi

# Opening the extensions page is a convenience. Load unpacked is still a click.
open_extensions() {
  local url="$1"
  local c
  for c in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge; do
    if command -v "$c" >/dev/null 2>&1; then
      "$c" "$url" >/dev/null 2>&1 &
      return 0
    fi
  done
  if [[ "$os" = Darwin ]] && command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
    return 0
  fi
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DEST" >/dev/null 2>&1 || true
  fi
}

open_extensions "chrome://extensions"

#!/usr/bin/env bash
# Run test-roundtrip.html in headless Chrome and exit non-zero on a failure.
#
# The conversion rules need a real DOM, so these cannot run in node the way
# test-blocks.mjs and test-edits.mjs do. Served over http rather than file://
# because Chrome refuses ES module imports from a file:// origin.
set -euo pipefail
cd "$(dirname "$0")"

CHROME=""
for c in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge; do
    if command -v "$c" >/dev/null 2>&1; then CHROME=$c; break; fi
done
[ -n "$CHROME" ] || { echo "no Chrome or Edge on this machine — open test-roundtrip.html by hand"; exit 2; }

PORT=8749
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:$PORT/test-roundtrip.html" -o /dev/null && break
    sleep 0.1
done

OUT=$("$CHROME" --headless --disable-gpu --no-sandbox \
        --virtual-time-budget=4000 --dump-dom \
        "http://127.0.0.1:$PORT/test-roundtrip.html" 2>/dev/null)

# The page writes its report into <pre id="out">. sed is line-based and the
# report has newlines in it, so pull it out with python.
REPORT=$(printf '%s' "$OUT" | python3 -c '
import html, re, sys
m = re.search(r"<pre id=\"out\">(.*?)</pre>", sys.stdin.read(), re.S)
print(html.unescape(m.group(1)) if m else "", end="")
')

if [ -z "$REPORT" ]; then
    echo "the test page produced no report — the module probably failed to load"
    exit 1
fi

printf '%s\n' "$REPORT"
printf '%s' "$REPORT" | grep -q 'FAIL' && exit 1
exit 0

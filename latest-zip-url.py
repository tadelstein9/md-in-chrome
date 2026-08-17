#!/usr/bin/env python3
"""Print the browser download URL of the latest md-in-chrome release zip."""
import json
import sys
import urllib.request

req = urllib.request.Request(
    "https://api.github.com/repos/tadelstein9/md-in-chrome/releases/latest",
    headers={"User-Agent": "md-in-chrome-install"},
)
with urllib.request.urlopen(req) as resp:
    data = json.load(resp)
urls = [
    a["browser_download_url"]
    for a in data.get("assets", [])
    if a["name"].startswith("md-in-chrome-") and a["name"].endswith(".zip")
]
if not urls:
    sys.stderr.write("no release zip on GitHub\n")
    sys.exit(1)
print(urls[0])

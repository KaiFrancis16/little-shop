#!/usr/bin/env python3
"""Build Little Shop's install site.

src/prefix.html   - head, CSS, bundled libraries (React, Radix UI, jsPDF ...), unchanged
src/extra.css     - our own CSS additions, injected before </style></head>
src/app.pretty.js - the app's own code (data layer + UI), readable and editable
src/suffix.html   - end of script + bundled licence notices, unchanged
src/site/         - installer page, service worker template, setup guide

Output: dist/little-shop/  (upload this folder's contents to any HTTPS static host)
  index.html, install-offline.html   installer (registers the service worker, then opens the app)
  favicon.svg, Offline-iPad-setup.txt
  offline/index.html                 the app
  offline/sw.js                      offline cache (cache name changes whenever the app changes)
  offline/manifest.webmanifest, offline/icon-192.png, offline/icon-512.png
"""
import hashlib, pathlib, shutil, subprocess, sys

root = pathlib.Path(__file__).parent
src = root / "src"
prefix = (src / "prefix.html").read_text(encoding="utf-8")
extra = (src / "extra.css").read_text(encoding="utf-8") if (src / "extra.css").exists() else ""
app = (src / "app.pretty.js").read_text(encoding="utf-8")
suffix = (src / "suffix.html").read_text(encoding="utf-8")

marker = "</style></head>"
assert prefix.count(marker) == 1, "style end marker not found exactly once"
prefix = prefix.replace(marker, "\n/* Little Shop additions */\n" + extra + "\n" + marker)

check = subprocess.run(["node", "-e", "new Function(require('fs').readFileSync(process.argv[1],'utf8'))",
                        str(src / "app.pretty.js")], capture_output=True, text=True)
if check.returncode:
    sys.exit("app.pretty.js has a syntax error:\n" + check.stderr)

html = prefix + app + suffix
site = root / "dist" / "little-shop"
if site.exists():
    shutil.rmtree(site)
off = site / "offline"
off.mkdir(parents=True)
(off / "index.html").write_text(html, encoding="utf-8")

# Cache name tied to the app's content, so every new version replaces the old cache.
# User records are in IndexedDB, not in this cache, so they are not touched by an update.
version = hashlib.sha256(html.encode("utf-8")).hexdigest()[:12]
sw = (src / "site" / "sw.template.js").read_text(encoding="utf-8").replace("__CACHE_NAME__", "little-shop-offline-" + version)
(off / "sw.js").write_text(sw, encoding="utf-8")
for name in ["manifest.webmanifest", "icon-192.png", "icon-512.png"]:
    shutil.copy(root / "original" / name, off / name)

installer = (src / "site" / "install.html").read_text(encoding="utf-8")
(site / "index.html").write_text(installer, encoding="utf-8")
(site / "install-offline.html").write_text(installer, encoding="utf-8")
shutil.copy(root / "original" / "favicon.svg", site / "favicon.svg")
if (src / "site" / "Offline-iPad-setup.txt").exists():
    shutil.copy(src / "site" / "Offline-iPad-setup.txt", site / "Offline-iPad-setup.txt")

# Keep the single-file copy used for the design preview
(root / "dist" / "offline").mkdir(parents=True, exist_ok=True)
(root / "dist" / "offline" / "index.html").write_text(html, encoding="utf-8")
print("built", site, "cache", "little-shop-offline-" + version)

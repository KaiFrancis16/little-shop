# Little Shop

Offline order calculator for an iPad Air (5th gen). Installed once from Safari, then runs from the Home Screen with no internet.

**Install link:** https://kaifrancis16.github.io/little-shop/

See `Offline-iPad-setup.txt` for the iPad setup steps.

## Layout
- `index.html` – install page (registers the offline service worker, then opens the app)
- `offline/` – the app, service worker, manifest and icons
- `source/` – editable source. Run `python3 source/build.py` to rebuild into `source/dist/little-shop/`, then copy that folder's contents to the repository root.

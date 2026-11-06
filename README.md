# Garage Boxes

A phone-friendly app to track what's in each storage box and find things fast. No server, no account: everything is stored on your device (IndexedDB).

## Features
- **Find**: type an item name (or tag/note) and see which box and shelf it's in.
- **Boxes**: add boxes with a location; quick-add items (type, Enter, repeat); quantity +/−; tags; photos of items and boxes.
- **QR labels**: print a QR code per box and stick it on. Scanning opens that box's contents.
- **Backup**: export/import everything (including photos) as a JSON file.
- Installable ("Add to Home Screen") and works offline.

## Run / host
It's a static site, so host the repo root anywhere, e.g. GitHub Pages (Settings → Pages → deploy from branch), or locally:

```bash
python3 -m http.server 8000
```

Open it on your phone over HTTPS (needed for install/offline/camera) and use "Add to Home Screen".

## Notes
- Data is per device and per browser. QR codes open the box on the phone that holds the data, so catalogue and scan on the same phone and export backups regularly.
- Uses the MIT-licensed [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (vendored in `lib/`).

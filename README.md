# Garage Boxes

A phone-friendly app to track what's in each storage box and find things fast. No server, no account: everything is stored on your device (IndexedDB).

## Features
- **Find**: type an item name (or tag/note) and see which box and shelf it's in.
- **Boxes**: add boxes with a location; quick-add items (type, Enter, repeat); quantity +/−; tags; photos of items and boxes.
- **QR labels**: print a QR code per box and stick it on. Scanning opens that box's contents.
- **Backup**: export/import everything (including photos) as a JSON file, or back up straight to Google Drive and restore from it.
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

## Google Drive backup setup (one time)
The app uploads to a folder it creates called **Garage Boxes Backups** in your My Drive (newest 10 backups are kept). It uses the `drive.file` scope, so it can only see files it created itself and cannot browse the rest of your Drive. For the same reason you can't point it at an existing folder.

1. Host the app over HTTPS (e.g. GitHub Pages) and note its origin, e.g. `https://<user>.github.io`.
2. In [Google Cloud Console](https://console.cloud.google.com/) create a project, then enable the **Google Drive API** (APIs & Services → Library).
3. APIs & Services → **OAuth consent screen**: choose External, fill in the app name and your email. While the app is in "Testing", add your own Google account under **Test users**.
4. APIs & Services → Credentials → **Create credentials → OAuth client ID** → type **Web application**. Under **Authorized JavaScript origins** add your origin from step 1 (no path). Create it and copy the client ID.
5. In the app: Backup tab → paste the client ID → **Back up to Drive**, and approve the Google pop-up.

Notes: the client ID is not a secret. Google sign-in tokens last about an hour with no silent refresh, so a pop-up may appear for each backup or restore. Restoring replaces all current data. Drive backups are not encrypted by the app.

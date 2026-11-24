# Weekly Seva Signup · North Fort Worth Bhakti Center

Two pages, no devotee accounts, **no database**:

- **`/`**: devotees see the upcoming program date and seva cards, tap **Sign Up**, type their name, done.
- **`/#/admin`**: password-protected. Set the date, add/edit/remove services, set volunteers needed, see and remove names, reset the week.

React (Vite) frontend plus a tiny dependency-free Node server (`server.js`) that keeps everything in one file, `data.json`. Signups update live on every open screen.

## Run it

```bash
npm install
npm run build
ADMIN_PASSWORD=your-secret-password npm start     # http://localhost:3000
```

Options (environment variables): `PORT` (default 3000), `DATA_FILE` (default `./data.json`).
The server refuses to start without `ADMIN_PASSWORD`.

For development with hot reload: run `ADMIN_PASSWORD=test npm start` in one terminal and `npm run dev` in another.

## Hosting
Needs any host that runs Node and keeps a small disk (so `data.json` survives restarts): a cheap VPS, Render/Railway/Fly with a persistent volume, or a computer at the center. Put `DATA_FILE` on the persistent disk. Static-only hosts (GitHub Pages, Netlify) won't work because signups must be shared and saved by the server.

## Notes
- Signup limits and duplicate names (any capitalisation) are enforced on the server, so two people can't take the last spot together.
- Admin actions need a signed login token (valid 12 hours); repeated wrong passwords are slowed down. Use HTTPS in production.
- "Reset week" clears all signups and sets the next date; your services stay.
- To back up or edit by hand, just copy `data.json`.
- Since there's no devotee login, someone could type a fake name; the admin can remove any signup.

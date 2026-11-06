// Google Drive backup via Google Identity Services (token flow) + Drive REST v3.
// Scope drive.file: the app only sees files it created itself.
const Drive = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER = 'Garage Boxes Backups';
  const KEEP = 10;
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  let token = null, expiresAt = 0, folderId = null;

  const store = {
    get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  const clientId = () => store.get('gb-client-id');

  function gisReady() {
    return new Promise((res, rej) => {
      let n = 0;
      (function check() {
        if (window.google && google.accounts && google.accounts.oauth2) return res();
        if (++n > 50) return rej(new Error('Google sign-in script did not load (offline?)'));
        setTimeout(check, 100);
      })();
    });
  }

  async function signIn() {
    if (token && Date.now() < expiresAt - 60000) return token;
    if (!clientId()) throw new Error('Enter your Google client ID first');
    await gisReady();
    return new Promise((res, rej) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope: SCOPE,
        callback: (r) => {
          if (r.error) return rej(new Error(r.error_description || r.error));
          token = r.access_token;
          expiresAt = Date.now() + (Number(r.expires_in) || 3600) * 1000;
          res(token);
        },
        error_callback: (e) => rej(new Error(e.message || e.type || 'Sign-in cancelled')),
      });
      tc.requestAccessToken({ prompt: token ? '' : 'consent' });
    });
  }

  // Authorised fetch; on 401 (expired/revoked token) sign in again once and retry.
  async function api(url, opts = {}, retried = false) {
    const t = await signIn();
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + t } });
    if (r.status === 401 && !retried) { token = null; return api(url, opts, true); }
    if (!r.ok) throw new Error('Drive error ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r;
  }

  async function ensureFolder() {
    if (folderId) return folderId;
    const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const found = await (await api(`${API}/files?q=${q}&fields=files(id)&pageSize=1`)).json();
    if (found.files && found.files.length) return (folderId = found.files[0].id);
    const made = await (await api(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
    })).json();
    return (folderId = made.id);
  }

  async function list() {
    const fid = await ensureFolder();
    const q = encodeURIComponent(`'${fid}' in parents and trashed=false`);
    const r = await (await api(`${API}/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=100`)).json();
    return r.files || [];
  }

  async function upload(name, text) {
    const fid = await ensureFolder();
    const b = 'gb' + Math.random().toString(36).slice(2);
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, parents: [fid], mimeType: 'application/json' }) +
      `\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
    const file = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id,name`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + b },
      body,
    })).json();
    // Keep only the newest KEEP backups.
    try {
      const all = await list();
      for (const f of all.slice(KEEP)) await api(`${API}/files/${f.id}`, { method: 'DELETE' });
    } catch { /* pruning is best effort */ }
    return file;
  }

  async function download(id) {
    return (await api(`${API}/files/${id}?alt=media`)).text();
  }

  return { clientId, setClientId: (v) => store.set('gb-client-id', v.trim()), signIn, list, upload, download, store };
})();

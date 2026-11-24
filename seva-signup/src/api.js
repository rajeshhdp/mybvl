// Talks to server.js. Admin login is a signed token kept in this browser.
const TOKEN_KEY = 'nfw-seva-admin';
const listeners = new Set();
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  listeners.forEach((f) => f(Boolean(t)));
};

async function call(method, url, body, admin = false) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (admin && res.status === 401) setToken(null); // expired login
    throw Object.assign(new Error(json.error || 'Request failed'), { code: json.error });
  }
  return json;
}

export const api = {
  fetchProgram: () => call('GET', '/api/program'),
  subscribe(cb) {
    const es = new EventSource('/api/events'); // live updates; auto-reconnects
    es.onmessage = cb;
    return () => es.close();
  },
  signUp: (serviceId, name) => call('POST', '/api/signup', { serviceId, name }),

  async getSession() {
    if (!getToken()) return false;
    try { await call('GET', '/api/admin/check', null, true); return true; } catch { return false; }
  },
  onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  async signIn(password) { const { token } = await call('POST', '/api/admin/login', { password }); setToken(token); },
  async signOut() { setToken(null); },

  setProgramDate: (date) => call('PUT', '/api/admin/date', { date }, true),
  addService: (f) => call('POST', '/api/admin/services', f, true),
  updateService: (id, f) => call('PUT', `/api/admin/services/${id}`, f, true),
  deleteService: (id) => call('DELETE', `/api/admin/services/${id}`, null, true),
  removeSignup: (id) => call('DELETE', `/api/admin/signups/${id}`, null, true),
  resetWeek: (date) => call('POST', '/api/admin/reset', { date }, true),
};

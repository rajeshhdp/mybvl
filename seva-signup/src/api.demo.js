// Demo backend used ONLY when Supabase env vars are missing.
// Stores data in this browser's localStorage so the UI can be tried out.
// Demo admin password: "krishna"
const KEY = 'seva-demo-v1';
const listeners = new Set();
const uid = () => Math.random().toString(36).slice(2, 10);

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seed() {
  const rows = [
    ['Kirtan', 'Lead or accompany the congregational chanting of the holy names.', 2],
    ['Bhagavad Gita Reading', 'Read a short passage from the Bhagavad Gita for everyone.', 1],
    ['Class / Discussion', 'Present the topic or facilitate the group discussion.', 1],
    ['Prasadam Preparation', 'Cook or bring offered-with-love prasadam for the group.', 3],
    ['Prasadam Distribution', 'Serve prasadam to all the guests with a smile.', 3],
    ['Setup & Decorations', 'Arrange the space, seating, altar and flowers before the program.', 3],
    ['Cleanup', 'Help tidy the hall and wash up after prasadam.', 3],
    ['Kids Activities', 'Lead a story, craft or game for the children.', 2],
    ['Welcome Team', 'Greet devotees and guests warmly as they arrive.', 2],
  ];
  return {
    programDate: nextSunday(),
    admin: false,
    services: rows.map(([name, description, needed], i) => ({ id: uid(), name, description, needed, sort_order: i + 1, signups: [] })),
  };
}

function read() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return s; } catch { /* ignore */ }
  const s = seed(); write(s, false); return s;
}
function write(s, notify = true) {
  localStorage.setItem(KEY, JSON.stringify(s));
  if (notify) listeners.forEach((f) => f());
}
const err = (code) => Object.assign(new Error(code), { code });

export const api = {
  async fetchProgram() { const s = read(); return { programDate: s.programDate, services: s.services }; },
  subscribe(cb) {
    listeners.add(cb);
    const onStorage = (e) => e.key === KEY && cb();
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
  },
  async signUp(serviceId, name) {
    const s = read();
    const v = s.services.find((x) => x.id === serviceId);
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!v) throw err('NOT_FOUND');
    if (clean.length < 2 || clean.length > 60) throw err('INVALID_NAME');
    if (v.signups.some((x) => x.name.toLowerCase() === clean.toLowerCase())) throw err('DUPLICATE');
    if (v.signups.length >= v.needed) throw err('FULL');
    v.signups.push({ id: uid(), service_id: v.id, name: clean });
    write(s);
  },
  async getSession() { return read().admin; },
  onAuthChange(cb) { const f = () => cb(read().admin); listeners.add(f); return () => listeners.delete(f); },
  async signIn(password) {
    if (password !== 'krishna') throw new Error('Invalid login credentials');
    const s = read(); s.admin = true; write(s);
  },
  async signOut() { const s = read(); s.admin = false; write(s); },
  async setProgramDate(date) { const s = read(); s.programDate = date; write(s); },
  async addService({ name, description, needed }, sortOrder) {
    const s = read();
    s.services.push({ id: uid(), name, description, needed, sort_order: sortOrder, signups: [] });
    write(s);
  },
  async updateService(id, patch) {
    const s = read(); Object.assign(s.services.find((x) => x.id === id), patch); write(s);
  },
  async deleteService(id) { const s = read(); s.services = s.services.filter((x) => x.id !== id); write(s); },
  async removeSignup(id) {
    const s = read(); s.services.forEach((v) => { v.signups = v.signups.filter((x) => x.id !== id); }); write(s);
  },
  async resetWeek(newDate) {
    const s = read(); s.services.forEach((v) => { v.signups = []; }); s.programDate = newDate; write(s);
  },
};
export const isDemo = true;

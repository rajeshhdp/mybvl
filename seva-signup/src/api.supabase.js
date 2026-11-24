import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;

export const isConfigured = Boolean(url && key && adminEmail);
const sb = isConfigured ? createClient(url, key) : null;

const fail = (error) => { if (error) throw error; };

// Postgres exceptions raised by sign_up() arrive as error.message.
function friendly(error) {
  const m = error?.message || '';
  for (const code of ['DUPLICATE', 'FULL', 'INVALID_NAME', 'NOT_FOUND']) {
    if (m.includes(code)) return Object.assign(new Error(code), { code });
  }
  return error;
}

export const api = {
  async fetchProgram() {
    const [s, v, g] = await Promise.all([
      sb.from('settings').select('program_date').eq('id', 1).maybeSingle(),
      sb.from('services').select('*').order('sort_order').order('created_at'),
      sb.from('signups').select('id, service_id, name').order('created_at'),
    ]);
    fail(s.error); fail(v.error); fail(g.error);
    return {
      programDate: s.data?.program_date ?? null,
      services: v.data.map((svc) => ({
        ...svc,
        signups: g.data.filter((x) => x.service_id === svc.id),
      })),
    };
  },

  subscribe(cb) {
    const ch = sb.channel('seva-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signups' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, cb)
      .subscribe();
    return () => sb.removeChannel(ch);
  },

  async signUp(serviceId, name) {
    const { error } = await sb.rpc('sign_up', { p_service_id: serviceId, p_name: name });
    if (error) throw friendly(error);
  },

  // ---- admin ----
  async getSession() {
    const { data } = await sb.auth.getSession();
    return Boolean(data.session);
  },
  onAuthChange(cb) {
    const { data } = sb.auth.onAuthStateChange((_e, session) => cb(Boolean(session)));
    return () => data.subscription.unsubscribe();
  },
  async signIn(password) {
    const { error } = await sb.auth.signInWithPassword({ email: adminEmail, password });
    fail(error);
  },
  async signOut() { await sb.auth.signOut(); },

  async setProgramDate(date) {
    const { error } = await sb.from('settings').upsert({ id: 1, program_date: date });
    fail(error);
  },
  async addService({ name, description, needed }, sortOrder) {
    const { error } = await sb.from('services').insert({ name, description, needed, sort_order: sortOrder });
    fail(error);
  },
  async updateService(id, { name, description, needed }) {
    const { error } = await sb.from('services').update({ name, description, needed }).eq('id', id);
    fail(error);
  },
  async deleteService(id) {
    const { error } = await sb.from('services').delete().eq('id', id);
    fail(error);
  },
  async removeSignup(id) {
    const { error } = await sb.from('signups').delete().eq('id', id);
    fail(error);
  },
  async resetWeek(newDate) {
    const { error } = await sb.rpc('reset_week', { p_date: newDate });
    fail(error);
  },
};

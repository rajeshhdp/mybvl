import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useProgram } from '../useProgram.js';
import { addDays, formatDate } from '../util.js';

function Login() {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.signIn(pw); } catch { setError('Incorrect password.'); } finally { setBusy(false); }
  }
  return (
    <section className="content narrow">
      <form className="panel" onSubmit={submit}>
        <h1 className="panel-title">Admin Login</h1>
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" value={pw}
          onChange={(e) => setPw(e.target.value)} autoFocus />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !pw}>{busy ? 'Checking…' : 'Enter'}</button>
      </form>
    </section>
  );
}

function Stepper({ value, onChange }) {
  return (
    <div className="stepper">
      <button type="button" className="btn btn-ghost" onClick={() => onChange(Math.max(1, value - 1))} aria-label="Fewer volunteers">−</button>
      <input type="number" min="1" max="100" value={value}
        onChange={(e) => onChange(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))} aria-label="Volunteers needed" />
      <button type="button" className="btn btn-ghost" onClick={() => onChange(Math.min(100, value + 1))} aria-label="More volunteers">+</button>
    </div>
  );
}

function ServiceEditor({ service, run }) {
  const [draft, setDraft] = useState({ name: service.name, description: service.description, needed: service.needed });
  useEffect(() => {
    setDraft({ name: service.name, description: service.description, needed: service.needed });
  }, [service.name, service.description, service.needed]);
  const dirty = draft.name !== service.name || draft.description !== service.description || draft.needed !== service.needed;
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <article className="panel service-editor">
      <label>Service name
        <input value={draft.name} maxLength={80} onChange={(e) => set('name')(e.target.value)} />
      </label>
      <label>Short description
        <input value={draft.description} maxLength={200} onChange={(e) => set('description')(e.target.value)} />
      </label>
      <div className="row">
        <span className="label-inline">Volunteers needed</span>
        <Stepper value={draft.needed} onChange={set('needed')} />
      </div>

      <h4>Signed up ({service.signups.length} of {service.needed})</h4>
      {service.signups.length === 0 && <p className="muted">No one yet.</p>}
      <ul className="admin-names">
        {service.signups.map((s) => (
          <li key={s.id}>
            <span>{s.name}</span>
            <button className="btn btn-danger-ghost" onClick={() => {
              if (window.confirm(`Remove ${s.name} from ${service.name}?`)) run(() => api.removeSignup(s.id));
            }}>Remove</button>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button className="btn btn-primary" disabled={!dirty || !draft.name.trim()}
          onClick={() => run(() => api.updateService(service.id, { name: draft.name.trim(), description: draft.description.trim(), needed: draft.needed }))}>
          Save changes
        </button>
        <button className="btn btn-danger-ghost" onClick={() => {
          if (window.confirm(`Delete "${service.name}" and its ${service.signups.length} signup(s)?`)) run(() => api.deleteService(service.id));
        }}>Delete service</button>
      </div>
    </article>
  );
}

function AddService({ run, nextOrder }) {
  const [f, setF] = useState({ name: '', description: '', needed: 2 });
  return (
    <form className="panel" onSubmit={(e) => {
      e.preventDefault();
      run(() => api.addService({ name: f.name.trim(), description: f.description.trim(), needed: f.needed }, nextOrder))
        .then((ok) => ok && setF({ name: '', description: '', needed: 2 }));
    }}>
      <h3 className="panel-title">Add a service</h3>
      <label>Service name
        <input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </label>
      <label>Short description
        <input value={f.description} maxLength={200} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <div className="row">
        <span className="label-inline">Volunteers needed</span>
        <Stepper value={f.needed} onChange={(n) => setF({ ...f, needed: n })} />
      </div>
      <button className="btn btn-primary btn-block" disabled={!f.name.trim()}>Add service</button>
    </form>
  );
}

function Dashboard() {
  const { loading, error, data, reload } = useProgram();
  const [date, setDate] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (data?.programDate) { setDate(data.programDate); setNextDate(addDays(data.programDate, 7)); }
  }, [data?.programDate]);

  async function run(fn, okMsg = 'Saved ✓') {
    setProblem(''); setNotice('');
    try { await fn(); await reload(); setNotice(okMsg); setTimeout(() => setNotice(''), 2500); return true; }
    catch (e) { setProblem(e.message || 'Something went wrong.'); return false; }
  }

  if (loading) return <p className="status">Loading…</p>;
  if (error && !data) return <p className="status error">Couldn’t load data: {error}</p>;

  const total = data.services.reduce((n, s) => n + s.signups.length, 0);

  return (
    <section className="content admin">
      <div className="admin-top">
        <h1>Manage This Week</h1>
        <button className="btn btn-ghost" onClick={() => api.signOut()}>Sign out</button>
      </div>
      {(notice || problem) && (
        <div className={`toast ${problem ? 'toast-error' : ''}`} role="status">{problem || notice}</div>
      )}

      <div className="panel">
        <h3 className="panel-title">Program date</h3>
        <p className="muted">Currently: {formatDate(data.programDate)}</p>
        <div className="row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-primary" disabled={!date || date === data.programDate}
            onClick={() => run(() => api.setProgramDate(date))}>Save date</button>
        </div>
      </div>

      <h2 className="section-title">Services &amp; volunteers</h2>
      <div className="admin-grid">
        {data.services.map((s) => <ServiceEditor key={s.id} service={s} run={run} />)}
        <AddService run={run} nextOrder={data.services.reduce((m, s) => Math.max(m, s.sort_order || 0), 0) + 1} />
      </div>

      <div className="panel reset">
        <h3 className="panel-title">Prepare next week</h3>
        <p className="muted">Clears all {total} current signup(s) and sets the next program date. Your services stay as they are.</p>
        <div className="row">
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          <button className="btn btn-danger" disabled={!nextDate} onClick={() => {
            if (window.confirm(`Clear ALL signups and set the next program to ${formatDate(nextDate)}?`))
              run(() => api.resetWeek(nextDate), 'New week is ready 🙏');
          }}>Reset week</button>
        </div>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(null);
  useEffect(() => {
    let alive = true;
    api.getSession().then((v) => alive && setAuthed(v));
    const off = api.onAuthChange((v) => setAuthed(v));
    return () => { alive = false; off(); };
  }, []);
  if (authed === null) return <p className="status">Loading…</p>;
  return authed ? <Dashboard /> : <Login />;
}

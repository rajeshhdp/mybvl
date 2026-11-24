import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const NAME_KEY = 'nfw-seva-name';
const readName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };

const MESSAGES = {
  DUPLICATE: 'This name is already signed up for this seva.',
  FULL: 'Sorry, this seva just filled up. Please choose another one. 🙏',
  INVALID_NAME: 'Please enter your name (2–60 characters).',
  NOT_FOUND: 'This seva is no longer available.',
};

export default function SignupModal({ service, onClose, onDone }) {
  const [name, setName] = useState(readName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const input = useRef(null);

  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [done, onClose]);

  async function submit(e) {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 2) { setError(MESSAGES.INVALID_NAME); return; }
    setBusy(true); setError('');
    try {
      await api.signUp(service.id, clean);
      try { localStorage.setItem(NAME_KEY, clean); } catch { /* ignore */ }
      setDone(true);
      onDone();
    } catch (err) {
      setError(MESSAGES[err.code] || 'Something went wrong. Please try again.');
      if (err.code === 'FULL') onDone();
    } finally { setBusy(false); }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {done ? (
          <div className="thanks">
            <div className="thanks-icon">🙏</div>
            <p className="thanks-text">Hare Krishna! Thank you for volunteering for Seva! 🙏</p>
            <p className="muted">{service.name}</p>
            <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="modal-title">{service.name}</h2>
            <label htmlFor="devotee-name">Your Name</label>
            <input
              id="devotee-name" ref={input} type="text" value={name} maxLength={60}
              autoComplete="name" placeholder="Enter your name"
              onChange={(e) => { setName(e.target.value); setError(''); }}
            />
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Signing up…' : 'Confirm Signup'}
            </button>
            <button type="button" className="btn-link" onClick={onClose}>Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
}

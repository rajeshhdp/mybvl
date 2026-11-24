import React, { useState } from 'react';
import { useProgram } from '../useProgram.js';
import { formatDate } from '../util.js';
import SignupModal from './SignupModal.jsx';

function ServiceCard({ service, onSignUp }) {
  const taken = service.signups.length;
  const full = taken >= service.needed;
  const pct = Math.min(100, Math.round((taken / service.needed) * 100));
  return (
    <article className={`card${full ? ' is-full' : ''}`}>
      <h3>{service.name}</h3>
      {service.description && <p className="desc">{service.description}</p>}

      <div className="counts">
        <div><strong>{service.needed}</strong><span>needed</span></div>
        <div><strong>{taken}</strong><span>signed up</span></div>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={service.needed} aria-valuenow={taken}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {taken > 0 && (
        <ul className="names" aria-label={`Volunteers for ${service.name}`}>
          {service.signups.map((s) => <li key={s.id}>🪷 {s.name}</li>)}
        </ul>
      )}

      <button className="btn btn-primary btn-block" disabled={full} onClick={() => onSignUp(service)}>
        {full ? 'Seva Full 🙏' : 'Sign Up'}
      </button>
    </article>
  );
}

export default function DevoteePage() {
  const { loading, error, data, reload } = useProgram();
  const [active, setActive] = useState(null);

  return (
    <>
      <section className="hero">
        <h1>Weekly Seva Signup</h1>
        <p className="subtitle">“Let’s come together and serve Sri Krishna with love and devotion!”</p>
        <div className="date-pill">
          <span className="date-label">Next Program</span>
          <span className="date-value">{data ? formatDate(data.programDate) : '…'}</span>
        </div>
      </section>

      <section className="content">
        {loading && <p className="status">Loading seva opportunities…</p>}
        {error && !data && <p className="status error">Couldn’t load the program. Please check your connection and refresh.</p>}
        {data && data.services.length === 0 && <p className="status">No seva opportunities are listed yet. Please check back soon. 🙏</p>}
        {data && (
          <>
            <h2 className="section-title">Seva Opportunities</h2>
            <div className="grid">
              {data.services.map((s) => <ServiceCard key={s.id} service={s} onSignUp={setActive} />)}
            </div>
          </>
        )}
      </section>

      {active && (
        <SignupModal
          service={data.services.find((s) => s.id === active.id) || active}
          onClose={() => setActive(null)}
          onDone={reload}
        />
      )}
    </>
  );
}

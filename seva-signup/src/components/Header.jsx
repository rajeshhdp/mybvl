import React from 'react';
import Logo from './Logo.jsx';

export default function Header({ admin }) {
  return (
    <header className="site-header">
      <a href="#/" className="brand" aria-label="North Fort Worth Bhakti Center home">
        <Logo />
        <span className="brand-text">
          <span className="brand-top">North Fort Worth</span>
          <span className="brand-main">Bhakti Center</span>
        </span>
      </a>
      {admin && <span className="badge">Admin</span>}
    </header>
  );
}

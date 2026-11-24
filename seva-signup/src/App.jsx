import React, { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import DevoteePage from './components/DevoteePage.jsx';
import AdminPage from './components/AdminPage.jsx';

const route = () => (window.location.hash.startsWith('#/admin') ? 'admin' : 'home');

export default function App() {
  const [page, setPage] = useState(route());
  useEffect(() => {
    const on = () => { setPage(route()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  return (
    <>
      <Header admin={page === 'admin'} />
      <main>{page === 'admin' ? <AdminPage /> : <DevoteePage />}</main>
      <footer className="footer">
        <p>🪷 North Fort Worth Bhakti Center</p>
        {page === 'admin'
          ? <a href="#/">← Back to Seva Signup</a>
          : <a href="#/admin" className="admin-link">Admin</a>}
      </footer>
    </>
  );
}

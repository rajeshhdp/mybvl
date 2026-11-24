import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Loads the week's program and keeps it live (realtime + refresh on tab focus).
export function useProgram() {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    try {
      const data = await api.fetchProgram();
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || 'Could not load the program.' }));
    }
  }, []);

  useEffect(() => {
    load();
    let t;
    const unsub = api.subscribe(() => { clearTimeout(t); t = setTimeout(load, 120); });
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    const poll = setInterval(load, 60000); // safety net if realtime drops
    return () => { clearTimeout(t); unsub(); document.removeEventListener('visibilitychange', onVis); clearInterval(poll); };
  }, [load]);

  return { ...state, reload: load };
}

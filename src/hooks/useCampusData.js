import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { buildIndex } from '../lib/search.js';

export function useCampusData() {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    api.campus()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err.message }));
  }, []);

  useEffect(load, [load]);

  const derived = useMemo(() => {
    const places = state.data?.places || [];
    const byId = new Map(places.map((p) => [p.id, p]));
    return { places, byId, index: buildIndex(places, byId) };
  }, [state.data]);

  return { ...state, ...derived, reload: load };
}

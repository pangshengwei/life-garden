'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyDay, type Day, type GardenData } from './model';
export function useGarden() {
  const [data, setData] = useState<GardenData | null>(null);
  const [status, setStatus] = useState('Opening your garden…');
  const [error, setError] = useState('');
  const [paths, setPaths] = useState({ dbPath: '', mirrorPath: '' });
  const [mirrorError, setMirrorError] = useState('');
  const [hosted, setHosted] = useState(false);
  const hostedRef = useRef(false);
  const live = useRef<GardenData | null>(null),
    saved = useRef<GardenData | null>(null),
    revision = useRef(0),
    working = useRef(false),
    conflict = useRef(false);
  const sync = useCallback(async function persist() {
    if (working.current || conflict.current || !live.current || live.current === saved.current)
      return;
    working.current = true;
    setStatus('Saving…');
    try {
      while (live.current !== saved.current) {
        const snapshot = live.current;
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: snapshot, baseRevision: revision.current }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 409) conflict.current = true;
          throw new Error(result.error || 'Could not save.');
        }
        revision.current = result.revision;
        saved.current = snapshot;
        setMirrorError(result.mirrorError || '');
      }
      setError('');
      setStatus(hostedRef.current ? 'Saved securely' : 'Saved locally');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setStatus('Unsaved changes');
    } finally {
      working.current = false;
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/state', { cache: 'no-store' })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        if (active) {
          live.current = saved.current = result.data;
          revision.current = result.revision;
          setData(result.data);
          setPaths(result);
          setMirrorError(result.mirrorError || '');
          hostedRef.current = Boolean(result.hosted);
          setHosted(hostedRef.current);
          setStatus(hostedRef.current ? 'Saved securely' : 'Saved locally');
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setStatus('Could not open garden');
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => void sync(), 350);
    return () => clearTimeout(timer);
  }, [data, sync]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (live.current !== saved.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, []);
  const update = useCallback((change: (draft: GardenData) => void) => {
    if (!live.current) return;
    const next = structuredClone(live.current);
    change(next);
    live.current = next;
    setData(next);
    setStatus(conflict.current ? 'Unsaved changes' : 'Saving…');
  }, []);
  const updateDay = useCallback(
    (date: string, patch: Partial<Day>) =>
      update((d) => {
        d.days[date] = { ...emptyDay(), ...d.days[date], ...patch };
      }),
    [update],
  );
  return { data, update, updateDay, status, error, paths, mirrorError, hosted, retry: sync };
}

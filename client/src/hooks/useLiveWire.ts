// ===========================================================================
// useLiveWire: the data behind the Live Wire panel.
// ---------------------------------------------------------------------------
// Listens to the server's log stream:
//   "server:logs"  history sent once on connect -> fills the list, no animation
//   "server:log"   each new event -> added to the list AND, if it has
//                  `meta`, queued as an animation for the diagram
//
// The list is newest-first, capped at 200. "Pause" freezes the list (new
// lines are held back and counted) but the diagram keeps animating.
// Animations remove themselves after they've played.
// ===========================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLogSnapshot, socket, type LogEntry } from '../lib/socket';

export type WireCategory = 'message' | 'typing' | 'presence' | 'system';
export type WireFilter = 'all' | WireCategory;

/** A log line plus a stable id for React keys. */
export interface WireEntry extends LogEntry {
  id: number;
  category: WireCategory;
  /** true for warnings/errors that aren't about a known event type */
  alert: boolean;
}

/** One thing to draw on the diagram. */
export interface WireAnimation {
  id: number;
  /** "travel" = dot from -> server -> to, "pulse" = ring on a node */
  kind: 'travel' | 'pulse';
  category: WireCategory;
  alert: boolean;
  from?: string;
  to?: string;
}

const MAX_ENTRIES = 200;
export const TRAVEL_MS = 1400;
export const PULSE_MS = 1200;

// meta.type -> list category. register counts as presence.
function categorize(e: LogEntry): WireCategory {
  switch (e.meta?.type) {
    case 'message':
      return 'message';
    case 'typing':
      return 'typing';
    case 'presence':
    case 'register':
      return 'presence';
    default:
      return 'system';
  }
}

let seq = 1;
function toWire(e: LogEntry): WireEntry {
  const category = categorize(e);
  return { ...e, id: seq++, category, alert: category === 'system' && (e.level === 'warn' || e.level === 'error') };
}

export function useLiveWire() {
  const [entries, setEntries] = useState<WireEntry[]>([]);
  const [held, setHeld] = useState<WireEntry[]>([]); // arrived while paused
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<WireFilter>('all');
  const [animations, setAnimations] = useState<WireAnimation[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Queue an animation and drop it again once it has played.
  const animate = useCallback((a: Omit<WireAnimation, 'id'>) => {
    const id = seq++;
    setAnimations((list) => [...list.slice(-24), { ...a, id }]); // cap in-flight
    setTimeout(
      () => setAnimations((list) => list.filter((x) => x.id !== id)),
      a.kind === 'travel' ? TRAVEL_MS + 150 : PULSE_MS + 150,
    );
  }, []);

  useEffect(() => {
    // Catch up on anything that arrived before we subscribed (the history
    // is often sent before React mounts). See getLogSnapshot in lib/socket.
    setEntries(getLogSnapshot().map(toWire).reverse().slice(0, MAX_ENTRIES));

    // History: replace the list (e.g. after a reconnect), newest first.
    const onHistory = (list: LogEntry[]) => {
      setEntries(list.map(toWire).reverse().slice(0, MAX_ENTRIES));
      setHeld([]);
    };

    const onLog = (e: LogEntry) => {
      const w = toWire(e);
      if (pausedRef.current) setHeld((h) => [w, ...h].slice(0, MAX_ENTRIES));
      else setEntries((list) => [w, ...list].slice(0, MAX_ENTRIES));

      // Turn structured events into diagram animations.
      const m = e.meta;
      if (!m) return;
      if ((m.type === 'message' || m.type === 'typing') && m.from && m.to) {
        animate({ kind: 'travel', category: w.category, alert: false, from: m.from, to: m.to });
      } else if ((m.type === 'presence' || m.type === 'register') && m.from) {
        animate({ kind: 'pulse', category: 'presence', alert: false, from: m.from });
      } else if (m.type === 'system') {
        animate({ kind: 'pulse', category: 'system', alert: w.alert }); // ripple on the server
      }
    };

    socket.on('server:logs', onHistory);
    socket.on('server:log', onLog);
    return () => {
      socket.off('server:logs', onHistory);
      socket.off('server:log', onLog);
    };
  }, [animate]);

  // Un-pausing releases everything that was held back.
  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (p) {
        setHeld((h) => {
          if (h.length) setEntries((list) => [...h, ...list].slice(0, MAX_ENTRIES));
          return [];
        });
      }
      return !p;
    });
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.category === filter)),
    [entries, filter],
  );

  return { entries: visible, heldCount: held.length, paused, togglePause, filter, setFilter, animations };
}

export type LiveWireApi = ReturnType<typeof useLiveWire>;

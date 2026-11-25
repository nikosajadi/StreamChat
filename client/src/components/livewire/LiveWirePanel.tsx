// ===========================================================================
// LiveWirePanel: "Live Wire", the event-flow view.
// ---------------------------------------------------------------------------
// Top: the diagram (WireDiagram). Below: the raw event log in mono, newest
// first, with filter chips (All / Messages / Typing / Presence / System)
// and a pause button. Pausing freezes the list only; the diagram keeps
// moving. Everything shown here comes from "server:log" entries, which
// never contain message text or tokens.
// ===========================================================================
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, X } from 'lucide-react';
import type { PublicUser } from '../../lib/socket';
import type { LiveWireApi, WireFilter } from '../../hooks/useLiveWire';
import { WireDiagram } from './WireDiagram';
import { CATEGORY_LABEL, wireColor } from './wireColors';

const FILTERS: [WireFilter, string][] = [
  ['all', 'All'],
  ['message', 'Messages'],
  ['typing', 'Typing'],
  ['presence', 'Presence'],
  ['system', 'System'],
];

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

interface Props {
  wire: LiveWireApi;
  users: PublicUser[];
  me: string;
  onClose: () => void;
}

export function LiveWirePanel({ wire, users, me, onClose }: Props) {
  const { entries, heldCount, paused, togglePause, filter, setFilter, animations } = wire;

  return (
    <section aria-labelledby="livewire-title" className="flex h-full min-h-0 flex-col bg-paper">
      {/* ---- header ---- */}
      <div className="flex items-center gap-2 px-5 pb-2 pt-4">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <h2 id="livewire-title" className="label text-ink">
          Live Wire
        </h2>
        <span className="font-mono text-[11px] text-ink-muted">· what the server sees</span>
        <button type="button" onClick={onClose} className="icon-btn ml-auto h-8 w-8" aria-label="Close Live Wire">
          <X size={16} />
        </button>
      </div>

      {/* ---- diagram ---- */}
      <div className="px-3">
        <WireDiagram users={users} me={me} animations={animations} />
      </div>

      {/* ---- legend ---- */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-3 font-mono text-[10.5px] text-ink-muted" aria-label="Legend">
        {(['message', 'typing', 'presence'] as const).map((c) => (
          <li key={c} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: wireColor(c) }} aria-hidden="true" />
            {CATEGORY_LABEL[c]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: wireColor('system', true) }} aria-hidden="true" />
          Warning
        </li>
      </ul>

      {/* ---- controls ---- */}
      <div className="flex items-start gap-2 border-y border-hair px-4 py-2">
        <div role="radiogroup" aria-label="Filter events" className="flex min-w-0 flex-1 flex-wrap gap-1">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors ${
                filter === value ? 'bg-ink text-paper' : 'text-ink-muted hover:bg-paper-2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={togglePause}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hair px-2.5 py-1 text-xs ${
            paused ? 'bg-paper-3 text-ink' : 'text-ink-muted hover:text-ink'
          }`}
          aria-pressed={paused}
        >
          {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
          {paused ? (heldCount ? `Resume (${heldCount} new)` : 'Resume') : 'Pause'}
        </button>
      </div>

      {/* ---- event log ---- */}
      <ol className="min-h-0 flex-1 overflow-y-auto px-4 py-2 font-mono text-[11.5px] leading-snug" aria-label="Event log, newest first">
        {entries.length === 0 && <li className="py-6 text-center font-sans text-sm text-ink-muted">Nothing here yet.</li>}
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-2 border-b border-dashed border-hair py-1.5"
            >
              <time className="shrink-0 text-ink-muted" dateTime={new Date(e.time).toISOString()}>
                {timeFmt.format(e.time)}
              </time>
              <span className="inline-flex w-[70px] shrink-0 items-center gap-1 uppercase tracking-wide text-ink-muted" title={e.level}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: wireColor(e.category, e.alert) }} aria-hidden="true" />
                {e.alert ? 'warn' : CATEGORY_LABEL[e.category]}
              </span>
              <span className="min-w-0 break-words text-ink">{e.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}

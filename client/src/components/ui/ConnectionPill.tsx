// ===========================================================================
// ConnectionPill: always-visible socket status (Connecting / Connected /
// Reconnecting / Offline). Read out by screen readers when it changes.
// ===========================================================================
import type { ConnectionState } from '../../hooks/useConnection';

const LABEL: Record<ConnectionState, string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

const DOT: Record<ConnectionState, string> = {
  connecting: 'bg-sand animate-pulse',
  connected: 'bg-online',
  reconnecting: 'bg-accent animate-pulse',
  offline: 'bg-danger',
};

export function ConnectionPill({ state }: { state: ConnectionState }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-hair px-2.5 py-1 font-mono text-[11px] text-ink-muted"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[state]}`} aria-hidden="true" />
      {LABEL[state]}
    </span>
  );
}

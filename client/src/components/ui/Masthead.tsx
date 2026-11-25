// ===========================================================================
// Masthead: the slim bar across the top, like a newspaper nameplate.
// App name, connection status, Live Wire toggle and theme toggle.
// ===========================================================================
import { Activity } from 'lucide-react';
import type { ConnectionState } from '../../hooks/useConnection';
import type { Theme } from '../../hooks/useTheme';
import { ConnectionPill } from './ConnectionPill';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  connection: ConnectionState;
  theme: Theme;
  onToggleTheme: () => void;
  liveWireOpen: boolean;
  onToggleLiveWire: () => void;
}

export function Masthead({ connection, theme, onToggleTheme, liveWireOpen, onToggleLiveWire }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-hair px-4 sm:px-5">
      <p className="font-display text-[22px] font-medium tracking-tight text-ink">
        Stream<span className="italic text-accent-ink">chat</span>
      </p>
      <span className="hidden h-4 w-px bg-ink/15 sm:block" aria-hidden="true" />
      <span className="label hidden sm:block">Vol. 2 · Live edition</span>

      <div className="ml-auto flex items-center gap-1.5">
        <ConnectionPill state={connection} />
        <button
          type="button"
          onClick={onToggleLiveWire}
          className={`icon-btn ${liveWireOpen ? 'bg-paper-3 text-accent' : ''}`}
          aria-label={liveWireOpen ? 'Hide Live Wire' : 'Show Live Wire'}
          aria-pressed={liveWireOpen}
          title="Live Wire"
        >
          <Activity size={17} />
        </button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}

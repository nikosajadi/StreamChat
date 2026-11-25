// ===========================================================================
// Small line drawings for empty states. Hand-drawn feel: uneven strokes,
// round caps, one accent color. All decorative (aria-hidden).
// ===========================================================================
import type { ReactNode } from 'react';

const base = {
  width: 120,
  height: 96,
  viewBox: '0 0 120 96',
  fill: 'none',
  'aria-hidden': true,
  className: 'text-ink-muted',
} as const;

/** Two speech bubbles: "no conversation selected". */
export function ArtConversation() {
  return (
    <svg {...base}>
      <path d="M14 22c0-7 5-11 12-11h42c7 0 11 4 11 11v18c0 7-4 11-11 11H40l-13 11 2-11h-3c-7 0-12-4-12-11z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 46h36c7 0 12 4 12 11v13c0 7-5 11-12 11h-2l2 9-11-9H64c-6 0-10-3-11-8" className="text-accent" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 27h30M28 35h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** An empty address-book page: "no contacts yet". */
export function ArtContacts() {
  return (
    <svg {...base}>
      <path d="M30 10h56c4 0 7 3 7 7v62c0 4-3 7-7 7H30c-4 0-7-3-7-7V17c0-4 3-7 7-7z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="58" cy="38" r="10" className="text-accent" stroke="currentColor" strokeWidth="1.6" />
      <path d="M41 66c3-9 10-13 17-13s14 4 17 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 24h8M18 40h8M18 56h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A paper plane: "no messages yet". */
export function ArtFirstMessage() {
  return (
    <svg {...base}>
      <path d="M16 52 102 18 78 82 58 62 16 52z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M102 18 58 62l-3 18 11-12" className="text-accent" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M10 76c8-4 16-3 22 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 5" />
    </svg>
  );
}

/** A magnifier over nothing: "no search results". */
export function ArtNoResults() {
  return (
    <svg {...base}>
      <circle cx="52" cy="42" r="22" stroke="currentColor" strokeWidth="1.6" />
      <path d="m68 58 20 20" className="text-accent" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M44 42h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Generic empty state block: drawing + one line of text (+ optional hint). */
export function EmptyState({ art, title, hint }: { art: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      {art}
      <p className="font-display text-lg text-ink">{title}</p>
      {hint && <p className="max-w-[26ch] text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

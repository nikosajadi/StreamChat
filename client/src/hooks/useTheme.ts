// ===========================================================================
// useTheme: "paper" (light) or "night" (dark).
// ---------------------------------------------------------------------------
// First visit follows the OS setting (prefers-color-scheme). Once the user
// toggles, the choice is saved in localStorage and wins from then on.
// The class on <html> is what Tailwind's `dark:` and index.css listen to.
// index.html runs the same check inline before paint to avoid a flash.
// ===========================================================================
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'paper' | 'night';
const KEY = 'streamchat:theme';

function readSaved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'paper' || v === 'night' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readSaved() ?? systemTheme());

  // Keep the <html> class in sync with state.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'night');
  }, [theme]);

  // Follow OS changes only while the user hasn't picked one themselves.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => {
      if (!readSaved()) setTheme(mq.matches ? 'night' : 'paper');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'paper' ? 'night' : 'paper';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* storage blocked: the choice just won't survive a reload */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}

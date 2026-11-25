// ===========================================================================
// Design tokens: the ONE place colors, fonts and radii are defined.
// ---------------------------------------------------------------------------
// Colors point at CSS variables (set in src/index.css for the "Paper" and
// "Night ink" themes), stored as "R G B" so Tailwind's opacity modifiers
// work, e.g. `bg-ink/10` or `border-rule`. Components only ever use these
// names, never raw hex values, so a theme change happens in index.css only.
// ===========================================================================
import type { Config } from 'tailwindcss';

// Helper: a color that reads from a CSS variable and supports /opacity.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // the <html> element gets class="dark" for Night ink
  theme: {
    extend: {
      colors: {
        paper: v('paper'), // page background
        'paper-2': v('paper-2'), // slightly darker paper (their bubbles, cards)
        'paper-3': v('paper-3'), // hover / pressed tone
        ink: v('ink'), // main text
        'ink-muted': v('ink-muted'), // secondary text (still AA contrast)
        accent: v('accent'), // terracotta
        'accent-deep': v('accent-deep'), // my bubbles (white text passes AA)
        'accent-ink': v('accent-ink'), // terracotta for small text (AA)
        indigo: v('indigo'), // secondary accent
        sand: v('sand'),
        danger: v('danger'), // muted red for warnings / errors
        online: v('online'),
      },
      borderColor: {
        hair: 'rgb(var(--ink) / 0.12)', // the thin printed-page rule
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      borderRadius: {
        bubble: '18px',
        card: '20px',
      },
      letterSpacing: {
        label: '0.14em', // small uppercase labels like CONTACTS / LIVE WIRE
      },
      boxShadow: {
        card: '0 1px 0 rgb(var(--ink) / 0.04), 0 18px 50px -20px rgb(var(--ink) / 0.25)',
      },
      keyframes: {
        blink: {
          '0%, 80%, 100%': { opacity: '0.25' },
          '40%': { opacity: '1' },
        },
      },
      animation: {
        blink: 'blink 1.2s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

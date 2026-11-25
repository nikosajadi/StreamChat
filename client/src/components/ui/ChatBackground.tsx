// ===========================================================================
// ChatBackground: the artwork behind the messages.
// ---------------------------------------------------------------------------
// By default it draws a generative "watercolor" piece in code: a few large,
// blurred organic shapes in terracotta, indigo and sand, at very low opacity
// so the messages on top stay easy to read in both themes.
//
// To use a picture instead, just drop a file at:
//     client/src/assets/art/wallpaper.jpg
// It's picked up automatically at build time (import.meta.glob finds it if
// it exists and returns nothing if it doesn't), and shown softly faded.
// Nothing else needs to change.
// ===========================================================================
import { useMemo } from 'react';
import { blobPath, seeded } from '../../lib/art';

// Optional wallpaper. eager + ?url gives us its final URL, or {} if missing.
const wallpapers = import.meta.glob('../../assets/art/wallpaper.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const WALLPAPER_URL: string | undefined = Object.values(wallpapers)[0];

// Fixed seed: everyone sees the same piece. Change it for a new composition.
const SEED = 20261124;

export function ChatBackground() {
  if (WALLPAPER_URL) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.12] dark:opacity-[0.10]"
        style={{ backgroundImage: `url(${WALLPAPER_URL})` }}
      />
    );
  }
  return <GenerativeArt />;
}

/** The default piece: soft blurred blobs, drawn once per page load. */
function GenerativeArt() {
  const shapes = useMemo(() => {
    const rand = seeded(SEED);
    // [css color var, center x, center y, radius]
    const layout: [string, number, number, number][] = [
      ['--accent', 180, 160, 210],
      ['--indigo', 820, 260, 260],
      ['--sand', 420, 640, 280],
      ['--accent', 900, 820, 200],
      ['--indigo', 120, 900, 180],
      ['--sand', 620, 120, 150],
    ];
    return layout.map(([color, x, y, r]) => ({
      color,
      d: blobPath(rand, x, y, r, 8, 0.32),
      // a second, smaller "bloom" inside each shape for a layered wash
      d2: blobPath(rand, x + (rand() - 0.5) * r * 0.5, y + (rand() - 0.5) * r * 0.5, r * 0.55, 6, 0.3),
    }));
  }, []);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16] dark:opacity-[0.12]"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Blur + a little turbulence on the edges = watercolor bleed. */}
        <filter id="wash" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="40" result="bled" />
          <feGaussianBlur in="bled" stdDeviation="28" />
        </filter>
      </defs>
      <g filter="url(#wash)">
        {shapes.map((s, i) => (
          <g key={i} style={{ fill: `rgb(var(${s.color}))` }}>
            <path d={s.d} opacity="0.55" />
            <path d={s.d2} opacity="0.5" />
          </g>
        ))}
      </g>
    </svg>
  );
}

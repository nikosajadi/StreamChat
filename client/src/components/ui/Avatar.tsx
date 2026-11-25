// ===========================================================================
// Avatar: a hand-drawn-looking blob with a soft watercolor fill and the
// first letter in the serif font. Generated from the name, so the same
// name always gets the same shape and colors.
// ===========================================================================
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AVATAR_PALETTES, blobPath, hash, seeded } from '../../lib/art';

interface Props {
  name: string;
  size?: number;
  /** undefined = no status dot; true/false = green / grey dot */
  online?: boolean;
  className?: string;
}

export function Avatar({ name, size = 40, online, className = '' }: Props) {
  // Pulse only when the status flips offline -> online, not on first render
  // (otherwise every contact would pulse when the list loads).
  const prevOnline = useRef(online);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (prevOnline.current === false && online === true) setPulse((p) => p + 1);
    prevOnline.current = online;
  }, [online]);

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="block">
        <AvatarShape name={name} />
      </svg>

      {online !== undefined && (
        <span className="absolute bottom-0 right-0 grid place-items-center" style={{ width: size * 0.32, height: size * 0.32 }}>
          {/* Pulse ring: a new key each time they come online re-plays it. */}
          {online && pulse > 0 && (
            <motion.span
              key={pulse}
              className="absolute inset-0 rounded-full bg-online"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            />
          )}
          <span
            className={`relative block h-full w-full rounded-full border-2 border-paper ${online ? 'bg-online' : 'bg-ink-muted/50'}`}
          />
        </span>
      )}
    </span>
  );
}

/**
 * The avatar drawing itself, in a 100x100 box, with no outer <svg>.
 * Used by <Avatar> and placed directly inside the Live Wire diagram.
 */
export function AvatarShape({ name }: { name: string }) {
  const uid = useId().replace(/:/g, '');

  // Shape + colors only change when the name changes.
  const art = useMemo(() => {
    const h = hash(name);
    const rand = seeded(h);
    const [light, deep] = AVATAR_PALETTES[h % AVATAR_PALETTES.length]!;
    return {
      outer: blobPath(rand, 50, 50, 47, 7, 0.14),
      inner: blobPath(rand, 46 + rand() * 8, 44 + rand() * 8, 30, 6, 0.25),
      light,
      deep,
      gx: 30 + rand() * 25, // where the light "pools"
      gy: 25 + rand() * 25,
    };
  }, [name]);

  // First visible character (works for emoji and non-Latin names too).
  const initial = Array.from(name)[0]?.toUpperCase() ?? '?';

  return (
    <>
      <defs>
        <radialGradient id={`g${uid}`} cx={`${art.gx}%`} cy={`${art.gy}%`} r="80%">
          <stop offset="0%" stopColor={art.light} />
          <stop offset="70%" stopColor={art.deep} stopOpacity="0.75" />
          <stop offset="100%" stopColor={art.deep} stopOpacity="0.95" />
        </radialGradient>
      </defs>
      {/* outer wash */}
      <path d={art.outer} fill={`url(#g${uid})`} />
      {/* lighter inner pool, like a second watercolor layer */}
      <path d={art.inner} fill={art.light} opacity="0.45" />
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Fraunces, Georgia, serif"
        fontSize="44"
        fontWeight="500"
        fill="#1F1B16"
        fillOpacity="0.85"
      >
        {initial}
      </text>
    </>
  );
}

// ===========================================================================
// WireDiagram: the server in the middle, users around it, and the traffic.
// ---------------------------------------------------------------------------
// - Every known user is a node on an ellipse around the server (sorted by
//   name so nodes don't jump around). Offline users are faded.
// - "travel" animations: a small glowing dot goes sender -> server ->
//   recipient (terracotta for messages, a smaller grey one for typing).
// - "pulse" animations: a ring grows out of a user node (presence/register,
//   indigo) or out of the server (system events, red for warnings).
// - With prefers-reduced-motion nothing moves: the involved nodes just get
//   a colored ring while the event is "live".
// ===========================================================================
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PublicUser } from '../../lib/socket';
import { PULSE_MS, TRAVEL_MS, type WireAnimation } from '../../hooks/useLiveWire';
import { AvatarShape } from '../ui/Avatar';
import { wireColor } from './wireColors';

const W = 340;
const H = 250;
const CX = W / 2;
const CY = H / 2 - 4;
const NODE = 30; // avatar size in the diagram
const MAX_NODES = 14;

interface Props {
  users: PublicUser[];
  me: string;
  animations: WireAnimation[];
}

export function WireDiagram({ users, me, animations }: Props) {
  const reduced = useReducedMotion();

  // Pick who to show (online first if there are too many), then place them
  // around an ellipse in name order.
  const nodes = useMemo(() => {
    const picked = [...users]
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
      .slice(0, MAX_NODES)
      .sort((a, b) => a.name.localeCompare(b.name));
    const n = picked.length;
    const map = new Map<string, { x: number; y: number; user: PublicUser }>();
    picked.forEach((user, i) => {
      const a = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      map.set(user.name, { x: CX + Math.cos(a) * 128, y: CY + Math.sin(a) * 88, user });
    });
    return map;
  }, [users]);

  // Nodes involved in a live event (used for the reduced-motion highlight).
  const highlighted = useMemo(() => {
    const h = new Map<string, string>();
    for (const a of animations) {
      const c = wireColor(a.category, a.alert);
      if (a.from) h.set(a.from, c);
      if (a.to) h.set(a.to, c);
      if (a.kind === 'travel' || !a.from) h.set('__server', c);
    }
    return h;
  }, [animations]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Live diagram: server in the middle with ${nodes.size} users around it. Dots show messages and typing moving through the server.`}
    >
      <defs>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ---- wires from each user to the server ---- */}
      {[...nodes.values()].map(({ x, y, user }) => (
        <line
          key={`wire-${user.name}`}
          x1={x}
          y1={y}
          x2={CX}
          y2={CY}
          stroke="rgb(var(--ink))"
          strokeOpacity={user.online ? 0.16 : 0.07}
          strokeDasharray={user.online ? undefined : '2 4'}
          strokeWidth={1}
        />
      ))}

      {/* ---- the server ---- */}
      <g>
        {reduced && highlighted.has('__server') && (
          <circle cx={CX} cy={CY} r={27} fill="none" stroke={highlighted.get('__server')} strokeWidth={2} />
        )}
        <circle cx={CX} cy={CY} r={22} fill="rgb(var(--paper-2))" stroke="rgb(var(--ink))" strokeOpacity={0.25} />
        <circle cx={CX} cy={CY} r={15} fill="none" stroke="rgb(var(--ink))" strokeOpacity={0.12} strokeDasharray="1 3" />
        <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="central" fontFamily="Fraunces, serif" fontSize="11" fontStyle="italic" fill="rgb(var(--ink))">
          io
        </text>
        <text x={CX} y={CY + 34} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7.5" letterSpacing="1.4" fill="rgb(var(--ink-muted))">
          SERVER
        </text>
      </g>

      {/* ---- user nodes ---- */}
      {[...nodes.values()].map(({ x, y, user }) => {
        const ring = reduced ? highlighted.get(user.name) : undefined;
        return (
          <g key={`node-${user.name}`} opacity={user.online ? 1 : 0.38}>
            {ring && <circle cx={x} cy={y} r={NODE / 2 + 5} fill="none" stroke={ring} strokeWidth={2} />}
            {user.name === me && (
              <circle cx={x} cy={y} r={NODE / 2 + 3} fill="none" stroke="rgb(var(--accent))" strokeOpacity={0.6} strokeDasharray="2 2" />
            )}
            <svg x={x - NODE / 2} y={y - NODE / 2} width={NODE} height={NODE} viewBox="0 0 100 100" overflow="visible">
              <AvatarShape name={user.name} />
            </svg>
            <text x={x} y={y + NODE / 2 + 10} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8.5" fill="rgb(var(--ink-muted))">
              {user.name.length > 11 ? `${user.name.slice(0, 10)}…` : user.name}
              {user.name === me ? ' (you)' : ''}
            </text>
          </g>
        );
      })}

      {/* ---- moving traffic (skipped entirely with reduced motion) ---- */}
      {!reduced &&
        animations.map((a) => {
          const color = wireColor(a.category, a.alert);

          if (a.kind === 'travel') {
            const from = a.from ? nodes.get(a.from) : undefined;
            const to = a.to ? nodes.get(a.to) : undefined;
            if (!from || !to) return null;
            const small = a.category === 'typing';
            const path = { cx: [from.x, CX, to.x], cy: [from.y, CY, to.y] };
            const t = { duration: TRAVEL_MS / 1000, times: [0, 0.5, 1], ease: 'easeInOut' as const };
            return (
              <g key={a.id}>
                <motion.circle r={small ? 6 : 10} fill={color} opacity={0.45} filter="url(#glow)" initial={{ cx: from.x, cy: from.y }} animate={path} transition={t} />
                <motion.circle r={small ? 2.5 : 4} fill={color} initial={{ cx: from.x, cy: from.y }} animate={path} transition={t} />
              </g>
            );
          }

          // pulse: on a user node, or on the server when there's no user
          const at = a.from ? nodes.get(a.from) : { x: CX, y: CY };
          if (!at) return null;
          const r0 = a.from ? NODE / 2 : 22;
          return (
            <motion.circle
              key={a.id}
              cx={at.x}
              cy={at.y}
              fill="none"
              stroke={color}
              strokeWidth={2}
              initial={{ r: r0, opacity: 0.85 }}
              animate={{ r: r0 + 16, opacity: 0 }}
              transition={{ duration: PULSE_MS / 1000, ease: 'easeOut' }}
            />
          );
        })}
    </svg>
  );
}

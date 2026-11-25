// Colors per Live Wire event type, as CSS (theme-aware via variables).
// message = terracotta, typing = grey, presence = indigo,
// warnings/errors = muted red, other system events = sand.
import type { WireCategory } from '../../hooks/useLiveWire';

export function wireColor(category: WireCategory, alert = false): string {
  if (alert) return 'rgb(var(--danger))';
  switch (category) {
    case 'message':
      return 'rgb(var(--accent))';
    case 'typing':
      return 'rgb(var(--ink-muted))';
    case 'presence':
      return 'rgb(var(--indigo))';
    case 'system':
      return 'rgb(var(--sand))';
  }
}

export const CATEGORY_LABEL: Record<WireCategory, string> = {
  message: 'Message',
  typing: 'Typing',
  presence: 'Presence',
  system: 'System',
};

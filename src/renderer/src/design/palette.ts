/**
 * Brand palette colorways (v0.5.x) — which signature color the chrome wears:
 * gold (default), teal, or ember. Same pattern as design/theme.ts: a
 * `data-cth-palette` stamp on <html>, tokens.css carries the overrides,
 * localStorage persists. Orthogonal to light/dark (that axis keeps working;
 * each colorway ships both themes).
 *
 * Scope is DELIBERATE: only --cth-brand / --cth-brand-light move (titlebar
 * rule, boss accents, CTA highlights, selection). Status hues keep their
 * meaning in every colorway, and the Pixi floor (baked tile art + static
 * token mirror) stays gold — documented, not forgotten.
 */
import { useSyncExternalStore } from 'react';

export type AppPalette = 'gold' | 'teal' | 'ember';

export const PALETTES: { id: AppPalette; swatch: string }[] = [
  { id: 'gold', swatch: '#F4D35E' },
  { id: 'teal', swatch: '#2FA08C' },
  { id: 'ember', swatch: '#D2674A' },
];

const LS_KEY = 'cth.palette';

function load(): AppPalette {
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === 'teal' || v === 'ember' || v === 'gold') return v;
  } catch { /* noop */ }
  return 'gold';
}

let palette: AppPalette = load();
const subscribers = new Set<() => void>();

function apply(): void {
  try { document.documentElement.dataset.cthPalette = palette; } catch { /* SSR/tests */ }
}
apply();

export function appPalette(): AppPalette {
  return palette;
}

export function setAppPalette(next: AppPalette): void {
  if (next === palette) return;
  palette = next;
  try { window.localStorage.setItem(LS_KEY, next); } catch { /* noop */ }
  apply();
  subscribers.forEach((fn) => fn());
}

export function useAppPalette(): AppPalette {
  return useSyncExternalStore(
    (onChange) => {
      subscribers.add(onChange);
      return () => subscribers.delete(onChange);
    },
    () => palette
  );
}

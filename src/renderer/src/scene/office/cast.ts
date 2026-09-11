// The toodooo floor team — roster metadata + sprite frames.
//
// Both the static portraits (cards / picker) and the in-scene walking sprites are
// now fully custom-drawn from the same per-character recipes in portraitArt.ts:
// the scene sprite reuses the portrait's exact head/face/clothing and adds legs,
// so an agent on the office floor looks identical to its card. `name` ids are
// stable keys (persisted on agents, matched by voice-hire inference) — the
// display names, blurbs and shirts below are toodooo's own team.

import { Texture } from 'pixi.js';
import { paintPortrait, sceneFrameBufs, SCENE_W, SCENE_H } from './portraitArt';

export type OfficeCharacterName =
  | 'michael' | 'jim' | 'pam' | 'dwight' | 'kevin' | 'angela'
  | 'oscar' | 'stanley' | 'phyllis' | 'andy' | 'kelly' | 'ryan'
  | 'toby' | 'creed' | 'meredith';

export interface CastMember {
  name: OfficeCharacterName;
  displayName: string;
  /** Signature accent color (hex) — used for the in-scene selection glow. */
  shirt: string;
  /** Blurb shown when this character is picked / has no description yet. */
  blurb: string;
}

/** Selectable roster, in display order. */
export const OFFICE_CAST: CastMember[] = [
  { name: 'michael',  displayName: 'Deepak',   shirt: '#5a6b8c', blurb: 'Runs the floor' },
  { name: 'jim',      displayName: 'Arjun',    shirt: '#2e7d6e', blurb: 'Ships on Fridays' },
  { name: 'pam',      displayName: 'Priya',    shirt: '#c65b8c', blurb: 'Draws the pixels' },
  { name: 'dwight',   displayName: 'Vikram',   shirt: '#8a6d2f', blurb: 'Tests everything twice' },
  { name: 'kevin',    displayName: 'Rohan',    shirt: '#3f6f9e', blurb: 'Keeps the books' },
  { name: 'angela',   displayName: 'Kavya',    shirt: '#6e5f9e', blurb: 'Counts every token' },
  { name: 'oscar',    displayName: 'Farhan',   shirt: '#8a3b52', blurb: 'Knows the ledger' },
  { name: 'stanley',  displayName: 'Mohan',    shirt: '#96684a', blurb: 'Crosswords at lunch' },
  { name: 'phyllis',  displayName: 'Lakshmi',  shirt: '#a86fa8', blurb: 'Sweetens the deals' },
  { name: 'andy',     displayName: 'Aditya',   shirt: '#3f8f5f', blurb: 'Sings in standup' },
  { name: 'kelly',    displayName: 'Neha',     shirt: '#c2487f', blurb: 'Runs the group chat' },
  { name: 'ryan',     displayName: 'Karan',    shirt: '#4a4a58', blurb: 'The intern' },
  { name: 'toby',     displayName: 'Suresh',   shirt: '#8a7f4e', blurb: 'Human resources' },
  { name: 'creed',    displayName: 'Dev',      shirt: '#5f7040', blurb: 'Quality, allegedly' },
  { name: 'meredith', displayName: 'Meera',    shirt: '#a34a3e', blurb: 'Vendor whisperer' },
];

export const CAST_BY_NAME: Record<OfficeCharacterName, CastMember> =
  Object.fromEntries(OFFICE_CAST.map((c) => [c.name, c])) as Record<OfficeCharacterName, CastMember>;

export const DEFAULT_CHARACTER: OfficeCharacterName = 'jim';

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// ─── scene frames ────────────────────────────────────────────────────────────
const frameCache = new Map<OfficeCharacterName, Texture[][]>();

function bufToTexture(buf: Uint8ClampedArray): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_W; canvas.height = SCENE_H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SCENE_W, SCENE_H);
  img.data.set(buf);
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

/**
 * Frame grid CharacterSprite expects: 3 rows (down, up, right) × 7 frames
 * [walk1, walk2, walk3, type1, type2, read1, read2]. We provide a front view
 * (down — and reused for the side row, so left/right walkers still show a face)
 * and a back view (up — agents seated facing their desk show their back). The
 * three walk frames are stand / step-left / step-right.
 */
export async function getCastFrames(name: OfficeCharacterName): Promise<Texture[][]> {
  const cached = frameCache.get(name);
  if (cached) return cached;
  const { front, back } = sceneFrameBufs(name);
  const toRow = (bufs: Uint8ClampedArray[]): Texture[] => {
    const [stand, stepL, stepR] = bufs.map(bufToTexture);
    return [stand, stepL, stepR, stand, stand, stand, stand];
  };
  const frontRow = toRow(front);
  const frames: Texture[][] = [frontRow, toRow(back), frontRow]; // down, up, right
  frameCache.set(name, frames);
  return frames;
}

/**
 * Paint a character's static portrait for cards / the picker (delegates to the
 * custom procedural composer in portraitArt.ts).
 */
export async function paintCastPortrait(
  ctx: CanvasRenderingContext2D,
  name: OfficeCharacterName,
  scale = 2,
): Promise<void> {
  paintPortrait(ctx, name, scale);
}

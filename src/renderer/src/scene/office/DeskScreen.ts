import { Container, Graphics, Sprite } from 'pixi.js';
import type { TiledMapRenderer } from './TiledMapRenderer';
import type { MonitorConfig } from './themeRegistry';

// The office tileset ships every desk PC twice: a dark, switched-off monitor
// (gids 365/366 + 381/382 — what the map paints) and the SAME monitor with a
// lit blue desktop (367/368 + 383/384). DeskScreen overlays the lit variant on
// a desk's monitor block while its agent is seated, plus a tiny screen-life
// animation (scrolling lines + a blinking cursor) so the PC visibly works when
// its owner does. Hidden, the map's off art shows through — no state to undo.

/** gid of the OFF monitor block's top-left tile, as painted in the office map.
 *  Default for the office theme; a theme supplies its own via MonitorConfig. */
export const MONITOR_OFF_TOPLEFT_GID = 365;
/** Matching ON tiles for the office theme, laid out 2×2 directly right of the
 *  off block — used when no per-theme MonitorConfig is passed. */
const DEFAULT_ON_GIDS: ReadonlyArray<readonly [number, number, number]> = [
  // [gid, dx, dy] in tiles relative to the block's top-left
  [367, 0, 0], [368, 1, 0],
  [383, 0, 1], [384, 1, 1]
];

/** Screen interior of the 2×2 (32×32px) block, in local pixels — where the
 *  blue desktop is drawn in the tile art. The animation stays inside it. */
const SCREEN = { x: 3, y: 5, w: 25, h: 12 };

export class DeskScreen {
  readonly container = new Container();
  private anim = new Graphics();
  private on = false;
  private t = 0;
  /** What the owner is doing, as a screen mood: busy scrolls fast and bright,
   *  alert pulses red, wait drifts slow blue, idle sits dim and still. */
  private mode: 'busy' | 'alert' | 'wait' | 'idle' = 'idle';

  constructor(mapRenderer: TiledMapRenderer, topLeft: { x: number; y: number }, monitor?: MonitorConfig) {
    const ts = mapRenderer.tileSize;
    const onGids = monitor?.onGids ?? DEFAULT_ON_GIDS;
    for (const [gid, dx, dy] of onGids) {
      const tex = mapRenderer.textureForGid(gid);
      if (!tex) continue;
      const s = new Sprite(tex);
      s.x = dx * ts;
      s.y = dy * ts;
      this.container.addChild(s);
    }
    this.anim.eventMode = 'none';
    this.container.addChild(this.anim);
    this.container.x = topLeft.x * ts;
    this.container.y = topLeft.y * ts;
    // Sort with the characters: the block's bottom edge sits above the seated
    // agent's anchor row, so the avatar's head draws over the keyboard, not
    // under it — same painter's order the map art implies.
    this.container.zIndex = (topLeft.y + 2) * ts - 1;
    this.container.visible = false;
    this.container.eventMode = 'none';
  }

  /** Light the screen (agent sat down) or cut it (stood up / left). */
  setOn(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.container.visible = on;
    if (!on) { this.anim.clear(); this.t = 0; }
  }

  /** Mirror the owner's state on the monitor. Cheap (a field); the tick
   *  renders it. Call on avatar state changes, not per frame. */
  setMode(mode: 'busy' | 'alert' | 'wait' | 'idle'): void {
    this.mode = mode;
  }

  update(dt: number): void {
    if (!this.on) return;
    this.t += dt;
    const g = this.anim;
    g.clear();
    // Mood wash over the desktop so the state reads across the room.
    const wash =
      this.mode === 'busy' ? { color: 0xf4d35e, alpha: 0.16 } :
      this.mode === 'alert' ? { color: 0xd96a62, alpha: 0.22 + 0.12 * Math.sin(this.t * 6) } :
      this.mode === 'wait' ? { color: 0x6d87d6, alpha: 0.14 } :
      { color: 0x4f9faf, alpha: 0.08 };
    g.rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h).fill(wash);
    // Two faint "output" lines scrolling up the desktop, wrapping around —
    // the eternal build log — plus a cursor blinking in the lower left.
    // Busy scrolls fast, wait drifts, idle holds still.
    const speed = this.mode === 'busy' ? 6.5 : this.mode === 'wait' ? 1.6 : 0;
    for (let i = 0; i < 2; i++) {
      const phase = (this.t * speed + i * (SCREEN.h / 2)) % SCREEN.h;
      const y = SCREEN.y + SCREEN.h - 1 - phase;
      const w = 6 + ((i * 7 + Math.floor(this.t / 1.7)) % 9);
      g.rect(SCREEN.x + 2, Math.round(y), w, 1).fill({ color: 0xcfe6ff, alpha: this.mode === 'idle' ? 0.3 : 0.55 });
    }
    if (Math.floor(this.t / 0.53) % 2 === 0) {
      g.rect(SCREEN.x + 2, SCREEN.y + SCREEN.h - 2, 2, 2).fill({ color: 0xffffff, alpha: 0.9 });
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

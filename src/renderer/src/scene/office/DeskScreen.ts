import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
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

  constructor(mapRenderer: TiledMapRenderer, topLeft: { x: number; y: number }, monitor?: MonitorConfig, opts?: { onTap?: () => void }) {
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
    // Clicking the monitor opens that agent's desk-PC overview (same action
    // as the roster's PC button). No tap handler → fully inert.
    if (opts?.onTap) {
      this.container.eventMode = 'static';
      this.container.cursor = 'pointer';
      // Explicit 2×2-tile hit box (same reason as the avatar hitArea:
      // tile-texture hit-testing proved flaky, taps died silently).
      this.container.hitArea = new Rectangle(0, 0, ts * 2, ts * 2);
      this.container.on('pointertap', opts.onTap);
    } else {
      this.container.eventMode = 'none';
    }
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
    if (mode === this.mode) return;
    // Snapshot the live wash as the transition start (pixel world: stepped,
    // never eased — see update).
    this.fromR = this.washR; this.fromG = this.washG;
    this.fromB = this.washB; this.fromA = this.washA;
    this.modeT0 = this.t;
    this.mode = mode;
  }

  // Stepped mood transition: 3 discrete frames over ~120ms (steps(2) like the
  // chrome), never an exponential blend — easing is not pixel style.

  // Stepped mood wash: 3 discrete frames toward the mode target — pixel
  // style snaps between poses, never eases. from*/modeT0 snapshot the wash
  // at each setMode so the steps start from the live color.
  private washR = 0x4f; private washG = 0x9f; private washB = 0xaf;
  private washA = 0.08;
  private fromR = 0x4f; private fromG = 0x9f; private fromB = 0xaf;
  private fromA = 0.08;
  private modeT0 = 0;

  update(dt: number): void {
    if (!this.on) return;
    this.t += dt;
    const g = this.anim;
    g.clear();
    // Mood wash over the desktop so the state reads across the room.
    // Stepped transition (3 frames over ~120ms, like the chrome's steps(2)):
    // pixel style snaps between poses, never eases through them.
    const target =
      this.mode === 'busy' ? { color: 0xf4d35e, alpha: 0.16 } :
      this.mode === 'alert' ? { color: 0xd96a62, alpha: 0.22 + 0.12 * Math.sin(this.t * 6) } :
      this.mode === 'wait' ? { color: 0x6d87d6, alpha: 0.14 } :
      { color: 0x4f9faf, alpha: 0.08 };
    const step = Math.min(2, Math.floor((this.t - this.modeT0) / 0.06));
    const p = step / 2;
    const tr = (target.color >> 16) & 255, tg = (target.color >> 8) & 255, tb = target.color & 255;
    this.washR = this.fromR + (tr - this.fromR) * p;
    this.washG = this.fromG + (tg - this.fromG) * p;
    this.washB = this.fromB + (tb - this.fromB) * p;
    this.washA = this.fromA + (target.alpha - this.fromA) * p;
    g.rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h).fill({
      color: (Math.round(this.washR) << 16) | (Math.round(this.washG) << 8) | Math.round(this.washB),
      alpha: this.washA
    });
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

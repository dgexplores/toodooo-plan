<div align="center">

# toodooo

### Your own office of AI clones — headed by Deepak

**toodooo** turns the terminal AI CLIs you already pay for (Claude Code, Codex,
Gemini…) into a coordinated team: shared memory, desk-to-desk messaging, tasks,
spend caps and WhatsApp reach — local-first, free and open source.

> Built from the [Munder Difflin](https://github.com/chaitanyagiri/munder-difflin)
> open-source core (MIT — license and attributions intact), then hardened and
> re-homed: authenticated coordination, bounded resources, Hindi UI, WhatsApp,
> INR cost control. See [`blueprint/`](blueprint/) for the full plan and bug register.

</div>

## Run it

```bash
npm install
npm run dev     # Electron app with hot reload
```

macOS/Windows/Linux installers: Releases (when cut). All builds are
**unsigned** (no $99 Apple certificate) — see below.

## Installing the DMG (unsigned, free forever)

Personal use needs nothing: `npm run dev`, or install the built app
directly — it runs fine. A *downloaded* copy is a different story: macOS
tags downloads as quarantined, and Gatekeeper refuses unsigned quarantined
apps with a "damaged, can't be opened" message. The app is intact; the
warning is Apple's tollbooth, not corruption:

```bash
xattr -cr /Applications/toodooo.app   # once per install, then open normally
```

Or right-click the app → Open → Open. The $99/yr Apple Developer Program
(Developer ID + notarization) removes this friction for strangers — worth it
only the day someone else pays for the app. Until then: pay nothing.

## What's different here

- **Reliable hive**: every forward consumes a hop (loops terminate), torn reads
  wait instead of corrupting, dead-letter preserves the undeliverable, control
  and breaker state survives restarts, hook socket authenticated.
- **Bounded**: terminal scrollback, feeds, queues and log reads all capped;
  store writes coalesced; CLI resolution async with TTL.
- **Yours**: `toodooo://` links, own updater/catalog endpoints, Deepak by
  default (rename anytime, it sticks), Hindi UI growing with a parity ratchet.
- **India-ready**: WhatsApp Cloud API inlet with allowlist, INR display off a
  manual rate, hard daily + CPU caps at spawn, per-client cost attribution.

## What's left

- **Apple signing ($99/yr)** — the only hard paywall, and only for
  friction-free distribution (see above). Everything else below is free.
- **CI runners** — GitHub Actions currently red on every run (infra-side log
  failure); local gates (`npm run typecheck`, `node --test test/*.test.cjs`)
  are green. No paid fix.
- **Windows smoke proof** — matrix leg never completed on a runner.
- **Hindi expansion** — chrome + parity ratchet in; remaining batches are
  translation work, not engineering risk.
- **Voice-note replies (R-08)** — free path is local Whisper (`whisper.cpp`,
  offline) instead of Groq cloud. Not yet wired.
- **Vector memory** — free path is local embeddings on your Mac. Keyword +
  BM25 search works today.
- **WhatsApp live traffic (R-05)** — panel + tunnel done; needs your free
  Meta dev app + number to go live.
- **Perf/cost evidence (R-06)** — p95 floor numbers and digest missions need
  real usage first.
- **Recorded debts** — catalog URL branch pin, custom icon/art, Pro/wall
  verdict, export-picker UI, trigger/org vault, weekly digest.

## Docs

- [`blueprint/00-vision-scope.md`](blueprint/00-vision-scope.md) — problem, persona, metrics
- [`blueprint/01-bug-register.md`](blueprint/01-bug-register.md) — all 22 flaws with evidence and fixes
- [`blueprint/02-architecture.md`](blueprint/02-architecture.md) … through `06-roadmap.md`

## License

MIT — see [LICENSE](LICENSE). Pixel art and third-party assets keep their own
licenses — see [LICENSE-ASSETS](LICENSE-ASSETS) and attributions in place.

<div align="center">

# toodooo

### Your own office of AI workers — headed by Deepak

**toodooo** turns the terminal AI CLIs you already use (Claude Code, Codex,
Gemini…) into a coordinated team on a 2D office floor: shared memory,
desk-to-desk messaging, tasks, spend caps and WhatsApp reach.
Local-first, free and open source. Easy enough for anyone — no terminal
skills required.

> Built from the [Munder Difflin](https://github.com/chaitanyagiri/munder-difflin)
> open-source core (MIT — license and attributions intact), then hardened,
> re-homed and simplified. See [`blueprint/`](blueprint/) for the full plan
> and bug register.

</div>

## Why toodooo

One boss, many hands. You dispatch a task once to **Deepak** — he breaks it
down, hands pieces to worker agents running real terminals, and keeps
everything moving: inbox nudges when mail piles up, circuit breaker when an
agent runs wild, memory that survives restarts. You watch it all live from
one screen instead of babysitting twelve terminals.

## Made for anyone

- **Quick hire** — name, face, project, goal, Spawn. Engine settings stay
  behind Advanced.
- **Simple Command Center** — six daily tabs (terminal, monitor, tasks,
  ask me, workers, spend); power tabs hide behind More.
- **Full Hindi UI** (1210 strings, enforced by CI) plus English, العربية
  and 中文.
- **Avatars that read true** — typing, reading, coffee breaks, cheers,
  blocked-at-the-door; installing agents show as installing, dead ones
  leave the floor.

## Features

- **Reliable hive** — hop-counted routing (loops terminate), torn-read
  guards, dead-letter for the undeliverable, control + breaker state that
  survives restarts, authenticated hook socket.
- **Bounded by default** — scrollback, feeds, queues and log reads capped;
  daily spend + CPU caps refuse new spawns politely; per-client ₹ cost
  attribution with a Spend tab.
- **Memory that sticks** — markdown memory per agent, BM25 search across
  the hive, sessions that resume after restart.
- **Reachable** — Slack threads + WhatsApp Cloud inlet (free tier) land in
  the boss's queue; mission schedules and webhooks included.
- **Yours** — `toodooo://` links, own updater/catalog endpoints, renameable
  boss, fast boot (no fixed-wait startup).

## Run it

```bash
npm install
npm run dev     # Electron app with hot reload
```

macOS/Windows/Linux installers: Releases (when cut). All builds are
**unsigned** (no $99 Apple certificate) — see below.

## Installing the DMG (unsigned, free forever)

Built locally, it just runs. A *downloaded* copy is different: macOS tags
downloads as quarantined, and Gatekeeper refuses unsigned quarantined apps
with a "damaged, can't be opened" message. The app is intact; the warning
is Apple's tollbooth, not corruption:

```bash
xattr -cr /Applications/toodooo.app   # once per install, then open normally
```

Or right-click the app → Open → Open. The $99/yr Apple Developer Program
(Developer ID + notarization) removes this friction for strangers — worth it
only the day someone else pays for the app. Until then: pay nothing.

## Roadmap

- **Apple signing ($99/yr)** — the only hard paywall, distribution only.
- **Voice-note replies** — free path is local Whisper (offline), not yet wired.
- **Vector memory** — free path is local embeddings; keyword + BM25 today.
- **WhatsApp live traffic** — panel + tunnel done; needs your free Meta dev
  app + number.
- **Recorded debts** — catalog branch pin, custom icon/art, export-picker UI,
  trigger/org vault, weekly digest, perf evidence from real usage.

## Docs

- [`blueprint/00-vision-scope.md`](blueprint/00-vision-scope.md) — problem, persona, metrics
- [`blueprint/01-bug-register.md`](blueprint/01-bug-register.md) — all 22 flaws with evidence and fixes
- [`blueprint/02-architecture.md`](blueprint/02-architecture.md) … through `06-roadmap.md`

## License

MIT — see [LICENSE](LICENSE). Pixel art and third-party assets keep their own
licenses — see [LICENSE-ASSETS](LICENSE-ASSETS) and attributions in place.

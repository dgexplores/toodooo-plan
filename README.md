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

Signed macOS/Windows/Linux installers: Releases (when cut).

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

## Docs

- [`blueprint/00-vision-scope.md`](blueprint/00-vision-scope.md) — problem, persona, metrics
- [`blueprint/01-bug-register.md`](blueprint/01-bug-register.md) — all 22 flaws with evidence and fixes
- [`blueprint/02-architecture.md`](blueprint/02-architecture.md) … through `06-roadmap.md`

## License

MIT — see [LICENSE](LICENSE). Pixel art and third-party assets keep their own
licenses — see [LICENSE-ASSETS](LICENSE-ASSETS) and attributions in place.

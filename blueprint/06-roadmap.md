# toodooo — 06 Phased Roadmap

Each phase is independently shippable with exit criteria. No phase starts
with the previous one's criteria unmet. Estimates are ranges (solo dev,
part-time assumption); re-estimate when facts change.

## Phase A — Spike & proof (1–2 weeks)
- WhatsApp transport decision ($0 constraint): Cloud API free tier vs local
  gateway vs number-bridge. Smallest slice: inbound text → owner reply.
- Hindi string extraction + parity harness.
- Kill-9 recovery rig (reused all phases).
- **Exit**: transport chosen with working echo bot; parity test green; rig runs.

## Phase B — Reliable hive (2–4 weeks)
- Router v2 (atomic writes, hops, receipts, drain, hold, bounces), persisted
  control/breaker, git queue, rotation/archival jobs.
- **Exit**: B-001…B-010 acceptance tests green; 10k soak zero-loss; recovery
  matrix green.

## Phase C — Terminals + shell UI (2–3 weeks)
- Async spawn, keymap parity, budgets, sliced store, archive/restore/repair,
  platform smokes.
- **Exit**: B-011…B-016 green; cold start < 2s; 5-agent RAM budget held.

## Phase D — Memory + cost you can trust (2–3 weeks)
- Capped memory + framed condense pipeline; ledger-first cost + INR + caps +
  per-client attribution.
- **Exit**: B-017/B-018 green; condense soak ≥ 99%; kill-restart continuity.

## Phase E — WhatsApp + Hindi v1 (2–3 weeks)
- Full trigger loop, allowlist, media policy, Hindi UI 100%, Hindi prompts.
- **Exit**: R-01…R-08 green; p95 round-trip measured; parity CI enforced.

## Phase F — Harden + ship personal (1–2 weeks)
- Boundary table + vault migration + safe mode + local install + backup;
  security review against `04-security.md`.
- **Exit**: B-019…B-022 green; fresh-machine install doc verified; personal
  daily driver for 2 weeks with issue log.

## Phase G — Product track (after F + real usage evidence)
- Apple cert ($99 — THE toll), signed DMG, hosted feed, docs site, public
  repo decision, pricing/packaging (services first, license later), support
  posture for paying users.
- **Entry condition**: 2 weeks personal daily use + 10 real client tasks run
  through toodooo. No earlier — evidence before spend.

## What we're NOT building (and why)
| Request | Reason | Revisit when |
|---------|--------|--------------|
| 2D office floor/avatars | demo candy; status list serves the job | perf budget proven + user asks |
| Vector embeddings | FTS5 suffices; cost/complexity unjustified | recall precision measured lacking |
| Team/multi-user | solo wedge first | 50+ solo users ask |
| OAuth broker | scope + security surface | a top-3 user workflow needs it |
| Client invoicing | visibility first, billing later | ledger data shows billing pain |
| Auto-updater | unsigned can't; manual + check suffices | signing done |

## Next action (concrete)
Confirm 00-§Decisions (wedge/user/constraints) → I write Phase A spike plan
with day-by-day tasks and start the WhatsApp transport spike.

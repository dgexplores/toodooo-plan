# toodooo — 02 Target Architecture

Design principle: every B-item in `01-bug-register.md` must be
structurally impossible or test-caught here — not documented away.

## 1. Process layout (same shape, harder boundaries)
```
main (Node, privileged)      preload (bridge)        renderer (sandboxed)
HiveOwner  ProcOwner         window.toodooo          terminals + lists
HookServer WakeWatch         invoke/on only          kanban + memory UI
Breaker    Scheduler         booleans, never         NO secrets cross
GitQueue   Vault             secrets/values
```
- One owner per concern; cross-owner calls only via explicit methods.
- Bridge contract test enumerates every channel; anything carrying secret
  shape fails CI (B-019).

## 2. Hive v2 (fixes B-001…B-010)
```
hive/  (git repo, main is SOLE writer — enforced: .gitignore + lock + docs)
  PROTOCOL.md  registry.json  board.md  tasks.json  schedules.json
  log.jsonl (rotated @10MB)  ledger.jsonl (append-only, never recomputed)
  agents/<id>/ identity.md  memory.md (capped, condense-triggered)
             inbox/*.json  inbox/.done/ (archival job @1000)
             outbox/ (writers MUST tmp+rename; helper is the only API)
             cursor.json  control.json (pause/halt/steers — persisted, B-007)
```
- Router: poll + fs-watch hybrid; forward increments `hops`; cap → orchestrator.
- Stop gate: drain → block with messages → ack advances cursor (B-001).
- Receipts: every send ends in delivered/bounced receipt visible to sender (B-003).
- Hold: checked on direct + broadcast; digest on unhold (B-010).
- Bounces mint new ids with `in_reply_to` (B-004).
- Git: single serialized queue, timeout + backoff, never delete locks (B-009).
- Restart: control/breaker/cursor reloaded; recovery suite kills -9 at each
  step and asserts convergence (B-007).

## 3. Terminal plane (fixes B-011, B-014, B-015)
- Async CLI resolution, cached, skeleton UI; first paint < 2s.
- Keymap parity table per OS, tested; Windows shim degrades loudly, never
  silently (B-014).
- PTY backpressure: bounded IPC queue, drop policy = coalesce output, keep
  input; large dumps paginated, never streamed raw.
- Platform CI: smoke test per OS per release (spawn → echo → assert).

## 4. Renderer (fixes B-012, B-013)
- Sliced store (agents/roster/queues/ui), narrow selectors, 50ms update
  coalescing; volatile fields excluded from persist by type, not opt-out list.
- Budgets: scrollback 10k default, feed rings 500/agent, no 2D canvas v1
  (status list; floor only if perf budget proven later).
- Agent lifecycle: archive/restore/repair/respawn first-class (B-016).

## 5. Memory (fixes B-017)
- Cap + trigger: memory.md capped (e.g. 8k tokens); crossing triggers chunked
  condense with framed protocol + per-chunk retry; failure pages user, never
  silent.
- Recall: FTS5 first, keyword-rank fallback (proven pattern); vectors only
  with evidence later.

## 6. Cost (fixes B-018)
- Ledger-first: every spend event appended; UI reads ledger, never recomputes.
- Unknown model = spend blocked with message (fail-closed).
- Per-client key on records; hard caps with kill-switch; all estimates labeled.

## 7. Chat (WhatsApp-first)
- Inbound: provider adapters behind one `Trigger` interface (WhatsApp first
  via free API path — Cloud API free tier or local gateway, decided in Phase A
  spike with cost $0 constraint).
- Outbound: threaded replies, token-gated, stub-tested.
- No tunnel in core loop: primarily local/polling transports; tunnels only
  as explicit opt-in with warning.

## 8. Updates & distribution
- Feed check (github: or https JSON) + manual install while unsigned.
- `install-local` script = personal track (no quarantine).
- Release gate: typecheck + full suite + platform smokes + boundary-table check.

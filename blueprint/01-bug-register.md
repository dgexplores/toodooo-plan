# toodooo — 01 Bug & Flaw Register

Every item: evidence → root cause → fix design → acceptance. Priority:
P0 ship-blocker, P1 v1, P2 later. IDs stable (B-001…) for tracking.

## Coordination core (hive)

### B-001 Stop-drain dead code (P0) — DONE (revised, see below)
- **Evidence**: `drainForStop` defined, zero callers; hook `Stop` handler only
  notifies; docs/shims claim drain works.
- **Root cause**: drain wired in spec, never connected; autonomy fell back to
  intervals silently.
- **Fix (REVISED — disagreed with original)**: reconnecting the BLOCKING drain
  would revert a deliberate upstream safety call (forced continuation at Stop
  bypasses HITL and spends credits mid-question). Instead: cursor is now
  ack-based — `ackInbox()` advances only over `.done`-observed ids (only writer
  of cursor.json; `drainForStop` never advances it, crash resurfaces mail =
  at-least-once, the safe direction); Stop handler acks + reports the pending
  count in the toast so the renderer wake path carries content.
- **Acceptance**: drain→crash→redrain returns same mail; ack moves cursor only
  over handled ids; Stop toast carries pending count. ✅ (test/hive-drain-ack)
- **Status**: done on `improve/india-ready`.

### B-002 Hop cap unreachable (P0)
- **Evidence**: cap checked, never incremented anywhere; protocol omits field.
- **Root cause**: increment step never implemented.
- **Fix**: router increments `hops` on every forward; cap breach routes to
  orchestrator + logs; protocol documents the field.
- **Acceptance**: two agents in request↔request loop terminate at cap with
  orchestrator escalation; loop test asserts bounded commits.

### B-003 Blackhole routes (P0)
- **Evidence**: missing-god and god→human paths drop with sender seeing success.
- **Root cause**: fallback + self-filter with no drop notification.
- **Fix**: every undeliverable message bounces to orchestrator AND notifies
  sender via inbox receipt; no silent `.sent`.
- **Acceptance**: each blackhole scenario produces a sender-visible receipt;
  matrix test covers all `to:` variants × god present/absent.

### B-004 Bounce id reuse breaks dedup (P1)
- **Evidence**: bounces preserve message id; id-based dedup/cursor collapses copies.
- **Fix**: bounces get new ids with `in_reply_to` pointing at original.
- **Acceptance**: dedup test with bounce storm keeps all copies distinct.

### B-005 Torn outbox reads + registry races (P0)
- **Evidence**: producers write plain JSON; router reads mid-write → quarantine
  + loss; registry read-modify-write without lock.
- **Fix**: mandatory tmp-file + atomic rename for ALL writers (enforced by
  schema of write helper, not docs); registry writes serialized through single
  owner queue in main.
- **Acceptance**: concurrent-writer stress test (10 producers × 500 msgs) with
  zero loss; registry invariant test under interleaved ops.

### B-006 Unauthenticated hook socket (P0)
- **Evidence**: UDS accepts any local process, self-asserted agent ids.
- **Fix**: per-boot socket token (0600 file), shim injects it, server rejects
  without it; agent id bound to spawn record, not self-claim.
- **Acceptance**: spoof attempt without token rejected + logged; negative test.

### B-007 Restart amnesia (P0)
- **Evidence**: pause/halt/steers, breaker state, wakeups all in-memory.
- **Fix**: persist control + breaker + cursor state to hive on every mutation
  (cheap JSON, same atomic-write helper); reload on boot; in-flight window
  documented and bounded.
- **Acceptance**: kill -9 during pause/halt/storm → post-restart state matches;
  recovery suite.

### B-008 Breaker misfires (P1)
- **Evidence**: no-progress arm nested in velocity gate; user issue #441.
- **Fix**: independent arms (error burst, tool storm, no-progress on OUTPUT
  bytes not coordination traffic); ±1 level per beat replaced by direct level
  computation; thresholds in config with defaults documented.
- **Acceptance**: wedged agent trips no-progress; healthy busy agent never trips;
  both as tests.

### B-009 Stale-lock deleter vs live git (P1)
- **Evidence**: lock files deleted while long git ops may hold them.
- **Fix**: no lock deletion; serialize git through one queue with timeout +
  backoff; long ops logged, never killed by cleaner.
- **Acceptance**: soak test with slow git ops shows zero index corruption.

### B-010 Broadcast ignores hold (P2)
- **Evidence**: hold flag unchecked on broadcast and direct paths.
- **Fix**: hold checked in both; held agents get digest on unhold.
- **Acceptance**: held agent receives zero dispatches, one digest after.

## Terminals & renderer

### B-011 Main-thread freezes on spawn/restore (P1)
- **Evidence**: sync login-shell probe ~1s per miss; N-agent restore = N seconds
  frozen; onboarding 5.6s (issue #446).
- **Fix**: async resolution with cache + negative caching + skeleton UI;
  never block first paint.
- **Acceptance**: cold start to interactive < 2s with 0 cached CLIs (test with
  stub PATH).

### B-012 Unbounded memory (P0)
- **Evidence**: 100k scrollback × N, unbounded feed arrays, unpruned
  logs/inboxes, full-file log parses per poll.
- **Fix**: budgets everywhere — scrollback 10k default + setting, feed ring
  buffers (cap 500/agent), log rotation (10MB), inbox archival job,
  cursor-based tail reads.
- **Acceptance**: 24h soak with 5 chattering agents stays under RAM budget;
  budgets asserted in tests.

### B-013 React storms per PTY chunk (P1)
- **Evidence**: full array clone + full diff per tool-line chunk.
- **Fix**: sliced store, narrow selectors, batched/coalesced updates
  (50ms window), volatile fields never trigger persist.
- **Acceptance**: burst benchmark (1k chunks/s) keeps 60fps floor + input latency
  < 100ms; perf test in suite.

### B-014 Terminal input gaps (P1)
- **Evidence**: Shift+Enter never reaches CLI (issue #481); Windows shim drops
  multiline/prompts silently.
- **Fix**: keymap parity table per platform with tests; shim path emits loud
  warning + falls back to safe subset, never silent prompt loss.
- **Acceptance**: input matrix test (keys × platforms) incl. multiline paste.

### B-015 Broken Linux AppImage + Windows bridges (P0 for market)
- **Evidence**: issues #456, #475; native module packaging gaps.
- **Fix**: CI builds per platform with smoke test (spawn shell agent, send
  text, assert echo) as release gate; postinstall rebuild pinned.
- **Acceptance**: release blocked unless all three platform smokes pass.

### B-016 No agent restore / folder-rename death (P1)
- **Evidence**: issues #447, #445.
- **Fix**: archive is a state, not deletion (restore button); cwd stored as
  bookmark with repair flow (locate folder → rebind); spawn records engine +
  model for one-click respawn.
- **Acceptance**: archive→restore round-trip test; rename→repair test.

## Memory & cost

### B-017 Condensation aborts ~80% (P0)
- **Evidence**: issue #459; payload vs JSON escaping.
- **Fix**: condense pipeline with framed protocol (length-prefixed, not
  embedded JSON-in-JSON), chunked summarization with per-chunk retry,
  memory cap with oldest-first condense trigger.
- **Acceptance**: 100-iteration condense soak ≥ 99% success; cap never exceeded.

### B-018 Cost undercounts + drift (P1)
- **Evidence**: restart resets, unknown models default Sonnet, silent zeros,
  co-located cwd double counts.
- **Fix**: ledger-first accounting (append-only, never recomputed from
  memory); unknown-model figures are LABELED estimated end-to-end instead (R-12 decision: blocking would kill local models) —
  per-client attribution key on every record; user-visible "estimated" label
  wherever provider API didn't confirm.
- **Acceptance**: kill-restart ledger continuity test; unknown-model labels test (cost-estimated).

## Security & privacy

### B-019 Secrets cross renderer bridge (P0)
- **Evidence**: full config incl. plaintext tokens readable by renderer.
- **Fix**: renderer gets booleans (`hasToken`), never values; all secret writes
  go through main-validated IPC; secrets encrypted at rest where platform
  allows (safeStorage) else 0600 + documented.
- **Acceptance**: bridge surface test asserts no secret-shaped values cross;
  negative XSS-drill (malicious renderer string cannot exfiltrate vault).

### B-020 Plaintext secrets on disk (P1)
- **Evidence**: chat tokens in config.json, backups/iCloud exposure.
- **Fix**: migrate to encrypted vault; migration path with re-key; backup
  excludes secrets by default with explicit opt-in warning.
- **Acceptance**: fresh scan of data dir finds zero high-entropy secrets
  outside vault (test).

### B-021 Docs claim "no listeners", tunnels exist (P2)
- **Evidence**: SECURITY.md vs Slack/webhook TCP + tunnelmole.
- **Fix**: docs describe every socket (path/port/scope/auth) in a boundary
  table; any new listener requires docs + test or CI fails.
- **Acceptance**: boundary-table test enumerates actual listeners vs doc.

## Distribution

### B-022 Unsigned builds + Gatekeeper wall (P1 for product, P2 for self)
- **Evidence**: "damaged" block on fresh Macs; local-install workaround only.
- **Fix**: personal track = local install script (no quarantine); product track
  = paid Apple cert budgeted as THE toll gate; release notes carry workaround
  until then.
- **Acceptance**: fresh-machine install test (VM or second Mac) documents exact
  UX per track.

# toodooo — 05 Test Strategy

Lesson from audit: ~105 backend tests + zero UI/scene coverage = false
confidence. Every layer below is a release gate, not an aspiration.

## 1. Layers & budgets
| Layer | What | Budget |
|-------|------|--------|
| Unit (node --test, no runner) | pure logic: router, breaker, names, semver, stats, parsers | must stay < 30s total |
| Contract | bridge surface, IPC shapes, feed schemas, hook frames | every channel covered |
| Recovery | kill -9 at each hive step; restart convergence | matrix: step × crash point |
| Soak | 10k-message router run; 24h-simulated chatter; condense ×100 | loss = 0, caps held |
| Negative/security | spoof, traversal, injection, malformed, replay, flood | each boundary |
| Platform smoke | spawn → echo → assert on mac/win/linux | release gate, all three |
| Perf | burst chunks, scrollback cap, store coalescing, cold start | numeric assertions |
| Manual-only | voice I/O, TTS, DMG install UX | checklist doc, never claimed as tested |

## 2. Invariants (property-style, not just examples)
- Router: no message lost/duplicated/reordered per conversation (idempotence).
- Ledger: append-only; balance never recomputed; kill-restart continuous.
- Caps: memory, scrollback, feeds, logs, queues — exceed attempt → oldest
  archived + counter, asserted.
- Hop count strictly increases per forward; terminates at cap.
- Hold: zero dispatches while held (direct + broadcast).
- Secrets: no secret-shaped value in bridge snapshots, logs, or backups.

## 3. Determinism rules
- Control clock (inject `now`), RNG (seeded in tests), network (local stubs),
  filesystem (tmp dirs), locale (fixed) — no flakes accepted; flaky test =
  quarantined same day with issue id.

## 4. Coverage gates
- New main-process file without test = CI fail.
- New IPC channel without contract test = CI fail.
- New listener/socket without boundary-table row + test = CI fail.
- UI component without at least contract/render smoke = flagged in review.

## 5. What we explicitly don't test (stated, not hidden)
- Pixel rendering, TTS voices, installer double-click UX → manual checklist.
- Provider CLI internals (Claude/Codex behavior) → adapter seam mocked.

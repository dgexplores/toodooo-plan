# toodooo — 04 Security & Privacy Model

Free-only, local-first. No paid security products; discipline instead.

## 1. Trust boundaries (each row = enforced + tested)
| # | Boundary | Scope | Auth | Test |
|---|----------|-------|------|------|
| 1 | Renderer ↔ main bridge | ~40 channels max (budget, not 150) | capability per channel; secrets never cross (shape test) | bridge-surface test |
| 2 | Hook socket (UDS) | per-boot token 0600; agent id bound at spawn | reject + log without token | spoof negative test |
| 3 | Webhook/WhatsApp inlet | loopback bind; secret/HMAC; rate limits; 1MB caps | 401/429 paths | auth matrix test |
| 4 | Spawn inputs | command allowlist + cwd must-exist-absolute + PATH check | reject with reason | injection suite |
| 5 | Update feed | `github:` or https only; version compare; manual install | malicious feed test | feed test |
| 6 | Filesystem | agent cwd-rooted access; worktree containment; no `..` escapes | traversal suite | fs tests |
| 7 | Tunnels | OPT-IN ONLY, explicit warning, never in core loop | n/a (config test) | config test |

## 2. Secret handling rules
- Renderer receives booleans (`hasToken`), never values. CI shape-test enforces.
- At rest: platform vault where available, else 0600 files; boot repairs
  perms and logs (proven pattern, keep).
- Chat tokens user-pasted, never generated, never logged, never in backups
  by default (explicit opt-in with warning).
- Same-UID readability is accepted and DOCUMENTED (shared machines = separate
  OS users), not silently assumed safe.

## 3. Privacy rules
- No analytics SDK in v1 (no PostHog; counts computed locally for stats).
- No prompt/code/transcript leaves machine except: WhatsApp bridge content
  (user-explicit, allowlisted senders) and provider CLIs the user already runs.
- Data-flow page in-app generated from boundary table (R-17).

## 4. Supply-chain rules (free)
- `npm audit` gate on release; native deps pinned; postinstall scripts
  reviewed line-by-line, listed here with purpose.
- No dependency with install-time network fetch beyond registry; no
  telemetry-bearing packages.
- Release assets reproducible from tag (rebuild check quarterly).

## 5. Incident posture (solo dev)
- Kill-switch: `--safe` flag boots with all inlets off + agents paused.
- Evidence preserved: structured log with request ids; backup before any
  migration; rollback commands in release doc (proven pattern, keep).

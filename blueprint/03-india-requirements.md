# toodooo — 03 India-Market Requirements

Derived from audit + persona (solo agency owner, India). Each item has an
acceptance line; nothing here is aspirational filler.

## 1. Language (Hindi-first, not Hindi-also)
- **R-01** Hindi (`hi`) + Hinglish tone option ship in v1; ✅ PARTIAL (chrome sections + ratchet shipped, expansion ongoing) zero English
  fallback strings (CI asserts key parity across locales).
- **R-02** Never auto-detect OS locale (explicit choice; learnt from upstream).
- **R-03** Agent-facing prompts (orientation, receipts) available in Hindi;
  owner picks per-agent language.
- **R-04** 1409-string translation burden handled by namespaced lazy-loaded
  locale files + parity test, not one giant JSON.

## 2. WhatsApp reach (the wedge)
- **R-05** Inbound WhatsApp message → Deepak inbox ✅ SHIPPED (transport + server + panel + tunnel) in < 60s p95, with sender
  attribution; delivery receipt on failure (never silent).
- **R-06** Outbound threaded reply from panel; works on free-tier transport
  ($0 constraint — spike Phase A picks Cloud API free tier vs local gateway).
- **R-07** Client-number allowlist: unknown senders get held queue, never
  auto-execution (agency owners add clients; strangers don't run agents).
- **R-08** Media handling defined: images/voice notes → transcribed/summarized
  or explicit "not supported yet" — never crash, never silent drop.

## 3. Money in rupees
- **R-09** All spend shown in INR ✅ SHIPPED (manual rate, dual display) (configurable FX source, cached rate,
  offline fallback to last rate with "stale" label).
- **R-10** Hard per-day/per-client caps with kill-switch ✅ SHIPPED (daily cap + spawn gate) approaching cap
  warns at 80%; breach impossible by construction (checked before spawn AND
  before each billed action where provider allows).
- **R-11** Per-client cost attribution on every ledger record ✅ SHIPPED (keys + rows + query + UI field + export) weekly digest
  ( Scheduled mission default: Monday 9am IST summary to owner).
- **R-12** ~~Unknown/uncosted model blocks spend~~ → DECIDED (opposite): label, don't block.
  Blocking would break local/open models (the free path this market needs) and
  strand proxy-tier agents. Shipped instead: every default-priced figure carries
  `estimated` from record → bucket → sample → ledger row (B-018), metered rows
  stay schema-clean, UI labels guesses. Revisit only with evidence of real harm.

## 4. Hardware & network reality
- **R-13** Budgets ✅ PARTIAL (ceilings + CPU cap shipped; 5-agent soak unmeasured)
  CPU cap configurable (answers upstream issue #471 by design).
- **R-14** Full offline core: hive, memory, tasks, terminals work with no
  network; network features (WhatsApp, update check, catalog) degrade with
  explicit status, never hang (all fetches timeout + fallback).
- **R-15** Linux first-class (AppImage smoke-tested per release — upstream
  #456 must not recur); Windows bridges covered by input-matrix tests.
- **R-16** Cold start to interactive < 2s regardless of installed CLIs.

## 5. Trust (agency clients ask)
- **R-17** One-page data-flow doc generated from boundary table ✅ SHIPPED (shared table → CI + UI): where code
  goes, what leaves the machine, what never does. Shown in-app.
- **R-18** Client isolation: per-client workspaces (git worktrees), per-client
  memory wings, per-client ledger; switching clients never leaks context
  (test: cross-client recall returns nothing).
- **R-19** Export + wipe per client ✅ PARTIAL (export tgz shipped; wipe deliberately manual) (backup tgz already proven; extend to
  per-client scope + secure delete option).

## 6. Payments & selling (later, noted now so architecture allows)
- No billing engine in v1. Ledger schema reserves `client_key` + currency
  fields so invoicing can layer on without migration.
- No UPI/Razorpay in-app until product track; noted as future wedge for
  client billing, not agent spend.

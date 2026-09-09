# toodooo — Solution Blueprint: 00 Vision & Scope

**Status**: Draft · **Author**: Alex (PM) · **Date**: 2026-09-10 · **Version**: 1.0
**Source study**: munder-difflin v0.5.2 deep audit (code + 80 open issues), 2026-09-10.

## 1. Problem statement
Solo agency owners in India run client work with AI coding CLIs but have no
coordination layer: no shared memory across sessions, no agent-to-agent
messaging, no cost control in rupees, no reach into WhatsApp where clients
live, and hardware (8GB Airs, budget Linux) that chokes on heavy harnesses.
Existing harness (munder-difflin) proves the concept but is unreliable at its
foundation (dead drain path, unreachable hop cap, restart amnesia, unbounded
growth) and misses the market (English/Slack-first, no Hindi, no WhatsApp,
no hard budgets).

**Cost of not solving**: owners babysit CLIs manually, lose context between
sessions, overspend on dollar-priced models, and can't productize agent
workflows for clients.

## 2. Product (one paragraph)
toodooo is a local-first, free/open-source desktop harness that turns the
terminal AI CLIs you already pay for into a coordinated team under one boss
(Deepak): file-based messaging with real delivery guarantees, memory that
survives restarts, hard spend caps, WhatsApp reach, Hindi + Hinglish UI, and
a footprint that respects 8GB machines. No servers, no paid APIs, no account.

## 3. Primary persona
**Solo agency owner, India** — runs 2–6 client projects, works from a
laptop (often 8GB RAM), coordinates with clients on WhatsApp, pays for
Claude/Codex subscriptions in USD out of INR revenue, English-working with
Hindi comfort. Needs: isolation per client, per-client cost visibility,
agents that keep working and remember, phone-reachable status.

## 4. Goals & success metrics
| Goal | Metric | Target | Window |
|------|--------|--------|--------|
| Reliable coordination | messages delivered w/o loss in soak test | 100% / 10k msgs | pre-launch gate |
| Survives reality | state correct after kill -9 mid-run | 100% recovery suite | pre-launch gate |
| Cheap to run | idle RAM (app shell, 0 agents) | < 250MB | every release |
| Speaks user | Hindi UI coverage | 100%, zero EN fallback | v1 |
| Reachable | WhatsApp round-trip (in→agent→reply) | < 60s p95 | v1 |
| No overspend | spend cap enforced (never exceeded in tests) | 0 breaches | every release |

## 5. Non-goals (v1)
- No 2D office floor / avatars (demo candy; status list + live terminals instead).
- No vector embeddings (FTS5 + ranked recall; revisit with evidence).
- No auto-update installer (manual DMG + in-app version check; signing later).
- No team/multi-user, no cloud sync, no OAuth broker, no voice calls.
- No client billing/invoicing (cost visibility only).

## 6. Constraints (hard)
- Free/open-source only: every dependency must be MIT/Apache/ISC/BSD, no paid APIs, no API keys required for core loop.
- Local-first: coordination works fully offline; network only for WhatsApp bridge + update check (both degradable).
- Security: loopback-only servers, secrets 0600 + encrypted where platform allows, full config never crosses renderer bridge, command+path validation on every spawn input.
- Reversibility: every phase shippable independently; git history clean; releases deletable.

## 7. What we steal vs rewrite (from audit)
Steal the **concepts**: file-based hive, single-committer git, hook-driven
events, PTY authenticity, orchestrator-as-ordinary-agent.
Rewrite the **mechanisms**: router (atomic writes, real hop count, working
drain), store (sliced, bounded), memory lifecycle (caps + working condense),
i18n (Hindi-first), chat (WhatsApp-first), tests (UI + soak + recovery).

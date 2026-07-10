---
phase: 01
slug: funda-o-acesso-clientes-e-contratos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (per CLAUDE.md "Development Tools" table) — not yet installed, greenfield project |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds (small unit suite, no integration tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <file>` for any task touching validation schemas or the current-contract derivation logic
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + manual walkthrough of ACES-01/02/03 and CLI-01..04
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-xx-xx | TBD | 0 | — | setup | `npm install -D vitest` + `vitest.config.ts` | ❌ W0 | ⬜ pending |
| 01-xx-xx | TBD | TBD | ACES-01 | manual | manual: log in with valid/invalid creds | N/A | ⬜ pending |
| 01-xx-xx | TBD | TBD | ACES-02 | manual | manual browser test with 2 seeded accounts | N/A | ⬜ pending |
| 01-xx-xx | TBD | TBD | ACES-03 | manual | manual: log in, close tab, reopen, still authenticated | N/A | ⬜ pending |
| 01-xx-xx | TBD | TBD | CLI-01 | unit | `npx vitest run tests/validations/cliente.test.ts` | ❌ W0 | ⬜ pending |
| 01-xx-xx | TBD | TBD | CLI-02 | unit | `npx vitest run tests/validations/contrato.test.ts` | ❌ W0 | ⬜ pending |
| 01-xx-xx | TBD | TBD | CLI-03 | unit | `npx vitest run tests/actions/contratos.test.ts` | ❌ W0 | ⬜ pending |
| 01-xx-xx | TBD | TBD | CLI-04 | unit | `npx vitest run tests/db/current-contrato.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs and plan/wave numbers to be filled in by the planner.*

---

## Wave 0 Requirements

- [ ] Install and configure Vitest (`npm install -D vitest`, `vitest.config.ts`) — no test framework exists yet in this greenfield project
- [ ] `tests/validations/cliente.test.ts` — stubs for CLI-01
- [ ] `tests/validations/contrato.test.ts` — stubs for CLI-02
- [ ] `tests/actions/contratos.test.ts` — stubs for CLI-03 (history-on-edit behavior)
- [ ] `tests/db/current-contrato.test.ts` — stubs for CLI-04 (current-contract derivation)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login succeeds with valid credentials, fails with invalid credentials | ACES-01 | No local Supabase Auth emulator (`supabase start`) configured this phase; cheap to verify manually against a real Supabase project at this scale | Log in with correct email/senha → succeeds; log in with wrong senha → shows error, no session created |
| Second, independent user account can log in | ACES-02 | Requires two real seeded accounts against live Supabase Auth | Seed a second user (Admin or Membro), log in with each account in separate sessions, confirm both work independently |
| Session persists across reload/new browser session | ACES-03 | Session/cookie persistence is a browser-level behavior, not practically unit-testable without the emulator | Log in, close tab, reopen the app URL — still authenticated without re-entering credentials |

*Automating ACES-01/02/03 with a `supabase start`-backed integration test is a valid later hardening task, not a Phase 1 blocker.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

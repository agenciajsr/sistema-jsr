---
phase: 01
slug: funda-o-acesso-clientes-e-contratos
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (per CLAUDE.md "Development Tools" table) — not yet installed, greenfield project |
| **Config file** | none — Wave 0 (01-01, Task 3) installs |
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
| 01-01-T3 | 01-01 | 1 | — | setup | `npm install -D vitest` + `vitest.config.ts` | created by 01-01 Task 3 | ⬜ pending |
| 01-09-T1 (steps 1-2) | 01-09 | 6 | ACES-01 | manual | manual: log in with valid/invalid creds | N/A | ⬜ pending |
| 01-09-T1 (steps 3-5) | 01-09 | 6 | ACES-02 | manual | manual browser test with 2 seeded accounts | N/A | ⬜ pending |
| 01-09-T1 (steps 6-7) | 01-09 | 6 | ACES-03 | manual | manual: log in, close tab, reopen, still authenticated | N/A | ⬜ pending |
| 01-04-T1 | 01-04 | 3 | CLI-01 | unit | `npx vitest run tests/validations/cliente.test.ts` | created by 01-01 Task 3 (stub), implemented by 01-04 Task 1 | ⬜ pending |
| 01-04-T2 | 01-04 | 3 | CLI-02 | unit | `npx vitest run tests/validations/contrato.test.ts` | created by 01-01 Task 3 (stub), implemented by 01-04 Task 2 | ⬜ pending |
| 01-05-T2 | 01-05 | 3 | CLI-03 | unit | `npx vitest run tests/actions/contratos.test.ts` | created by 01-01 Task 3 (stub), implemented by 01-05 Task 2 | ⬜ pending |
| 01-05-T1 | 01-05 | 3 | CLI-04 | unit | `npx vitest run tests/db/current-contrato.test.ts` | created by 01-01 Task 3 (stub), implemented by 01-05 Task 1 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task/plan/wave IDs above reflect the final phase plan structure (post-revision — see Blocker 1 wave renumbering: 01-02 wave 2; 01-03/01-04/01-05 wave 3; 01-06/01-07 wave 4; 01-08 wave 5; 01-09 wave 6). Status column updates as execution proceeds.*

---

## Wave 0 Requirements

- [x] Install and configure Vitest (`npm install -D vitest`, `vitest.config.ts`) — assigned to 01-01 Task 3 (Wave 1, no test framework existed yet in this greenfield project)
- [x] `tests/validations/cliente.test.ts` — stub created by 01-01 Task 3; real tests (CLI-01) implemented by 01-04 Task 1
- [x] `tests/validations/contrato.test.ts` — stub created by 01-01 Task 3; real tests (CLI-02) implemented by 01-04 Task 2
- [x] `tests/actions/contratos.test.ts` — stub created by 01-01 Task 3; real tests (CLI-03, history-on-edit behavior) implemented by 01-05 Task 2
- [x] `tests/db/current-contrato.test.ts` — stub created by 01-01 Task 3; real tests (CLI-04, current-contract derivation) implemented by 01-05 Task 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login succeeds with valid credentials, fails with invalid credentials | ACES-01 | No local Supabase Auth emulator (`supabase start`) configured this phase; cheap to verify manually against a real Supabase project at this scale | Log in with correct email/senha → succeeds; log in with wrong senha → shows error, no session created |
| Second, independent user account can log in | ACES-02 | Requires two real seeded accounts against live Supabase Auth | Seed a second user (Admin or Membro), log in with each account in separate sessions, confirm both work independently |
| Session persists across reload/new browser session | ACES-03 | Session/cookie persistence is a browser-level behavior, not practically unit-testable without the emulator | Log in, close tab, reopen the app URL — still authenticated without re-entering credentials |

*Automating ACES-01/02/03 with a `supabase start`-backed integration test is a valid later hardening task, not a Phase 1 blocker. All three are consolidated into the single checkpoint in 01-09-PLAN.md (Wave 6).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (01-02 Task 3's verify was revised from a no-op grep check to `npx drizzle-kit push --force`, which propagates the real exit code of the migration)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (01-01 Task 3 creates all 4 stub files consumed by 01-04/01-05)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** confirmed (revision pass — Blocker 1 wave renumbering and Blocker 2 verify fix applied)

---
phase: 01-funda-o-acesso-clientes-e-contratos
plan: 04
subsystem: validation
tags: [zod, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: Projeto Next.js/Vitest configurado, stubs describe.todo em tests/validations/
  - phase: 01-02
    provides: src/lib/db/schema.ts (nichoEnum, clienteStatusEnum) — valores usados no z.enum
provides:
  - clienteSchema (Zod) em src/lib/validations/cliente.ts — validação client+server de cliente (CLI-01)
  - contratoSchema (Zod) em src/lib/validations/contrato.ts — validação client+server de contrato (CLI-02)
affects: [01-07, 01-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schemas Zod em src/lib/validations/ são a fonte única de validação, reutilizados tanto pelo formulário (React Hook Form resolver) quanto pelas Server Actions — nenhuma duplicação de regra entre client e server"
    - "Valores de z.enum devem ser mantidos idênticos aos valores dos pgEnum em src/lib/db/schema.ts (nichoEnum, clienteStatusEnum)"
    - "Datas armazenadas/validadas como string 'YYYY-MM-DD' (regex) e comparadas via comparação lexicográfica de string, não via Date, para regras de negócio como dataVencimento > dataInicio"

key-files:
  created:
    - src/lib/validations/cliente.ts
    - src/lib/validations/contrato.ts
  modified:
    - tests/validations/cliente.test.ts
    - tests/validations/contrato.test.ts

key-decisions:
  - "contratoSchema usa z.coerce.number().positive() para valorMensal, permitindo que o formulário envie string (input HTML) e ainda validar como número positivo"
  - "Comparação de datas (dataVencimento > dataInicio) feita em .refine() sobre strings no formato YYYY-MM-DD, que ordenam lexicograficamente igual a ordenação cronológica — evita parsing de Date/timezone"

patterns-established:
  - "Todo campo de contato do cliente (nome/telefone/email) é opcional; apenas nome e nicho são obrigatórios, conforme D-05 e 'Claude's Discretion' de 01-CONTEXT.md"

requirements-completed: [CLI-01, CLI-02]

# Metrics
duration: 15min
completed: 2026-07-10
---

# Phase 01 Plan 04: Schemas Zod de Validação (Cliente e Contrato) Summary

**clienteSchema e contratoSchema (Zod) criados via TDD, cobrindo as regras de negócio de CLI-01/CLI-02 (nome/nicho obrigatórios, valor mensal sempre positivo, vencimento sempre posterior ao início), prontos para reuso idêntico entre formulário e Server Actions.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-10T19:50:00Z (aprox.)
- **Completed:** 2026-07-10T19:55:00Z (aprox.)
- **Tasks:** 2
- **Files modified:** 4 (2 criados, 2 testes substituídos)

## Accomplishments
- `clienteSchema` valida nome obrigatório, nicho restrito ao enum (`ecommerce`/`negocio_local`/`infoproduto`, idêntico a `nichoEnum` do Drizzle), status com default `ativo`, e campos de contato/notas opcionais com validação de formato de email quando fornecido
- `contratoSchema` valida `valorMensal` sempre positivo (`.positive()`), datas no formato `YYYY-MM-DD`, e garante via `.refine()` que `dataVencimento` é estritamente posterior a `dataInicio`
- Ambos os schemas seguidos do ciclo RED→GREEN por task, com os stubs `describe.todo` do Plan 01-01 substituídos por 12 testes reais (6 por schema) cobrindo todos os casos do `<behavior>` do plano

## Task Commits

Each task was committed atomically (RED → GREEN):

1. **Task 1: clienteSchema (Zod) — CLI-01**
   - RED: `1cffe15` (test) - 6 testes falhando (módulo inexistente)
   - GREEN: `f573048` (feat) - schema criado, 6/6 testes passando
2. **Task 2: contratoSchema (Zod) — CLI-02**
   - RED: `9f5818c` (test) - 6 testes falhando (módulo inexistente)
   - GREEN: `d5f0f30` (feat) - schema criado, 6/6 testes passando

**Plan metadata:** (commit a seguir nesta mesma execução)

## Files Created/Modified
- `src/lib/validations/cliente.ts` - `clienteSchema` (Zod) + tipo `ClienteInput`
- `src/lib/validations/contrato.ts` - `contratoSchema` (Zod) + tipo `ContratoInput`
- `tests/validations/cliente.test.ts` - stub `describe.todo` substituído por 6 testes reais
- `tests/validations/contrato.test.ts` - stub `describe.todo` substituído por 6 testes reais

## Decisions Made
- `valorMensal` usa `z.coerce.number()` em vez de `z.number()` para aceitar diretamente valores de input HTML (string) do formulário sem exigir parsing manual antes do `safeParse`.
- Comparação `dataVencimento > dataInicio` feita sobre as strings no formato `YYYY-MM-DD` (regex validado antes), que ordenam corretamente por comparação lexicográfica — evita ambiguidade de timezone que surgiria ao converter para `Date`.

## Deviations from Plan

None - plan executado exatamente como escrito. Ambiente precisou de `npm install` (node_modules não existia neste worktree paralelo), mas isso é setup de ambiente, não desvio do plano.

## Issues Encountered
- `node_modules` estava ausente neste worktree (execução paralela em worktree isolado); resolvido com `npm install` local usando o `package-lock.json` já commitado, sem alterar dependências.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- `clienteSchema` e `contratoSchema` prontos para reuso idêntico no formulário (React Hook Form + `@hookform/resolvers`) e nas Server Actions do Plan 01-07 — nenhuma duplicação de regra de validação entre client e server
- `npx vitest run tests/validations/` retorna exit code 0 com 12/12 testes passando
- Nenhum bloqueio para os planos 01-06/01-07/01-08 que dependem destes schemas

---
*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified present on disk (src/lib/validations/cliente.ts, src/lib/validations/contrato.ts, tests/validations/cliente.test.ts, tests/validations/contrato.test.ts). All 4 task commits (1cffe15, f573048, 9f5818c, d5f0f30) verified present in git log.

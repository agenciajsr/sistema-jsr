---
phase: 01-funda-o-acesso-clientes-e-contratos
plan: 07
subsystem: api
tags: [server-actions, drizzle, zod, nextjs, crud]

# Dependency graph
requires:
  - phase: 01-funda-o-acesso-clientes-e-contratos (Plan 01-02)
    provides: schema Drizzle (clientes, contratos) e cliente `db`
  - phase: 01-funda-o-acesso-clientes-e-contratos (Plan 01-03)
    provides: getCurrentUser/requireAdmin (helpers de sessão e papel)
  - phase: 01-funda-o-acesso-clientes-e-contratos (Plan 01-04)
    provides: clienteSchema/contratoSchema (validação Zod)
  - phase: 01-funda-o-acesso-clientes-e-contratos (Plan 01-05)
    provides: construirRegistroRenovacao/selecionarContratoAtual (lógica pura de histórico de contrato)
provides:
  - Server Actions completas de Cliente (criar com primeiro contrato em transação, editar, excluir admin-only)
  - Server Actions completas de Contrato (renovar via insert-only, excluir admin-only, listar com contrato vigente derivado)
affects: [01-08 (páginas de Cliente/Contrato que consumirão estas actions)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Actions em src/actions/*.ts com 'use server' no topo do arquivo, retornando { data } | { error }"
    - "Criação composta (cliente + primeiro contrato) via db.transaction para garantir atomicidade"
    - "Toda escrita de contrato usa insert (nunca update) para preservar histórico (D-06)"
    - "Operações destrutivas checam requireAdmin() antes de qualquer db.delete (D-03)"

key-files:
  created:
    - src/actions/clientes.ts
    - src/actions/contratos.ts
  modified: []

key-decisions:
  - "createClienteComContrato usa db.transaction e .returning({ id }) para obter o id gerado do cliente antes de inserir o primeiro contrato, evitando uma segunda query de leitura"

patterns-established:
  - "Mensagem de erro de validação de formulário padronizada: 'Não foi possível salvar. Verifique os dados e tente novamente.' (copy exata do UI-SPEC), reaproveitada em ambos os arquivos de actions"

requirements-completed: [CLI-01, CLI-02, CLI-03, CLI-04]

# Metrics
duration: 6min
completed: 2026-07-10
---

# Phase 01 Plan 07: Server Actions de Cliente e Contrato Summary

**Server Actions completas em `src/actions/clientes.ts` e `src/actions/contratos.ts`, conectando schema Drizzle, validação Zod e lógica pura de histórico de contrato (D-06 insert-only, D-03 exclusão admin-only).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-10T20:00:59Z (aprox.)
- **Completed:** 2026-07-10T20:06:56-03:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `createClienteComContrato` cria cliente + primeiro contrato em uma única transação, usando `construirRegistroRenovacao` para montar o registro do contrato (nunca um update)
- `updateCliente` valida sessão ativa e dados via `clienteSchema` antes de atualizar
- `deleteCliente` e `deleteContrato` checam `requireAdmin()` primeiro, retornando erro explícito para não-admins (D-03)
- `registrarContrato` sempre insere um novo registro de contrato — histórico anterior nunca é apagado ou editado (D-06)
- `getContratosDoCliente` retorna `{ contratoAtual, historico }`, com `contratoAtual` derivado via `selecionarContratoAtual` para consumo direto pela UI do Plan 01-08

## Task Commits

Each task was committed atomically:

1. **Task 1: Server Actions de Cliente** - `1082792` (feat)
2. **Task 2: Server Actions de Contrato** - `7cc4d63` (feat)

**Plan metadata:** _pending final commit_

## Files Created/Modified
- `src/actions/clientes.ts` - createClienteComContrato (transação), updateCliente, deleteCliente (admin-only)
- `src/actions/contratos.ts` - registrarContrato (insert-only), deleteContrato (admin-only), getContratosDoCliente

## Decisions Made
- `createClienteComContrato` usa `.returning({ id: clientes.id })` dentro da transação para obter o id do cliente recém-criado sem uma query adicional de leitura.

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- `src/actions/clientes.ts` e `src/actions/contratos.ts` prontos para serem chamados diretamente pelas páginas/formulários do Plan 01-08.
- `npm run build` e `npx vitest run` (19 testes, 4 arquivos) passam sem regressões.

---
*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: src/actions/clientes.ts
- FOUND: src/actions/contratos.ts
- FOUND commit: 1082792
- FOUND commit: 7cc4d63

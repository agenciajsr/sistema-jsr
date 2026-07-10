---
phase: 01-funda-o-acesso-clientes-e-contratos
plan: 05
subsystem: database
tags: [vitest, tdd, contratos, business-logic]

# Dependency graph
requires:
  - phase: 01-funda-o-acesso-clientes-e-contratos
    provides: "esqueleto de testes (tests/db/current-contrato.test.ts, tests/actions/contratos.test.ts) criado no Plan 01-01; schema/tipos de contratos do Plan 01-02"
provides:
  - "selecionarContratoAtual — deriva o contrato vigente de um cliente por dataInicio mais recente, sem flag armazenada"
  - "construirRegistroRenovacao — constrói o registro de uma renovação como um novo registro, sem campo id, garantindo INSERT nunca UPDATE (D-06)"
affects: [contratos, server-actions, CLI-02, CLI-03, CLI-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Funções puras de domínio (sem I/O) em src/lib/contratos/, testadas via Vitest sem mock de banco"
    - "Contrato vigente derivado por ordenação de dataInicio (localeCompare) em vez de flag is_current persistida"
    - "Registro de renovação construído como tipo sem 'id', tornando estruturalmente impossível fazer UPDATE em vez de INSERT"

key-files:
  created:
    - src/lib/contratos/current.ts
    - src/lib/contratos/renovacao.ts
  modified:
    - tests/db/current-contrato.test.ts
    - tests/actions/contratos.test.ts

key-decisions:
  - "Contrato vigente derivado por dataInicio (ordenação decrescente), não por flag is_current — evita drift entre estado armazenado e realidade, conforme 01-RESEARCH.md"
  - "construirRegistroRenovacao não importa de @/lib/validations/contrato, mantendo a função livre de dependência cruzada com o Plan 01-04"

patterns-established:
  - "Pattern: lógica de negócio de contratos vive em src/lib/contratos/ como funções puras, sem acesso a banco, testáveis isoladamente"

requirements-completed: [CLI-02, CLI-03, CLI-04]

# Metrics
duration: 10min
completed: 2026-07-10
---

# Phase 01 Plan 05: Lógica de histórico de contratos (contrato vigente + renovação) Summary

**Funções puras `selecionarContratoAtual` e `construirRegistroRenovacao` que derivam o contrato vigente por dataInicio e garantem que toda renovação vira um INSERT novo, nunca um UPDATE do registro anterior (D-06).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-10T22:45:00Z
- **Completed:** 2026-07-10T22:54:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `selecionarContratoAtual` deriva o contrato vigente de um cliente ordenando por `dataInicio` decrescente — sem depender de nenhuma flag `is_current` armazenada no banco (evita o anti-padrão de drift documentado em 01-RESEARCH.md)
- `construirRegistroRenovacao` constrói o registro de uma nova renovação de contrato como um objeto sem a chave `id`, tornando estruturalmente impossível o chamador (Server Actions do Plan 01-07) usar o resultado num `db.update` — só serve para `db.insert`
- Ambos os módulos são funções puras, sem I/O de banco, testadas com Vitest cobrindo os 4 + 3 casos de comportamento especificados no plano (incluindo edge cases: array vazio, empate de datas, ausência da chave `id`, independência entre chamadas sucessivas)

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: selecionarContratoAtual — derivação do contrato vigente (CLI-04)**
   - `a80c19e` (test) - RED: 4 casos de comportamento em tests/db/current-contrato.test.ts
   - `385bcc0` (feat) - GREEN: src/lib/contratos/current.ts
2. **Task 2: construirRegistroRenovacao — histórico nunca editado in-place (CLI-02, CLI-03)**
   - `4ee94ba` (test) - RED: 3 casos de comportamento em tests/actions/contratos.test.ts
   - `e424a7c` (feat) - GREEN: src/lib/contratos/renovacao.ts

**Plan metadata:** (pending final commit)

_Note: TDD tasks committed as test → feat pairs; nenhum refactor foi necessário (implementação já minimal e limpa após o GREEN)._

## Files Created/Modified
- `src/lib/contratos/current.ts` - Exporta `ContratoRow` e `selecionarContratoAtual`; deriva o contrato vigente por `dataInicio` mais recente
- `src/lib/contratos/renovacao.ts` - Exporta `DadosRenovacao`, `NovoContratoRecord` e `construirRegistroRenovacao`; constrói registro de renovação sem campo `id`
- `tests/db/current-contrato.test.ts` - Substituído `describe.todo` por 4 testes reais cobrindo ordenação, único contrato, array vazio e empate de datas
- `tests/actions/contratos.test.ts` - Substituído `describe.todo` por 3 testes reais cobrindo mapeamento de campos, ausência de `id` e independência entre chamadas

## Decisions Made
- Contrato vigente é sempre derivado (nunca armazenado como flag), conforme decisão já registrada em 01-RESEARCH.md — este plano apenas implementou essa decisão
- `renovacao.ts` foi mantido deliberadamente sem import de `@/lib/validations/contrato` (tipo `DadosRenovacao` local) para não criar acoplamento com o Plan 01-04, facilitando reuso e testes isolados

## Deviations from Plan

None - plan executado exatamente como escrito. Única ação fora do escopo estrito das tasks foi rodar `npm install` (node_modules não existia no worktree) para poder executar `npx vitest` — pré-requisito de ambiente, não uma mudança de código.

## Issues Encountered
- `node_modules` não estava instalado neste worktree; rodei `npm install` antes do primeiro `npx vitest run` para viabilizar a execução dos testes. Nenhum código de dependência foi alterado além do lockfile já existente.

## Next Phase Readiness
- `selecionarContratoAtual` e `construirRegistroRenovacao` estão prontos para importação pelas Server Actions do Plan 01-07 (junto com `src/lib/db` do Drizzle e `src/lib/validations/contrato.ts` do Plan 01-04)
- Nenhum bloqueio identificado para os planos seguintes da Fase 1

---
*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified on disk (src/lib/contratos/current.ts, src/lib/contratos/renovacao.ts, tests/db/current-contrato.test.ts, tests/actions/contratos.test.ts) and all 4 task commits (a80c19e, 385bcc0, 4ee94ba, e424a7c) verified present in git log.

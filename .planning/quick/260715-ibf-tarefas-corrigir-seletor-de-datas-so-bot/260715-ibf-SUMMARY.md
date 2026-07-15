---
phase: quick-260715-ibf
plan: 01
subsystem: tarefas
tags: [tarefas, kanban, calendario, popover, shadcn, react-day-picker, visao-diaria]
requires: [quick-260714-rnx, quick-260714-vy7]
provides:
  - "tarefasDaVisaoDiaria / rotuloDoDia / dataBrasiliaDeIso (lógica pura testada)"
  - "TarefaCard.concluidaEm (ISO string) + TarefasDoPeriodo.dia"
  - "Toolbar de /tarefas com botão único de dia + calendário popover"
affects: [/tarefas]
tech-stack:
  added: [react-day-picker@10 (via shadcn calendar), "@radix-ui/react-popover (via shadcn popover)"]
  patterns: ["visão diária comandada por ?dia= na URL; busca continua no intervalo [dia-30, dia] para atrasadas"]
key-files:
  created:
    - src/components/ui/popover.tsx
    - src/components/ui/calendar.tsx
  modified:
    - src/lib/tarefas/quadro.ts
    - src/lib/tarefas/quadro.test.ts
    - src/lib/tarefas/dados.ts
    - src/app/(app)/tarefas/page.tsx
    - src/app/(app)/tarefas/tarefas-quadro.tsx
    - package.json
decisions:
  - "getTarefasDoPeriodo mudou de assinatura (de/ate → dia): a URL antiga ?de=&ate= é simplesmente ignorada em favor de ?dia= (inválido/ausente → hoje)"
  - "Concluída sem concluidaEm (legado) usa fallback data === dia; status desconhecido cai na regra mais restritiva (só o próprio dia)"
  - "Conversão Date→string do day-picker usa ano/mês/dia LOCAIS, nunca toISOString (regra de fuso do projeto)"
metrics:
  duration: ~20min
  completed: 2026-07-15
---

# Quick 260715-ibf: Tarefas — seletor de datas (visão diária) Summary

Visão diária em /tarefas: botão único "Hoje" com calendário popover (shadcn popover+calendar) substitui os dois inputs date + texto duplicado, e a coluna Concluídas passa a mostrar só o que foi concluído NO dia visualizado (concluidaEm em fuso BR), via lógica pura `tarefasDaVisaoDiaria` sob TDD.

## Tasks Completed

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| 1 | Lógica pura da visão diária + concluidaEm | 542a848 (RED), 47ca011 (GREEN) | quadro.ts, quadro.test.ts, dados.ts, page.tsx |
| 2 | Toolbar com botão único + calendário popover | 029b572 | popover.tsx, calendar.tsx, tarefas-quadro.tsx, package.json |
| 3 | Revisão de usabilidade + build | 996030e | tarefas-quadro.tsx, quadro.ts |

## What Changed

- **quadro.ts (puro):** `tarefasDaVisaoDiaria(tarefas, dia)` — a_fazer/em_andamento com data ≤ dia (atrasadas visíveis); concluída só quando `concluidaEm` cai no dia (fuso BR, fallback data === dia para legado); nao_realizada só do próprio dia. `rotuloDoDia` ('Hoje' ou dd/MM/yyyy) e `dataBrasiliaDeIso` (ISO → YYYY-MM-DD em America/Sao_Paulo, nunca lança). 10 testes novos.
- **dados.ts:** `TarefaCard.concluidaEm` (timestamp serializado para ISO string na fronteira), `camposCard` inclui a coluna (já existia no schema — nenhuma migration); `getTarefasDoPeriodo(dia?)` recebe o DIA visualizado, busca o intervalo [dia-30, dia] e devolve `dia` no retorno. Materialização preguiçosa, varredura de atrasadas e queries sequenciais intactas.
- **page.tsx:** lê só `?dia=` (validado; de/ate antigos ignorados).
- **tarefas-quadro.tsx:** toolbar sem inputs date; Popover+Calendar (locale ptBR, mode single) navega via `router.push('/tarefas?dia=...')` com conversão local do Date; botão "Voltar para hoje" quando dia ≠ hoje; `tarefasDaVisaoDiaria` aplicada antes de filtros/agrupamento/estatísticas; links Nova Tarefa/Adicionar tarefa usam `dados.dia`; rodapé mostra o dia em vez de "Esta semana"; helper "Canceladas" → "Não realizadas"; estado vazio fala do dia.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Verification

- `npx vitest run` — 237 testes passando (10 novos)
- `npx tsc --noEmit` — sem erros
- `npm run build` — compila (erros ECONNREFUSED no prerender são ausência de DB local, pré-existentes e degradados graciosamente)
- Greps de regressão: nenhum `Input type="date"`, `formatarIntervalo` não renderizado, nenhum texto "período/intervalo/Esta semana" na visão diária

## Self-Check: PASSED

- src/components/ui/popover.tsx — FOUND
- src/components/ui/calendar.tsx — FOUND
- tarefasDaVisaoDiaria em quadro.ts — FOUND
- concluidaEm em dados.ts — FOUND
- Commits 542a848, 47ca011, 029b572, 996030e — FOUND

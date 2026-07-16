---
phase: quick-260716-kq1
plan: 01
subsystem: crm
tags: [kanban, reuniao, google-calendar, crm-tarefas]
requires: [google-calendar-oauth, crm-kanban, crm-tarefas]
provides: [agendamento-reuniao-no-drag, criarReuniaoCrm]
affects: [src/components/crm/kanban-crm.tsx]
tech-stack:
  added: []
  patterns: [dialog-controlado-interceptando-drag, degradacao-graciosa-calendar]
key-files:
  created:
    - src/lib/crm/reuniao.ts
    - src/lib/crm/reuniao.test.ts
    - src/components/crm/reuniao-dialog.tsx
  modified:
    - src/actions/crm-atividades.ts
    - src/components/crm/kanban-crm.tsx
decisions:
  - "Detecção da etapa por NOME normalizado (NFD sem diacríticos + trim + lowercase) — só 'Reunião agendada' exato dispara o modal"
  - "criarReuniaoCrm NÃO move a oportunidade — o kanban reusa reabrirOportunidade/moverOportunidade (mesmo desenho do fluxo de perda)"
  - "Falha do Google Calendar (inclusive NAO_CONECTADO) não desfaz atividade nem movimento — retorna avisoCalendar e vira toast.warning"
  - "Falha na criação da reunião após o movimento não reverte o card (a etapa já mudou no servidor) — toast.error explicando"
metrics:
  duration: ~15min
  completed: 2026-07-16
---

# Quick 260716-kq1: Mover para "Reunião agendada" abre modal de agendamento — Summary

**One-liner:** Arrastar um card para "Reunião agendada" agora intercepta o drag num dialog controlado que, ao confirmar, cria a atividade tipo 'reuniao' em crm_tarefas E o evento no Google Calendar (degradação graciosa sem conta conectada) antes de mover o card.

## O que foi feito

### Task 1 — Helper puro + server action (TDD)
- `src/lib/crm/reuniao.ts`: `ehEtapaReuniaoAgendada(nome)` — normaliza acentos/caixa/espaços e compara com 'reuniao agendada' exato (6 testes em `reuniao.test.ts`, RED→GREEN).
- `criarReuniaoCrm(input)` em `src/actions/crm-atividades.ts`: Zod inline (data YYYY-MM-DD, horas HH:mm, fim > início), busca a oportunidade por id+workspace (contatoId + título p/ default 'Reunião — {negócio}'), insere em `crmTarefas` (tipo 'reuniao', dataVencimento = dataFim, donoId = usuário logado), registra em crm_atividades, cria o evento via `criarEvento` com try/catch próprio → `{ data: { id, eventoCriado, avisoCalendar? } }`. Zero migration.

### Task 2 — ReuniaoDialog + interceptação no kanban
- `reuniao-dialog.tsx`: dialog controlado no padrão MotivoPerdaDialog (reset ao abrir durante o render), campos título/data/horas (defaults hoje 13:00–13:30, duração calculada ao lado)/observação, botão desabilitado quando fim <= início, tokens do tema (dark ok), 100% pt-BR.
- `kanban-crm.tsx`: `etapasReuniao` (Set derivado das colunas via helper), guard em `onDragEnd` ANTES do bloco otimista (`setPendenteReuniao` + return — nada move), `confirmarReuniao` re-localiza o card, move otimista, sequencialmente reabre (se vinha de Ganho/Perdido) → move → cria reunião; toasts distintos p/ sucesso, aviso do Calendar e falha pós-movimento.

## Verificação
- `npx vitest run` — 381 testes verdes (suíte inteira, nada quebrado).
- `npx tsc --noEmit` — sem erros.
- `npm run build` — compila e gera as 36 páginas (erros ECONNREFUSED no prerender são só ausência de banco local, pré-existentes e tratados defensivamente).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

Nenhum — fluxo completo ligado a dados reais (crm_tarefas + Google Calendar existentes).

## Commits

| Commit | Descrição |
| ------ | --------- |
| 438eb82 | test: testes do helper ehEtapaReuniaoAgendada (RED) |
| a0055e0 | feat: helper + action criarReuniaoCrm (atividade + Calendar com degradação graciosa) |
| 5261ea2 | feat: kanban abre ReuniaoDialog ao arrastar para Reunião agendada |

## Self-Check: PASSED
- src/lib/crm/reuniao.ts — FOUND
- src/lib/crm/reuniao.test.ts — FOUND
- src/components/crm/reuniao-dialog.tsx — FOUND
- Commits 438eb82 / a0055e0 / 5261ea2 — FOUND

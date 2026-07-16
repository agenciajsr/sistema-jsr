---
phase: quick-260716-khp
plan: 01
subsystem: crm
tags: [crm, kanban, motivo-perda, dialog, tdd]
requires: []
provides:
  - "MOTIVOS_PERDA + montarMotivoPerda (módulo puro testado)"
  - "MotivoPerdaDialog controlado (pt-BR)"
  - "Kanban: arrastar para Perdido abre dialog em vez de window.prompt"
affects: [crm]
tech-stack:
  added: []
  patterns:
    - "Módulo puro sem db/react para regra de negócio (decisão 260714-ita)"
    - "Dialog controlado por estado do kanban (padrão converter-cliente-dialog)"
key-files:
  created:
    - src/lib/crm/motivos-perda.ts
    - src/lib/crm/motivos-perda.test.ts
    - src/components/crm/motivo-perda-dialog.tsx
  modified:
    - src/components/crm/kanban-crm.tsx
decisions:
  - "Sem RadioGroup no registry — motivos como botões estilizados com tokens do tema (border-primary/bg-accent), funcionando no dark sem cor fixa"
  - "confirmarPerda re-localiza o card via acharCard(id) no momento da confirmação; se o card sumiu, só fecha o dialog"
  - "Valor persistido é o rótulo padronizado (ou 'Outro: {texto}') na coluna text motivo_perda existente — sem migration"
metrics:
  duration: ~15min
  completed: 2026-07-16
---

# Quick 260716-khp: CRM — motivo de perda estruturado ao mover para Perdido — Summary

**One-liner:** Dialog pt-BR com 7 motivos padronizados (Outro com campo livre obrigatório) substitui o window.prompt do Kanban ao arrastar um negócio para Perdido; motivo montado por módulo puro sob TDD e salvo na coluna `motivo_perda` existente.

## O que foi feito

### Task 1 — Módulo puro + Dialog (TDD)
- `src/lib/crm/motivos-perda.ts`: `MOTIVOS_PERDA` (lista travada: Preço alto, Sem verba no momento, Fechou com concorrente, Sem resposta/sumiu, Timing errado (voltar depois), Não qualificado, Outro) e `montarMotivoPerda(motivo, detalhe)` — rótulo direto para motivos da lista; `"Outro: {detalhe trimado}"` para Outro; `null` para Outro sem detalhe ou motivo fora da lista.
- `src/lib/crm/motivos-perda.test.ts`: 6 testes (RED → GREEN), zero imports de db/react.
- `src/components/crm/motivo-perda-dialog.tsx`: Dialog shadcn CONTROLADO (`open/onCancel/onConfirm/nomeNegocio`), motivos como botões-rádio estilizados (tokens do tema, ok no dark), Textarea obrigatório quando "Outro", botão "Confirmar perda" desabilitado enquanto `montarMotivoPerda` retorna null, reset de seleção/detalhe a cada abertura.

### Task 2 — Integração no Kanban
- `window.prompt` removido de `kanban-crm.tsx` (0 ocorrências).
- Drop em Perdido apenas seta `pendentePerda { id, nome }` e retorna — nenhum update otimista nem action antes da confirmação.
- `confirmarPerda(motivo)` reaproveita o fluxo otimista existente: guarda `anterior`, move o card com `status: 'perdida'` e `motivoPerda`, chama `moverParaPerdido(id, motivo)`, rollback + `toast.error` em erro, `toast.success('Negocio marcado como perdido.')` + `router.refresh()` em sucesso. Re-localiza o card via `acharCard(id)` na confirmação.
- Cancelar/ESC/fechar → `setPendentePerda(null)`: card fica onde estava.
- Exibição já existente confirmada: `card-oportunidade.tsx:161-162` e `ficha-lead.tsx:1139-1140` mostram `Motivo: {motivoPerda}`.

## Verificação
- `grep window.prompt kanban-crm.tsx` → 0 resultados.
- `npx vitest run` → 375 testes passando (6 novos).
- `npx tsc --noEmit` → limpo.

## Deviations from Plan

None - plan executed exactly as written. (Observação operacional: o worktree estava desatualizado em relação ao master; fast-forward `fcc45ca → 44b329f` antes de executar.)

## Known Stubs

Nenhum.

## Commits

| Commit | Descrição |
|--------|-----------|
| 7412745 | test(quick-260716-khp): testes do módulo puro (RED) |
| 5669fee | feat(quick-260716-khp): módulo puro + MotivoPerdaDialog (GREEN) |
| 4334ac6 | feat(quick-260716-khp): kanban abre o dialog ao arrastar para Perdido |

## Self-Check: PASSED

Arquivos criados e commits (7412745, 5669fee, 4334ac6) verificados no repositório.

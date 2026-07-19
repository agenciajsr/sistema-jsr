---
phase: quick-260719-rah
plan: 01
subsystem: tarefas
tags: [ui, tarefas, clickup, consistencia]
requires: [quick-260719-qr2]
provides:
  - "/tarefas/nova no layout ClickUp do detalhe (grade 2 colunas, sem Voltar duplicado)"
affects: []
tech-stack:
  added: []
  patterns: ["grade de metadados icone + rotulo w-32 + valor inline"]
key-files:
  created: []
  modified:
    - src/app/(app)/tarefas/nova/nova-tarefa-form.tsx
decisions:
  - "Etiquetas na criacao continuam como Input de texto separado por virgula (sem badges removiveis do detalhe)"
metrics:
  duration: "~10min"
  completed: "2026-07-19"
---

# Quick 260719-rah: Nova tarefa no layout ClickUp + remover botão Voltar duplicado — Summary

**One-liner:** /tarefas/nova reformada com a grade de metadados ClickUp do detalhe (2 colunas, ícone + rótulo w-32 + valor inline) e sem o botão "Voltar" interno duplicado; payload de `criarTarefa` intacto.

## O que foi feito

### Task 1 — Remover botão "Voltar" duplicado (commit d825748)
- Removido o `<Button variant="ghost">Voltar</Button>` da barra superior do form; o único caminho de volta é o `BotaoVoltar` renderizado pela page (que não mudou).
- Breadcrumb "Tarefas › Nova Tarefa" e botão "Criar tarefa" mantidos.
- Import órfão `ArrowLeft` removido; `Link` mantido (breadcrumb).

### Task 2 — Grade de metadados no padrão do detalhe (commit cf552d3)
- Grade antiga de 8 células com divisórias substituída por `grid grid-cols-1 gap-x-10 md:grid-cols-2` com linhas `flex items-center gap-2 py-2` e rótulo `w-32 shrink-0` + ícone, igual ao tarefa-detalhe.tsx.
- Coluna 1: Status (CircleDot), Datas (CalendarDays, início › prazo na mesma linha), Estimativa (Clock).
- Coluna 2: Responsável (Users, com Avatar), Prioridade (Flag), Etiquetas (Tag, Input texto por vírgula), Cliente (Building2).
- Todos os 8 campos e seus `useState` preservados; payload de `criarTarefa` inalterado.
- Imports de lucide atualizados (adicionados CalendarDays, CircleDot, Flag, Tag, Users; removido `Label` de ui, que ficou sem uso).
- Título/subtítulo, abas (3 desabilitadas), card de Notas e barra superior intocados. Sem painel de Atividade.

## Verificação
- `npx tsc --noEmit` limpo (após cada task)
- `npx vitest run src/lib/tarefas` — 686 passaram, 0 falhas
- Grep: 0 ocorrências de `ArrowLeft`; 7 ocorrências de `w-32 shrink-0` no form

## Deviations from Plan
None - plan executed exactly as written.

## Self-Check: PASSED
- [x] src/app/(app)/tarefas/nova/nova-tarefa-form.tsx modificado
- [x] Commits d825748 e cf552d3 existem

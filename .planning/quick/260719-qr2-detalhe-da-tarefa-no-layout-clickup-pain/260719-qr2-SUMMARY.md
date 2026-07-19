---
phase: quick-260719-qr2
plan: 01
subsystem: tarefas
tags: [tarefas, ui, clickup, feed-atividade]
requires: []
provides:
  - "montarFeedAtividade (merge puro comentários + histórico)"
  - "PainelAtividade estilo ClickUp com composer fixo"
  - "Layout do detalhe da tarefa em 2/3 + 1/3"
affects: ["/tarefas/[id]"]
tech-stack:
  added: []
  patterns: ["feed unificado ordenado asc via helper puro testado", "painel sticky com scroll próprio"]
key-files:
  created:
    - src/app/(app)/tarefas/[id]/painel-atividade.tsx
  modified:
    - src/lib/tarefas/quadro.ts
    - src/lib/tarefas/quadro.test.ts
    - src/app/(app)/tarefas/[id]/tarefa-detalhe.tsx
    - src/app/(app)/tarefas/[id]/tarefa-lateral.tsx
decisions:
  - "Feed ascendente (mais antigo primeiro) com scroll iniciando no fim — composer embaixo, como no ClickUp"
  - "Atividades tipo 'comentou' são filtradas do feed (o comentário real já é item próprio)"
  - "TarefaLateral virou NotasCard: Notas foi para a aba Detalhes; cards de Anexos/Atividade Recente laterais aposentados (funções vivem na aba Anexos e no painel Atividade)"
metrics:
  duration: ~35min
  completed: 2026-07-19
---

# Quick 260719-qr2: Detalhe da tarefa no layout ClickUp — Summary

Página /tarefas/[id] reformada no padrão ClickUp dos prints: conteúdo 2/3 à esquerda com grade de metadados em 2 colunas (ícone + rótulo + valor inline) e painel "Atividade" 1/3 fixo à direita unindo comentários + histórico em feed cronológico único com composer sempre visível.

## O que foi feito

### Task 1 — montarFeedAtividade (TDD)
- 4 testes escritos ANTES (RED confirmado com 4 falhas), depois implementação (GREEN, 686 testes verdes na suíte src/lib/tarefas).
- Merge puro em `quadro.ts`: ordena por createdAt ascendente (sort estável), filtra `tipo === 'comentou'`, keys estáveis `c-{id}`/`a-{id}`, genérico estrutural (não acopla em dados.ts).

### Task 2 — PainelAtividade
- Card de altura cheia com 3 regiões: header (ícone History + "Atividade"), corpo com scroll próprio rolando para o fim ao montar/crescer, composer FIXO no rodapé.
- Comentário = card destacado (`bg-muted/40`, avatar, nome, tempo relativo, "..." Excluir se `autorId === usuarioId`); evento = linha discreta via `AtividadeLinha` com nova prop `compacta` (badge colorido de status preservado).
- Composer: Enter envia, Shift+Enter quebra linha, botão SendHorizonal desabilitado vazio/salvando. Componente burro — recebe handlers, não chama actions.

### Task 3 — Layout reorganizado
- Grade de metadados 2 colunas: Col 1 Status/Datas (Início → Prazo na mesma linha + badge Repeat clicável abrindo o sheet de recorrência)/Estimativa; Col 2 Responsável/Prioridade/Etiquetas/Cliente. Todos os controles inline preservados.
- Painel direito `lg:sticky lg:top-6 lg:h-[calc(100vh-6rem)]`; mobile empilha (grid 1 coluna).
- Abas reduzidas a Detalhes/Checklists/Anexos (Comentários/Atividade removidas — vivem no painel). Estado `aba` removido (Tabs uncontrolled).
- Notas migrou para a aba Detalhes (`NotasCard` extraído de tarefa-lateral.tsx). Descrição > ~8 linhas nasce recolhida com Expandir/Recolher.
- Barra superior, recorrência, excluir, "Marcar como concluída", checklist e anexos intactos.

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 (RED) | 0e81888 | test: testes falhando de montarFeedAtividade |
| 1 (GREEN) | 046ae83 | feat: montarFeedAtividade — merge puro ordenado asc |
| 2 | 04cfa37 | feat: painel Atividade (feed unificado + composer fixo) |
| 3 | 1073f33 | feat: layout ClickUp — grade 2 colunas + painel à direita |

## Verificação
- `npx tsc --noEmit` limpo.
- `npx vitest run src/lib/tarefas` — 686 testes verdes (4 novos de montarFeedAtividade).
- ESLint sem issues nos arquivos alterados.

## Deviations from Plan

**1. [Rule 1 - Limpeza] Import morto `tempoRelativo` removido de tarefa-detalhe.tsx**
- Encontrado no lint pós-Task 3; corrigido no mesmo commit.

Fora isso, plano executado exatamente como escrito. Sem migration, sem action nova.

## Known Stubs

Nenhum — todo dado renderizado vem das actions/queries existentes.

## Self-Check: PASSED
- painel-atividade.tsx existe (169 linhas, > mín. 80)
- montarFeedAtividade exportada em quadro.ts
- Commits 0e81888, 046ae83, 04cfa37, 1073f33 no histórico

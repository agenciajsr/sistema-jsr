---
phase: quick-260714-v4c
plan: 01
subsystem: tarefas
tags: [ui, bugfix, editor, select, tarefas]
requires:
  - "src/components/ui/select.tsx"
  - "src/lib/tarefas/quadro.ts"
provides:
  - "SelectContent com position=popper como padrão (dropdowns ancorados)"
  - "EditorNotas: editor WYSIWYG compartilhado (contentEditable + execCommand)"
affects:
  - "src/app/(app)/tarefas/[id]/tarefa-lateral.tsx"
  - "src/app/(app)/tarefas/nova/nova-tarefa-form.tsx"
tech-stack:
  added: []
  patterns:
    - "contentEditable NÃO-controlado: innerHTML inicial na montagem, leitura no input/blur (evita cursor pulando)"
    - "document.execCommand (deprecated porém funcional) para WYSIWYG sem dependência"
    - "paste sanitizado como texto puro via insertText (defesa XSS em ferramenta interna)"
key-files:
  created:
    - "src/components/tarefas/editor-notas.tsx"
  modified:
    - "src/components/ui/select.tsx"
    - "src/app/(app)/tarefas/[id]/tarefa-lateral.tsx"
    - "src/app/(app)/tarefas/nova/nova-tarefa-form.tsx"
    - "src/lib/tarefas/quadro.ts"
    - "src/lib/tarefas/quadro.test.ts"
decisions:
  - "Select popper como padrão global (padrão oficial shadcn/ui) em vez de patch pontual"
  - "Editor não-controlado + remount por key para o 'Limpar notas' refletir na tela"
  - "Remover aplicarMarcacao/TipoMarcacao e seu teste (código morto após a troca WYSIWYG)"
metrics:
  duration_min: 8
  completed: "2026-07-15"
  tasks: 3
  files: 6
---

# Phase quick-260714-v4c: Corrigir 2 bugs da tarefa antes de subir — Summary

Dois bugs da tela de Tarefas corrigidos antes do deploy: (1) dropdowns de Status/Responsável/Prioridade/Projeto que abriam no canto superior esquerdo (0,0) agora ancoram abaixo do gatilho, e (2) o editor de Notas — que só inseria símbolos markdown num textarea — virou um editor WYSIWYG real (negrito/itálico/sublinhado/listas/link), compartilhado pelo detalhe e pela nova tarefa, salvando HTML e colando texto puro.

## O que foi feito

### Task 1 — SelectContent com position=popper (commit cb3590b)
- Trocado o valor padrão de `position` em `SelectContent` de `"item-aligned"` para `"popper"` (padrão oficial do shadcn/ui). Comentário em pt-BR explicando o porquê.
- `item-aligned` posicionava o menu em 0,0 quando dentro de container com `overflow-hidden` (a grade de campos da tarefa). `popper` ancora abaixo do gatilho e é robusto nesse cenário. Mudança global e correta — todos os Selects do app passam a abrir ancorados.
- Nada mais alterado no arquivo (as classes de popper já estavam condicionadas a `position === "popper"`).

### Task 2 — Componente EditorNotas (commit ae5c746)
- Criado `src/components/tarefas/editor-notas.tsx` (`'use client'`), sem novas dependências.
- `<div contentEditable>` com `role="textbox"`, `aria-multiline`, ref; HTML inicial setado UMA vez na montagem (`useEffect` deps vazias) — não recontrolado a cada tecla (evita o cursor pular).
- Toolbar (Bold, Italic, Underline, List, ListOrdered, Link) com botões `type="button"` + `onMouseDown` preventDefault (não perde a seleção) chamando `document.execCommand`. Link pede URL via `prompt`. Botão de checklist removido (não há execCommand simples — botão morto é pior que ausência).
- Paste interceptado → insere apenas `text/plain` via `insertText` (defesa XSS, sem lib de sanitização — ferramenta interna, HTML só aparece no próprio editor).
- Placeholder via `data-placeholder` + `empty:before:content-[attr(data-placeholder)]`. Altura mínima controlada por `expandido`.

### Task 3 — Integração nos dois formulários + limpeza (commit 3bc9346)
- `tarefa-lateral.tsx` e `nova-tarefa-form.tsx` passam a usar `EditorNotas`, preservando 100% da UI ao redor (cabeçalho, expandir, "Limpar notas", rodapé de status).
- "Limpar notas" força remount via `resetKey` (`key={resetKey}`) por o editor ser não-controlado; item fica desabilitado quando as notas estão vazias.
- Removidos imports/estado mortos (Textarea de Notas, arrays FERRAMENTAS, funções `marcar`, `notasRef`, ícones e `aplicarMarcacao`/`TipoMarcacao` sem uso).
- Removidos de `quadro.ts` o tipo `TipoMarcacao`, mapas `ENVOLVE`/`PREFIXA` e a função `aplicarMarcacao`; e o `describe('aplicarMarcacao')` de `quadro.test.ts` (função e teste andam juntos).

## Verificação

- `npx tsc --noEmit`: limpo (0 erros).
- `npm test` (vitest): 190 testes passam (11 arquivos).
- `npm run build`: sucesso, todas as rotas compilam.
- `npm run lint`: 10 erros / 19 warnings, TODOS em arquivos pré-existentes e fora de escopo (hooks/use-mobile.ts, lib/db/schema.ts `any`, inngest/functions/gerar-relatorios-semanais.ts, inngest/functions/sync-meta-ads.ts `any`, lib/dashboard/data.ts, lib/relatorios/gerar-relatorio.ts). Nenhum dos 6 arquivos deste plano aparece no lint — zero regressões introduzidas.

Verificação manual pendente do usuário: abrir `/tarefas/[id]` e `/tarefas/nova`, confirmar dropdowns abrindo abaixo do gatilho, toolbar formatando de verdade, salvar/reabrir mantendo a formatação e colar entrando como texto puro.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Evitar variável `notas` sem leitura em tarefa-lateral.tsx**
- **Found during:** Task 3
- **Issue:** Com o editor não-controlado, o estado `notas` (mantido conforme o plano) passava a ser escrito por `onChange={setNotas}` mas nunca lido, o que dispararia erro de lint `no-unused-vars` (destructuring de array).
- **Fix:** O item "Limpar notas" agora usa `disabled={notas.trim().length === 0}`, dando um uso genuíno (e melhor UX) ao estado. `onBlur` continua salvando o HTML autoritativo vindo do próprio editor.
- **Files modified:** src/app/(app)/tarefas/[id]/tarefa-lateral.tsx
- **Commit:** 3bc9346

### Nota de ambiente (não é desvio de código)
- O executor rodou num worktree que estava 71 commits atrás do `master` (não continha os arquivos de Tarefas). Foi feito `git merge --ff-only master` (worktree limpo, ancestral estrito — operação segura, sem perda) para trazer o estado atual antes de editar. Todos os commits deste plano estão no branch do worktree e devem ser integrados ao `master` (branch de deploy) na finalização.

## Known Stubs

Nenhum. Ambos os bugs foram resolvidos por completo; nenhum dado mockado ou placeholder introduzido.

## Self-Check: PASSED

- 6 arquivos do plano + SUMMARY presentes no disco.
- Commits cb3590b, ae5c746, 3bc9346 presentes no histórico.

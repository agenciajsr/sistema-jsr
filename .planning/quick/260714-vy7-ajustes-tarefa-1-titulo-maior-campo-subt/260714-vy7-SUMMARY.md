---
phase: quick-260714-vy7
plan: 01
subsystem: tarefas
tags: [tarefas, subtitulo, recorrencia, ui, migration]
requires:
  - Módulo tarefas (quadro Kanban, engine de recorrência pura) do quick 260714-qsy/rnx
provides:
  - Campo subtítulo (coluna nova) ponta a ponta na tarefa
  - Intervalo padrão do quadro que NÃO materializa futuro
  - Datas com um único calendário nativo (sem ícone redundante)
affects:
  - /tarefas (quadro), /tarefas/[id] (detalhe), /tarefas/nova (criação)
tech-stack:
  added: []
  patterns:
    - "Migration ADITIVA gerada por drizzle-kit, revisada (só ADD COLUMN), NÃO aplicada — orquestrador aplica"
    - "Default de janela = [hoje-30, hoje]; futuro só sob navegação explícita (de/ate)"
key-files:
  created:
    - drizzle/0018_nifty_scarecrow.sql
  modified:
    - src/lib/db/schema.ts
    - src/lib/validations/tarefa.ts
    - src/actions/tarefas.ts
    - src/lib/tarefas/dados.ts
    - src/lib/tarefas/recorrencia.ts
    - src/lib/tarefas/quadro.ts
    - src/lib/tarefas/quadro.test.ts
    - src/app/(app)/tarefas/tarefas-quadro.tsx
    - src/app/(app)/tarefas/[id]/tarefa-detalhe.tsx
    - src/app/(app)/tarefas/nova/nova-tarefa-form.tsx
decisions:
  - "subtitulo é coluna própria (text nullable), separada de descricao — o subtítulo curto embaixo do título nunca mais confunde com a Descrição completa da aba Detalhes"
  - "A causa do bug de recorrência era o intervalo PADRÃO do quadro (hoje..hoje+6), não a engine — corrigido só o default para terminar em HOJE; ocorreEm/datasDaRegra/janelaMaterializacao intactos"
  - "Nova Tarefa passa a nascer datada em HOJE (dados.hoje), já que o início do intervalo agora é hoje-30"
metrics:
  duration: ~18min
  completed: 2026-07-14
---

# Quick 260714-vy7: Ajustes na Tarefa (título maior, subtítulo, recorrência só no dia, datas) — Summary

Três correções de feedback na tela de Tarefas: campo subtítulo de verdade (coluna nova, separada da descrição) com título maior no detalhe e na criação; recorrência que deixa de poluir o quadro com ocorrências futuras ao abrir /tarefas; e campos de data com um único calendário nativo (sem ícone duplicado).

## O que foi feito

### FIX 1 — Subtítulo + título maior (Tasks 1, 3, 4)
- **Camada de dados (Task 1):** coluna `subtitulo` (text, nullable) adicionada em `schema.ts` logo após `titulo`. Migration `0018_nifty_scarecrow.sql` gerada por `drizzle-kit generate` — conteúdo revisado: **apenas** `ALTER TABLE "tarefas" ADD COLUMN "subtitulo" text;` (mais snapshot/journal). **NÃO aplicada** — o orquestrador aplica. `subtitulo` opcional em `tarefaSchema` e `atualizarTarefaSchema`; gravado em `criarTarefa` (`subtitulo: v.subtitulo || null`) e `atualizarTarefa` (`if (v.subtitulo !== undefined) set.subtitulo = v.subtitulo || null`); adicionado ao tipo `TarefaCard` e ao select `camposCard` (flui para card e detalhe via `...row`).
- **Detalhe (Task 3):** título `text-[32px]` → `text-[36px]`; novo `<Input>` de subtítulo abaixo do título (estado próprio `subtitulo`), salva via `salvarCampo({ subtitulo })` no `onBlur` quando muda. A Descrição segue só na seção Descrição (sem duplicação).
- **Criar (Task 4):** título `text-[26px] font-semibold` → `text-[36px] font-bold tracking-tight`; a antiga `<Textarea>` "Descrição breve..." embaixo do título virou `<Input>` de subtítulo (estado próprio); `subtitulo: subtitulo.trim()` enviado no `criarTarefa`. A Descrição completa na aba Detalhes (Textarea "Detalhes, contexto, links...") permanece ligada a `descricao`.

### FIX 2 — Recorrência só no dia (Task 2)
- Causa real: `intervaloPadrao` retornava `{ inicio: hoje, fim: hoje+6 }`, então `getTarefasDoPeriodo` chamava `janelaMaterializacao(hoje, hoje+6)` e materializava a série futura inteira.
- Correção: `JANELA_PASSADO_DIAS` exportado de `recorrencia.ts`; `intervaloPadrao` agora retorna `{ inicio: hoje-30, fim: hoje }` — cobre atrasadas dos últimos 30 dias e **nunca** futuro por padrão. Futuro só ao navegar (params de/ate na URL); o teto hoje+60 da engine segue preservado.
- `ocorreEm`, `datasDaRegra` e `janelaMaterializacao` **não** foram tocados.
- Os 3 links "Nova Tarefa" (cabeçalho, estado vazio, "Adicionar tarefa" por coluna) passaram de `data=${dados.inicio}` para `data=${dados.hoje}`, senão a nova tarefa nasceria datada 30 dias atrás. Os inputs de range da toolbar seguem em `dados.inicio`/`dados.fim`.
- Testes de `intervaloPadrao` em `quadro.test.ts` atualizados para a nova expectativa (`2026-07-14` ⇒ `{ inicio: '2026-06-14', fim: '2026-07-14' }`).

### FIX 3 — Datas sem ícone duplicado (Tasks 3, 4)
- Removido o `<CalendarDays>` redundante que precedia o `<input type="date">` nas células "Data de início" e "Prazo" do detalhe e da criação (o input nativo já traz o próprio calendário).
- **Detalhe:** import de `CalendarDays` **mantido** (ainda usado no cabeçalho do card de checklist).
- **Criar:** import de `CalendarDays` **removido** (ficou sem uso). `Textarea` mantido (usado na aba Descrição).

## Verificação

- `npx tsc --noEmit`: limpo (sem erros).
- `npm test`: 11 arquivos, **190 testes passando** (inclui `intervaloPadrao` atualizado; `recorrencia.test.ts` intacto).
- `npm run build`: sucesso (todas as rotas, incl. /tarefas, /tarefas/[id], /tarefas/nova).
- `npm run lint`: só erros/avisos **pré-existentes e fora de escopo** — `hooks/use-mobile.ts`, `sync-meta-ads.ts`, `gerar-relatorios-semanais.ts`, `dashboard/data.ts`, e os dois `(): any =>` em `schema.ts` (linhas 97 e 184, presentes no HEAD antes desta tarefa; confirmado via `git show HEAD:src/lib/db/schema.ts`). Nenhum erro novo introduzido pelos arquivos alterados.

Verificação conceitual do FIX-2: criar "toda segunda" numa terça → abrir /tarefas na terça não mostra ocorrência dessa série; ela só aparece na segunda seguinte (ou navegando até lá).

## Deviations from Plan

None - plan executed exactly as written. A migration recebeu o nome gerado pelo drizzle-kit (`0018_nifty_scarecrow.sql`) em vez do genérico `0018_*.sql` do plano — comportamento esperado do `drizzle-kit generate`.

## Known Stubs

None. Todos os campos e comportamentos estão ligados a dados reais (coluna nova, gravação em actions, leitura em dados.ts).

## Migration pendente

`drizzle/0018_nifty_scarecrow.sql` — `ALTER TABLE "tarefas" ADD COLUMN "subtitulo" text;` — **gerada e commitada, NÃO aplicada**. Aplicar junto das migrations pendentes anteriores (0014, 0015, 0016, 0017 conforme histórico) na ordem.

## Commits

- `064de59` feat: coluna subtitulo ponta a ponta (schema + migration 0018 + validation + actions + dados)
- `0f1236b` fix: recorrência só no dia — intervalo padrão termina em HOJE
- `21abbb0` feat: detalhe — título 36px + Input de subtítulo + datas sem CalendarDays
- `e3321d4` feat: criar — título 36px + campo subtítulo + datas sem CalendarDays

## Self-Check: PASSED

Todos os arquivos criados existem (migration 0018, SUMMARY) e todos os 4 commits de task existem no histórico.

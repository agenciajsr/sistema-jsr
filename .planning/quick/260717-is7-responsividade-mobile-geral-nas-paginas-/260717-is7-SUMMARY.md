---
phase: quick-260717-is7
plan: 01
subsystem: ui
tags: [responsividade, mobile, tailwind]
requires: []
provides:
  - "Páginas principais sem estouro horizontal em ~360-430px"
affects: [clientes, crm, campanhas, agenda]
tech-stack:
  added: []
  patterns:
    - "TabsList estreita: max-w-full justify-start overflow-x-auto (padrão do financeiro)"
    - "Grade grid-cols-7 mobile: wrapper overflow-x-auto + filho min-w-[560px] sm:min-w-0"
key-files:
  created: []
  modified:
    - src/app/(app)/clientes/[id]/page.tsx
    - src/app/(app)/clientes/clientes-lista.tsx
    - src/app/(app)/clientes/page.tsx
    - src/components/crm/crm-view.tsx
    - src/components/trafego/abas-campanhas.tsx
    - src/components/trafego/tabela-niveis.tsx
    - src/components/trafego/acoes-do-dia.tsx
    - src/components/trafego/landing-clientes.tsx
    - src/components/agenda/agenda-calendario.tsx
    - src/components/crm/ficha-lead.tsx
decisions:
  - "Ficha do lead: mobile vira coluna única com rolagem única (flex-col overflow-y-auto); as 2 colunas com rolagens independentes ficam atrás de md: — desktop byte-idêntico"
  - "Calendário da agenda: scroll horizontal mobile via wrapper neutro; classes internas (hoje/hover/dark do 260717-dyb) intocadas"
metrics:
  duration: ~15min
  completed: 2026-07-17
---

# Quick 260717-is7: Responsividade mobile geral nas páginas — Summary

**One-liner:** Varredura mobile (~360-430px): headers empilham, TabsLists de 4+ abas rolam na horizontal, calendário da agenda ganha scroll lateral e ficha do lead vira coluna única rolável — só adições de breakpoint, desktop inalterado.

## O que foi feito

### Task 1 — Headers e TabsLists (commit 5bdee99)
- `clientes/[id]/page.tsx`: header `flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`; botões (Drive/Editar/Excluir) com `flex-wrap`; TabsList de 7 abas com `max-w-full justify-start overflow-x-auto`.
- `clientes-lista.tsx`, `abas-campanhas.tsx`, `tabela-niveis.tsx`, `acoes-do-dia.tsx`: mesmo padrão de TabsList do financeiro.
- `crm-view.tsx`: TabsList Kanban/Lista com `max-w-full overflow-x-auto` (a faixa que a contém já tinha `flex-wrap`).

### Task 2 — Agenda, ficha do lead e cards de campanhas (commit 5dbaff6)
- `agenda-calendario.tsx`: cabeçalho dom–sáb + grade de dias envolvidos num único wrapper `overflow-x-auto` > `min-w-[560px] sm:min-w-0` — rolam juntos e alinhados no mobile; nada muda em ≥sm.
- `ficha-lead.tsx`: container `flex h-full min-h-0 flex-col overflow-y-auto md:grid md:grid-cols-[340px_1fr] md:overflow-visible`; painéis com `md:min-h-0 md:overflow-y-auto`; `border-r` do painel esquerdo virou `md:border-r` com `border-b` no mobile empilhado.
- `landing-clientes.tsx`: mini-stats 3 colunas mantidas, células com `min-w-0` + `truncate` para não estourar o card em 360px.

### Task 3 — Varredura final (commit b220cb2)
- Greps do plano: só sobraram os `grid-cols-7` já tratados e o `grid-cols-3` legítimo; nenhuma largura fixa suspeita.
- Único achado novo: header de `/clientes` (título + botão Cadastrar) ganhou `flex-wrap`.

## Verificação
- `npx tsc --noEmit`: sem erros
- `npx vitest run`: 2897 testes passando, 0 falhas
- `npm run build`: todas as rotas compilam
- Diff contém apenas adições de classes com breakpoint/wrappers neutros — nenhuma classe desktop removida sem equivalente `md:`/`sm:`.

## Deviations from Plan

None - plano executado exatamente como escrito (mínimo: no item 3 da Task 2 também foi adicionado `truncate` nos rótulos além dos valores, coberto pelo texto do plano).

## Known Stubs

Nenhum — só classes CSS/JSX; zero mudança de dados.

## Self-Check: PASSED
- Arquivos modificados existem e commits 5bdee99, 5dbaff6, b220cb2 presentes no log.

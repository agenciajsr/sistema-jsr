---
phase: quick-260717-dlk
plan: 01
subsystem: ui
tags: [tarefas, crm, campanhas, agenda, google-calendar]
requires: []
provides:
  - "Detalhe da tarefa com um único caminho de voltar"
  - "Kanban do CRM limpo (sem botões inertes) e mais alto"
  - "Filtro de período funcional no header da /crm"
  - "/campanhas só com seletor de período"
  - "/agenda em formato de calendário mensal/semanal"
affects: []
tech-stack:
  added: []
  patterns:
    - "Filtro de período client-side por createdAt no useMemo existente"
    - "Grade de calendário manual (grid-cols-7) com navegação por searchParams"
key-files:
  created:
    - src/components/agenda/agenda-calendario.tsx
  modified:
    - src/app/(app)/tarefas/[id]/page.tsx
    - src/components/crm/kanban-crm.tsx
    - src/components/crm/barra-origem-leads.tsx
    - src/components/crm/crm-view.tsx
    - src/components/trafego/seletor-campanhas.tsx
    - src/app/(app)/campanhas/page.tsx
    - src/app/(app)/agenda/page.tsx
    - src/actions/agenda.ts
    - src/lib/google/calendar.ts
decisions:
  - "Edição de evento no calendário via Dialog com detalhes + EventoForm reaproveitado (sem mexer no form)"
  - "Filtro de período do CRM 100% client-side sobre createdAt — sem query nova"
  - "Seletor de /campanhas virou só período; cliente continua vindo dos cards da LandingClientes e é preservado lendo a URL fresca"
metrics:
  duration: "~15min"
  completed: "2026-07-17"
---

# Quick 260717-dlk: Ajustes de UI (voltar duplicado, CRM, campanhas, agenda) — Summary

Removidos os elementos duplicados/inertes de /tarefas, /crm e /campanhas, e a /agenda foi reorganizada como calendário mensal/semanal com os eventos do Google.

## Tarefas

| Task | Nome | Commit |
| ---- | ---- | ------ |
| 1 | Limpezas de UI (tarefas, CRM, campanhas) | ee8849c |
| 2 | /agenda em formato de calendário | 98cefd4 |

## O que mudou

- **/tarefas/[id]**: removido o `BotaoVoltar` do page.tsx — fica só o botão + breadcrumb da barra branca do `TarefaDetalhe`.
- **CRM (Kanban)**: removidos "Adicionar negocio" (pé das colunas, prop `onAdicionar` extinta) e "Ver relatorio completo" (rodapé da barra de origem). Colunas mais altas: `h-[calc(100dvh-230px)] min-h-[540px]`.
- **CRM (período)**: o botão inerte virou `DropdownMenu` com "Todo o período" / 7 / 30 / 90 dias; o recorte entra no `useMemo` de `oportunidadesVisiveis` comparando `createdAt` — client-side, sem mudar `getCrmVisaoGeral`.
- **/campanhas**: Select de cliente removido do topo; `SeletorCampanhas` agora recebe só `periodoAtual` e preserva o cliente lendo `searchParams` fresco.
- **/agenda**: nova página com `?visao=mes|semana&data=YYYY-MM-DD`; o servidor calcula a grade dom→sáb e busca `getEventosDoPeriodo(inicio, fim)` (novo, sobre `listarEventosPeriodo` com `maxResults: 250`). O componente `AgendaCalendario` desenha a grade mensal (até 3 chips/dia + "+N mais", hoje destacado, dias fora do mês esmaecidos) e a semanal (7 colunas com cards verticais), com navegação ‹/›/Hoje e alternador Mês/Semana. Clique no chip abre Dialog com detalhes + `EventoForm` (edição preservada); criação continua no header; estado desconectado intacto. `getEventosProximos` não foi tocada (card do dashboard).

## Deviations from Plan

None - plano executado como escrito. Único detalhe: a edição do evento foi resolvida com Dialog de detalhes contendo o `EventoForm` (caminho mais simples previsto no próprio plano).

## Verificação

- `npx tsc --noEmit` limpo; `npx vitest run` com 452 testes passando (0 falhas) nas duas tasks.
- Greps de regressão vazios: "Adicionar negocio", "Ver relatorio", `BotaoVoltar` no page da tarefa, "Selecione um cliente" no seletor.

## Self-Check: PASSED

- src/components/agenda/agenda-calendario.tsx: FOUND
- src/app/(app)/agenda/page.tsx: FOUND
- Commits ee8849c e 98cefd4: FOUND

---
phase: quick-260717-dlk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/tarefas/[id]/page.tsx
  - src/components/crm/kanban-crm.tsx
  - src/components/crm/barra-origem-leads.tsx
  - src/components/crm/crm-view.tsx
  - src/components/trafego/seletor-campanhas.tsx
  - src/app/(app)/agenda/page.tsx
  - src/components/agenda/agenda-calendario.tsx
  - src/actions/agenda.ts
  - src/lib/google/calendar.ts
autonomous: true
requirements: [UI-TAREFAS-VOLTAR, UI-CRM-KANBAN, UI-CAMPANHAS-SELETOR, UI-AGENDA-CALENDARIO]

must_haves:
  truths:
    - "No detalhe da tarefa existe UM só caminho de voltar (o da barra branca com breadcrumb)"
    - "O Kanban do CRM não mostra mais 'Adicionar negocio' no pé das colunas nem 'Ver relatorio completo' no rodapé, e a área das colunas ficou visivelmente mais alta"
    - "O botão de período no header da /crm abre opções e filtra os cards por data de criação (não é mais inerte)"
    - "/campanhas não tem mais o Select 'Selecione um cliente' no topo (só o de período), e trocar o período continua funcionando"
    - "/agenda mostra um calendário mensal (com opção semanal) com os eventos do Google nos dias, navegação anterior/próximo e criação/edição de evento preservadas"
  artifacts:
    - path: "src/components/agenda/agenda-calendario.tsx"
      provides: "Grade de calendário mensal/semanal client-side em pt-BR"
      min_lines: 80
    - path: "src/app/(app)/agenda/page.tsx"
      provides: "Server page que busca eventos do intervalo visível e renderiza o calendário"
  key_links:
    - from: "src/app/(app)/agenda/page.tsx"
      to: "src/lib/google/calendar.ts"
      via: "listarEventos({ timeMin, timeMax }) para o intervalo do mês/semana visível"
      pattern: "listarEventos"
    - from: "src/components/crm/crm-view.tsx"
      to: "oportunidadesVisiveis"
      via: "filtro de período entra no useMemo que já filtra busca/serviço/origem"
      pattern: "filtroPeriodo"
---

<objective>
Ajustes de UI em 4 páginas do Sistema JSR: remover o botão de voltar duplicado no detalhe da tarefa; limpar o Kanban do CRM (botão "Adicionar negocio" e "Ver relatorio completo") e usar o espaço para colunas mais altas + consertar o botão de período do header; remover o seletor de cliente do topo de /campanhas; e reorganizar /agenda como calendário mensal/semanal.

Purpose: polir a UI conforme feedback do usuário (elementos duplicados/inertes) e dar à agenda um formato de calendário de verdade.
Output: 4 páginas ajustadas, textos todos em pt-BR, sem migration.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Arquivos-chave já inspecionados no planejamento:
- `src/app/(app)/tarefas/[id]/page.tsx` — linha 39 renderiza `<BotaoVoltar href="/tarefas" label="Tarefas" />`; `tarefa-detalhe.tsx` (~linha 536) já tem botão "Voltar" + breadcrumb "Tarefas › Detalhes da Tarefa" na barra branca. O duplicado a remover é o `BotaoVoltar` do page.tsx.
- `src/components/crm/kanban-crm.tsx` — linha ~429-443: botão "Adicionar negocio" no pé de cada coluna (prop `onAdicionar` opcional, NUNCA passada pelo CrmView → botão inerte "Em breve"). Linha 115: contêiner das colunas com `h-[calc(100dvh-350px)] min-h-[420px]`.
- `src/components/crm/barra-origem-leads.tsx` — span inerte "Ver relatorio completo" (title="Em breve") no final do Card.
- `src/components/crm/crm-view.tsx` — linhas 302-313: botão "Selecione um periodo" inerte (`cursor-not-allowed`, title="Em breve"). O useMemo `oportunidadesVisiveis` (linhas 106-128) já filtra busca/serviço/origem client-side sobre `dados.colunas`/`dados.colunasFechadas`.
- `src/components/trafego/seletor-campanhas.tsx` — dois Selects: cliente (remover) e período (manter). A seleção de cliente hoje é feita pelos cards da `LandingClientes`.
- `src/app/(app)/agenda/page.tsx` — lista agrupada por dia via `getEventosProximos()` (14 dias). `src/lib/google/calendar.ts` exporta `listarEventos({ timeMin, timeMax })` genérico, `OFFSET_BRASILIA`, tipo `EventoAgenda { id, titulo, descricao, local, inicio, fim, diaInteiro }`. `src/components/agenda/evento-form.tsx` cria/edita evento (usa `eventId` + `defaultValues`).
- shadcn disponíveis em `src/components/ui/`: button, card, badge, popover, dropdown-menu, tabs, dialog, tooltip etc.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Limpezas — voltar duplicado em /tarefas, Kanban do CRM (botões + altura + período) e seletor de cliente em /campanhas</name>
  <files>src/app/(app)/tarefas/[id]/page.tsx, src/components/crm/kanban-crm.tsx, src/components/crm/barra-origem-leads.tsx, src/components/crm/crm-view.tsx, src/components/trafego/seletor-campanhas.tsx</files>
  <action>
1. **/tarefas — voltar duplicado**: em `src/app/(app)/tarefas/[id]/page.tsx`, remover a linha `<BotaoVoltar href="/tarefas" label="Tarefas" />` e o import de `BotaoVoltar`. Manter o wrapper `<div className="space-y-4">` só se ainda fizer sentido (pode virar render direto de `<TarefaDetalhe .../>`). O botão "Voltar" + breadcrumb dentro de `tarefa-detalhe.tsx` ficam como o único caminho — não mexer nele.

2. **CRM — remover "Adicionar negocio"**: em `kanban-crm.tsx`, remover o `<Button ... Adicionar negocio</Button>` do pé das colunas normais, a prop `onAdicionar` da assinatura/tipos do componente e o import de `Plus` se ficar sem uso. A criação de negócio continua pelo botão "Novo Lead" (`NovoLeadDialog`) do header — não criar substituto.

3. **CRM — remover "Ver relatorio completo"**: em `barra-origem-leads.tsx`, remover o `<span>` inerte com `BarChart3` + "Ver relatorio completo" e o import de `BarChart3`.

4. **CRM — expandir o Kanban verticalmente**: em `kanban-crm.tsx` linha ~115, trocar `h-[calc(100dvh-350px)] min-h-[420px]` por `h-[calc(100dvh-230px)] min-h-[540px]` (o espaço dos elementos removidos + folga). Validar visualmente que a barra de origem (que continua existindo, só sem o link) não força scroll da página em 1080p; se forçar, ajustar o cálculo (ex.: `-260px`).

5. **CRM — consertar o botão de período do header** (`crm-view.tsx` linhas 302-313): substituir o Button inerte por um `DropdownMenu` funcional com opções: "Todo o período" (padrão), "Últimos 7 dias", "Últimos 30 dias", "Últimos 90 dias". Estado `const [filtroPeriodo, setFiltroPeriodo] = useState<number | null>(null)` (dias ou null = tudo). O label do botão reflete a opção ativa e ele perde `cursor-not-allowed`/title="Em breve".
   - Integrar no useMemo `oportunidadesVisiveis`: além de busca/serviço/origem, quando `filtroPeriodo != null`, manter só oportunidades com data de criação >= hoje - N dias. **Verificar o campo real** no tipo das oportunidades de `CrmVisaoGeral` (`src/lib/crm/dados.ts`) — os cards já mostram tempo relativo, então existe um campo tipo `criadaEm`/`criadoEm`; usar esse campo. Ajustar a condição do early-return (`if (!termo && !temFiltro)`) para também considerar o período ativo.
   - Filtro é client-side sobre os dados já carregados (mesmo padrão da busca) — NÃO mexer em `getCrmVisaoGeral` nem criar query nova.

6. **/campanhas — remover seletor de cliente**: em `seletor-campanhas.tsx`, remover o `<Select>` de cliente inteiro e a prop `clientes`/`clienteAtual` que ficar sem uso (manter `clienteAtual`? — NÃO: a função `navegar` já lê o cliente fresco de `searchParams.get('cliente')`, então o Select de período continua preservando o cliente da URL sem precisar da prop). Manter o Select de período intocado. Atualizar a chamada em `src/app/(app)/campanhas/page.tsx` (linhas 134-138) para passar só o que o componente ainda precisa (`periodoAtual`). Opcional: renomear mentalmente o componente como seletor de período, mas NÃO renomear arquivo/export (evitar churn).

Todo texto novo em pt-BR (com acentos — ex.: "Últimos 7 dias", "Todo o período").
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint 2>/dev/null; npm test -- --run 2>/dev/null || npx vitest run</automated>
  </verify>
  <done>Detalhe da tarefa com um único voltar; Kanban sem "Adicionar negocio" e rodapé sem "Ver relatorio completo", colunas mais altas; botão de período do CRM filtra cards por data de criação; /campanhas sem Select de cliente e com Select de período funcionando; typecheck + testes passando.</done>
</task>

<task type="auto">
  <name>Task 2: /agenda em formato de calendário (mensal + semanal)</name>
  <files>src/app/(app)/agenda/page.tsx, src/components/agenda/agenda-calendario.tsx, src/lib/google/calendar.ts, src/actions/agenda.ts</files>
  <action>
Reorganizar /agenda como visualização de calendário, mantendo: estado "Conecte sua agenda do Google" quando desconectado, criação de evento via `EventoForm` e edição de evento existente.

1. **Dados por intervalo** (`src/lib/google/calendar.ts` + `src/actions/agenda.ts`): criar `listarEventosPeriodo(inicioISOdate: string, fimISOdate: string)` que chama o `listarEventos` existente com `timeMin = \`${inicio}T00:00:00${OFFSET_BRASILIA}\`` e `timeMax = \`${fim}T23:59:59${OFFSET_BRASILIA}\``, `maxResults` generoso (ex.: 250). Em `actions/agenda.ts`, criar `getEventosDoPeriodo(inicio, fim)` no padrão de `getEventosProximos` (mesmo tratamento de `NAO_CONECTADO` → `{ conectado: false, eventos: [] }`, try/catch com log). Manter `getEventosProximos` intocada (o card do dashboard usa).

2. **Page** (`src/app/(app)/agenda/page.tsx`): virar page com `searchParams: Promise<{ visao?: string; data?: string }>`. `visao` = 'mes' (padrão) | 'semana'; `data` = YYYY-MM-DD âncora (padrão = hoje em Brasília, via `toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })`). Calcular o intervalo visível NO SERVIDOR:
   - mês: do domingo da semana do dia 1 até o sábado da semana do último dia (grade completa de 5-6 semanas);
   - semana: domingo→sábado da semana da âncora.
   Buscar `getEventosDoPeriodo(inicio, fim)` e renderizar header (título "Agenda", subtítulo, `<EventoForm />` quando conectado — preservar) + `<AgendaCalendario ... />`. Manter `export const maxDuration = 60` e o card de desconectado atual.

3. **Componente** (`src/components/agenda/agenda-calendario.tsx`, client): recebe `{ visao, dataAncora, eventos }`. NÃO usar o `calendar.tsx` do shadcn (é date-picker, não grade de eventos) — montar a grade na mão com Tailwind:
   - **Barra de controles**: botões ‹ / › e "Hoje" (navegam via `router.push('/agenda?visao=...&data=...')` recalculando a âncora: ±1 mês ou ±7 dias com date-fns `addMonths`/`addDays`/`format`), título central ("julho de 2026" ou "13 – 19 de julho"), e alternador Mês/Semana (Tabs ou dois Buttons com variant condicional).
   - **Visão mensal**: cabeçalho dom–sáb, grade `grid-cols-7` com uma célula por dia (borda, número do dia no canto, dia de hoje destacado com `bg-primary/10` ou anel, dias fora do mês esmaecidos). Dentro da célula, até 3 chips de evento (horário curto + título truncado, `bg-primary/10 text-primary rounded px-1 text-xs`); se houver mais, linha "+N mais". Agrupar eventos por dia com a mesma lógica `chaveDia` (fuso `America/Sao_Paulo`) da página atual — mover `chaveDia`/`horario`/`paraDatetimeLocal` para dentro do componente (ou um helper local).
   - **Visão semanal**: 7 colunas (uma por dia, cabeçalho com dia da semana + número), eventos do dia listados verticalmente como cards pequenos com horário + título + local — sem grade de horas (simples, lista por dia).
   - **Editar evento**: clique no chip abre a edição. Reaproveitar `EventoForm` com `eventId` + `defaultValues` como a página atual já faz (linhas 128-139 do page atual) — se o trigger do `EventoForm` não couber num chip, renderizar o chip como trigger dentro do `EventoForm` ou abrir um Popover/Dialog do dia com a lista de eventos, cada um com seu `EventoForm`. Ler `evento-form.tsx` antes e escolher o caminho mais simples que preserve a edição.
   - Célula de dia vazio pode ficar vazia (sem CTA por célula); a criação fica no botão do header.
   Tudo em pt-BR via `toLocaleDateString('pt-BR', ...)`/date-fns com locale `ptBR` (já usado no projeto).

4. Remover da page o código da lista agrupada antiga que ficar sem uso.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <done>/agenda renderiza calendário mensal por padrão com eventos do Google nos dias, alternador para semana, navegação anterior/próximo/hoje, criação (header) e edição (clique no evento) preservadas, estado desconectado intacto; typecheck e testes passando.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` limpo e suíte de testes verde (nenhum teste existente quebrado — as mudanças são de UI, sem tocar módulos puros testados).
- Grep de regressão: `grep -rn "Adicionar negocio" src/` e `grep -rn "Ver relatorio" src/` retornam vazio; `grep -n "BotaoVoltar" "src/app/(app)/tarefas/[id]/page.tsx"` retorna vazio; `grep -n "Selecione um cliente" src/components/trafego/seletor-campanhas.tsx` retorna vazio.
- `next build` local opcional se o typecheck passar.
</verification>

<success_criteria>
As 4 páginas refletem exatamente os pedidos do usuário: 1 só voltar em /tarefas/[id]; CRM sem botões inertes, Kanban mais alto e período funcional; /campanhas sem seletor de cliente no topo; /agenda em formato de calendário mensal/semanal. Tudo em pt-BR, sem migration, sem quebrar fluxos existentes (criação de lead, edição de evento, troca de período em /campanhas).
</success_criteria>

<output>
Após concluir, criar `.planning/quick/260717-dlk-ajustes-de-ui-tarefas-voltar-duplicado-c/260717-dlk-SUMMARY.md`
</output>

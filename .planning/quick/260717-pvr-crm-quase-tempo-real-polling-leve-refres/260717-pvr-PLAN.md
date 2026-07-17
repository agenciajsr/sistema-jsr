---
phase: quick-260717-pvr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/crm/novidades.ts
  - src/lib/crm/novidades.test.ts
  - src/hooks/use-refresh-periodico.ts
  - src/components/crm/crm-view.tsx
  - src/components/crm/kanban-crm.tsx
autonomous: true
requirements: [QUICK-PVR]
must_haves:
  truths:
    - "Com a /crm aberta e visível, um lead novo criado via webhook aparece no kanban em até ~30s sem F5"
    - "Ao voltar o foco para a aba da /crm, os dados são rebuscados imediatamente"
    - "Quando um lead novo aparece, um toast 'Novo lead: <nome>' é exibido"
    - "Nenhum refresh acontece com a aba oculta, durante drag&drop ou com dialog aberto"
  artifacts:
    - path: "src/hooks/use-refresh-periodico.ts"
      provides: "Hook client de polling leve (30s, aba visível, pausável) + refresh no foco"
    - path: "src/lib/crm/novidades.ts"
      provides: "Função pura detectarNovasOportunidades (comparação de ids entre renders)"
    - path: "src/lib/crm/novidades.test.ts"
      provides: "Testes vitest da detecção de novidades"
  key_links:
    - from: "src/components/crm/crm-view.tsx"
      to: "src/hooks/use-refresh-periodico.ts"
      via: "useRefreshPeriodico({ pausado }) chamando router.refresh()"
      pattern: "useRefreshPeriodico"
    - from: "src/components/crm/kanban-crm.tsx"
      to: "src/components/crm/crm-view.tsx"
      via: "prop onArrastandoChange sinalizando drag ativo"
      pattern: "onArrastandoChange"
---

<objective>
CRM quase tempo real: a /crm rebusca os dados sozinha (polling leve de ~30s só com a aba visível + refresh imediato ao voltar o foco) e avisa com toast quando um lead novo aparece — sem endpoint novo, sem Supabase Realtime, reusando o fluxo Server Component existente (getCrmVisaoGeral via router.refresh()).

Purpose: leads de tráfego pago chegam via webhook a qualquer momento e hoje só aparecem após F5.
Output: hook reutilizável + módulo puro testado + integração no CrmView/KanbanCrm.
</objective>

<context>
@src/app/(app)/crm/page.tsx
@src/components/crm/crm-view.tsx
@src/components/crm/kanban-crm.tsx
@src/lib/crm/dados.ts

Fatos verificados no código:
- `CrmView` é 'use client', recebe `dados: CrmVisaoGeral` como prop do Server Component e já usa `router.refresh()` em várias actions — o caminho de refresh já existe.
- Estados de dialog no CrmView: `dialogPipeline !== null`, `dialogEtapas`, `confirmarExcluirPipeline`. `NovoLeadDialog` (src/components/crm/novo-lead-dialog.tsx) controla o próprio open internamente — verificar e, se necessário, expor via prop opcional `onOpenChange` para o pai saber que está aberto.
- Drag: `KanbanCrm` mantém `arrastandoId` (useState, linha ~135) com `onDragStart`/`onDragEnd` do dnd-kit — o CrmView NÃO enxerga esse estado hoje.
- Toaster do sonner já está montado em src/app/layout.tsx; `toast` já é importado no CrmView.
- Estrutura de dados: `dados.colunas` e `dados.colunasFechadas`, cada coluna com `oportunidades[]` contendo `id`, `titulo`, `contatoNome`.
- Restrição de projeto: UI em pt-BR; nada de query nova no banco (1 refresh/30s por aba é aceitável).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Módulo puro de detecção de novidades + hook useRefreshPeriodico</name>
  <files>src/lib/crm/novidades.ts, src/lib/crm/novidades.test.ts, src/hooks/use-refresh-periodico.ts</files>
  <behavior>
    detectarNovasOportunidades(idsAnteriores: Set&lt;string&gt;, atuais: { id: string; titulo: string; contatoNome: string | null }[]):
    - Test 1: retorna [] quando todos os ids atuais já existiam
    - Test 2: retorna só as oportunidades cujo id NÃO estava em idsAnteriores
    - Test 3: idsAnteriores vazio (primeiro render) retorna [] — nunca toastar a carga inicial (o chamador passa null/skip no 1º render; a função pode receber um flag `primeiraCarga: boolean` ou o chamador simplesmente não chama; escolher a forma mais simples e testar)
    - Test 4: remoção de ids (lead ganho/perdido some) não gera novidade
    - Test 5: rótulo do toast = contatoNome quando existir, senão titulo (função auxiliar rotuloNovidade testada)
  </behavior>
  <action>
    1. Criar `src/lib/crm/novidades.ts` — módulo PURO (zero import de react/db), seguindo o padrão do projeto (ex.: src/lib/crm/origem.ts). Exportar `detectarNovasOportunidades` e `rotuloNovidade`. Escrever os testes primeiro (vitest, mesmo estilo dos demais *.test.ts do repo), depois implementar.
    2. Criar `src/hooks/use-refresh-periodico.ts` ('use client'):
       - Assinatura: `useRefreshPeriodico({ pausado = false, intervaloMs = 30_000 }: { pausado?: boolean; intervaloMs?: number })`.
       - `setInterval` que só chama `router.refresh()` quando `document.visibilityState === 'visible'` E `!pausado`.
       - Listener de `visibilitychange` + `focus` na window: ao ficar visível/focado (e `!pausado`), dispara `router.refresh()` imediato — com throttle simples (ex.: não refrescar se o último refresh foi há < 5s, via useRef de timestamp) para focus+visibilitychange não dispararem em dobro.
       - `pausado` lido via ref atualizada a cada render (evitar recriar o interval a cada mudança de estado do CrmView).
       - Cleanup completo no unmount (clearInterval + removeEventListener).
       - Comentários em pt-BR explicando o porquê (padrão do projeto).
  </action>
  <verify>
    <automated>npx vitest run src/lib/crm/novidades.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>Testes do módulo puro verdes (mínimo 5 casos); hook compila sem erro de tipo; nenhum arquivo existente alterado ainda.</done>
</task>

<task type="auto">
  <name>Task 2: Integrar polling + toast de novo lead no CrmView (pausando em drag e dialogs)</name>
  <files>src/components/crm/crm-view.tsx, src/components/crm/kanban-crm.tsx, src/components/crm/novo-lead-dialog.tsx (só se precisar expor open)</files>
  <action>
    1. `KanbanCrm`: adicionar prop opcional `onArrastandoChange?: (ativo: boolean) => void`, chamada em `onDragStart` (true) e `onDragEnd` (false, inclusive nos caminhos de cancel/early-return). Não mudar nada mais no kanban.
    2. `NovoLeadDialog`: se o open for interno (verificar), adicionar prop opcional `onOpenChange?: (open: boolean) => void` chamada junto do setOpen interno — sem alterar comportamento existente.
    3. `CrmView`:
       - Estado `arrastando` (boolean) alimentado por `onArrastandoChange`; estado `novoLeadAberto` via prop do NovoLeadDialog.
       - `const pausado = arrastando || novoLeadAberto || dialogPipeline !== null || dialogEtapas || confirmarExcluirPipeline`.
       - `useRefreshPeriodico({ pausado })`.
       - Toast de novo lead: `useRef<Set<string> | null>` com os ids do render anterior; em um `useEffect` dependente de `dados.colunas`/`dados.colunasFechadas`, montar o array plano de oportunidades (id, titulo, contatoNome), chamar `detectarNovasOportunidades`; para cada novidade, `toast.info(\`Novo lead: ${rotuloNovidade(o)}\`)` (pt-BR); atualizar o ref. No primeiro render só popular o ref (sem toast). Limitar a ex.: 3 toasts por ciclo (se chegarem muitos de uma vez, um toast resumo "X novos leads").
    4. NÃO aplicar na /funil nesta tarefa (a /funil é redirect para /crm conforme 260715-0zf — confirmar com grep e, se for redirect mesmo, nada a fazer).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run && npm run build</automated>
  </verify>
  <done>Build verde; /crm rebusca sozinha a cada ~30s com aba visível, refresca ao voltar o foco, pausa durante drag/dialogs; lead novo entre renders dispara toast "Novo lead: ..." e a carga inicial nunca toasta.</done>
</task>

</tasks>

<verification>
- `npx vitest run` — suíte completa verde (incluindo novidades.test.ts)
- `npx tsc --noEmit` e `npm run build` verdes
- Sem endpoint novo, sem mudança em getCrmVisaoGeral, sem migration
</verification>

<success_criteria>
- Lead criado via POST /api/crm/leads aparece na /crm aberta em até ~30s, com toast "Novo lead: <nome>"
- Nenhum refresh com aba oculta, durante drag ou com dialog aberto
- Refresh imediato (com throttle de ~5s) ao focar/voltar para a aba
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260717-pvr-crm-quase-tempo-real-polling-leve-refres/260717-pvr-SUMMARY.md`
</output>

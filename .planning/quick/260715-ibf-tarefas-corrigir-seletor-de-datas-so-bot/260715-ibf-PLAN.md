---
phase: quick-260715-ibf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/tarefas/quadro.ts
  - src/lib/tarefas/quadro.test.ts
  - src/lib/tarefas/dados.ts
  - src/app/(app)/tarefas/page.tsx
  - src/app/(app)/tarefas/tarefas-quadro.tsx
  - src/components/ui/popover.tsx
  - src/components/ui/calendar.tsx
  - package.json
autonomous: true
requirements: [QUICK-IBF-01, QUICK-IBF-02, QUICK-IBF-03]

must_haves:
  truths:
    - "Ao abrir /tarefas o quadro mostra APENAS o dia de hoje: um único botão 'Hoje' na toolbar, sem inputs de data nem texto de intervalo duplicado"
    - "Clicar no botão de data abre um calendário popover; escolher outro dia navega para aquele dia e o rótulo do botão vira a data escolhida (ex. 12/07/2026) com opção de voltar para hoje"
    - "Tarefa concluída ontem NÃO aparece na coluna Concluídas da visão de hoje; apenas as concluídas no dia visualizado aparecem"
    - "Tarefas a_fazer/em_andamento atrasadas (data anterior ao dia visualizado) continuam aparecendo em Pendentes/Em Andamento"
    - "Rodapé não diz mais 'Esta semana' na visão diária; links Nova Tarefa carregam a data visualizada"
  artifacts:
    - path: "src/components/ui/popover.tsx"
      provides: "Popover shadcn/ui"
    - path: "src/components/ui/calendar.tsx"
      provides: "Calendar shadcn/ui (react-day-picker)"
    - path: "src/lib/tarefas/quadro.ts"
      provides: "tarefasDaVisaoDiaria + rotuloDoDia (lógica pura testada)"
      contains: "tarefasDaVisaoDiaria"
    - path: "src/lib/tarefas/dados.ts"
      provides: "concluidaEm no TarefaCard + suporte ao dia visualizado"
      contains: "concluidaEm"
  key_links:
    - from: "src/app/(app)/tarefas/tarefas-quadro.tsx"
      to: "src/lib/tarefas/quadro.ts"
      via: "tarefasDaVisaoDiaria aplicada antes de agruparPorStatus"
      pattern: "tarefasDaVisaoDiaria"
    - from: "src/app/(app)/tarefas/page.tsx"
      to: "src/lib/tarefas/dados.ts"
      via: "searchParam dia -> getTarefasDoPeriodo"
      pattern: "dia"
---

<objective>
Corrigir o seletor de datas da tela /tarefas (visão padrão = UM DIA, botão "Hoje" com calendário popover no lugar dos dois inputs date + texto duplicado) e limpar a coluna Concluídas para mostrar somente tarefas concluídas NO dia visualizado — mais uma passada de usabilidade (labels do rodapé, links Nova Tarefa com a data visualizada).

Purpose: hoje o usuário vê "hoje 15/06/2026 - 15/07/2026 - 15/06/2026 - 15/07/2026" (confuso) e tarefas concluídas de dias anteriores poluindo o quadro do dia.
Output: /tarefas com visão diária limpa, calendário popover, coluna Concluídas correta e testes Vitest da lógica pura passando.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/app/(app)/tarefas/tarefas-quadro.tsx
@src/app/(app)/tarefas/page.tsx
@src/lib/tarefas/dados.ts
@src/lib/tarefas/quadro.ts
@src/lib/tarefas/recorrencia.ts
@src/lib/date-br.ts

<interfaces>
Fatos verificados no repo (NÃO redescobrir):

- `tarefas.concluidaEm` JÁ EXISTE no schema (src/lib/db/schema.ts:186, `timestamp('concluida_em', { withTimezone: true })`) e JÁ é preenchida/limpa por `atualizarTarefa` (src/actions/tarefas.ts:167-168: marca ao concluir, `null` ao reabrir). NENHUMA migration é necessária.
- `popover.tsx` e `calendar.tsx` NÃO existem em src/components/ui — adicionar via `npx shadcn@latest add popover calendar` (calendar traz react-day-picker). components.json já existe (legado new-york/neutral).
- `camposCard` em dados.ts NÃO seleciona `concluidaEm` hoje — precisa entrar na SELECT e no tipo `TarefaCard` (serializar para ISO string na fronteira server→client, como já é feito com createdAt em lerComentarios).
- Datas do domínio são strings 'YYYY-MM-DD' comparadas lexicograficamente; `hojeBrasilia()` em src/lib/date-br.ts dá o hoje no fuso BR. `concluidaEm` é timestamp — para comparar com o dia visualizado, converter para 'YYYY-MM-DD' de Brasília (Intl.DateTimeFormat en-CA com timeZone 'America/Sao_Paulo', ou helper existente em date-br.ts se houver).
- Varredura de atrasadas (recorrentes viram nao_realizada) mora no passo 7 de getTarefasDoPeriodo — NÃO mexer.
- Queries em dados.ts/page.tsx são SEQUENCIAIS por obrigação (pool max=3, max_pipeline=0) — manter.
- `janelaMaterializacao(hoje, diaSelecionado)` já aceita o dia selecionado e já aplica o teto hoje+60 — reutilizar passando o dia.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lógica pura da visão diária + concluidaEm na camada de dados</name>
  <files>src/lib/tarefas/quadro.ts, src/lib/tarefas/quadro.test.ts, src/lib/tarefas/dados.ts, src/app/(app)/tarefas/page.tsx</files>
  <behavior>
    Nova função pura em quadro.ts: `tarefasDaVisaoDiaria(tarefas, dia)` — decide o que aparece na visão de UM dia:
    - Teste 1: a_fazer/em_andamento com data <= dia aparecem (atrasadas continuam visíveis)
    - Teste 2: a_fazer/em_andamento com data > dia NÃO aparecem
    - Teste 3: concluida com concluidaEmDia === dia aparece; concluida com concluidaEmDia !== dia NÃO aparece (o caso do bug: concluída ontem some da visão de hoje)
    - Teste 4: concluida sem concluidaEm (legado) usa fallback data === dia
    - Teste 5: nao_realizada aparece somente com data === dia (não acumula lixo de dias anteriores)
    Nova função pura `rotuloDoDia(dia, hoje)`: retorna 'Hoje' quando dia === hoje, senão 'dd/MM/yyyy' (reusar paraBR interno).
    Helper puro `dataBrasiliaDeIso(iso: string | null): string | null` (timestamp ISO → 'YYYY-MM-DD' no fuso America/Sao_Paulo via Intl.DateTimeFormat 'en-CA'; null/inválido → null, nunca lança) — testar com um ISO 23h UTC que vira o dia anterior em BR.
  </behavior>
  <action>
    RED primeiro: escrever os testes acima em src/lib/tarefas/quadro.test.ts (padrão dos testes existentes do módulo), rodar e ver falhar; depois implementar em quadro.ts. Módulo continua PURO (zero import de db/react/next).

    Em dados.ts:
    - Adicionar `concluidaEm: string | null` ao tipo TarefaCard; incluir `tarefas.concluidaEm` em camposCard; em paraCard, serializar `concluidaEm` para ISO string (`?.toISOString() ?? null`).
    - getTarefasDoPeriodo continua buscando o INTERVALO [dia-30, dia] (é o que alimenta as atrasadas) — mas o "dia visualizado" passa a comandar: aceitar o param `dia` (ou manter a assinatura atual e a página passar de=dia-30/ate=dia; escolher o mais simples e documentar). O retorno TarefasDoPeriodo ganha o campo `dia: string` (o dia visualizado, = fim do intervalo). Passar o dia para janelaMaterializacao (já suporta).

    Em page.tsx: searchParams passa a ler `dia?: string` (validar com o mesmo regex DATA_ISO; inválido/ausente → hoje). Manter de/ate fora da nova UI (podem cair; se vierem na URL antiga, ignorar em favor de dia).
  </action>
  <verify>
    <automated>npx vitest run src/lib/tarefas</automated>
  </verify>
  <done>Testes novos + 190 existentes passando; TarefaCard expõe concluidaEm; página resolve o dia visualizado a partir de ?dia=.</done>
</task>

<task type="auto">
  <name>Task 2: Toolbar com botão único + calendário popover (shadcn)</name>
  <files>src/components/ui/popover.tsx, src/components/ui/calendar.tsx, package.json, src/app/(app)/tarefas/tarefas-quadro.tsx</files>
  <action>
    Rodar `npx shadcn@latest add popover calendar` (adiciona react-day-picker). Se o CLI reclamar do components.json legado, criar os dois arquivos manualmente seguindo o registry oficial (decisão já registrada no STATE: values legados new-york/neutral funcionam com shadcn add).

    Em tarefas-quadro.tsx:
    - REMOVER os dois `Input type="date"`, o separador "–" e o `<span>{formatarIntervalo(...)}</span>` da toolbar (a causa do "15/06 - 15/07 - 15/06 - 15/07"). Remover import de formatarIntervalo se ficar sem uso.
    - Substituir por UM botão outline com ícone Calendar cujo rótulo é `rotuloDoDia(dados.dia, dados.hoje)` ('Hoje' ou '12/07/2026'). Envolver em Popover: PopoverTrigger = o botão; PopoverContent = componente Calendar (mode="single", locale pt-BR se disponível via date-fns/locale já no projeto). Ao selecionar um dia: `router.push('/tarefas?dia=YYYY-MM-DD')` e fechar o popover (converter o Date do day-picker para string usando ano/mês/dia LOCAIS do objeto, nunca toISOString — regra do fuso do projeto). Quando dia !== hoje, mostrar dentro do popover (ou ao lado do botão) um botão "Voltar para hoje" → `router.push('/tarefas')`.
    - Aplicar a visão diária: `const doDia = tarefasDaVisaoDiaria(dados.tarefas, dados.dia)` ANTES de filtrarTarefas/agruparPorStatus/estatisticasDoQuadro (tudo dentro dos useMemo existentes, com deps corretas).
    - Links "Nova Tarefa" e "Adicionar tarefa": trocar `data=${dados.hoje}` por `data=${dados.dia}` (a tarefa nasce no dia visualizado).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/lib/tarefas</automated>
  </verify>
  <done>Toolbar tem apenas busca + botão de dia (popover calendário) + prioridade + Filtros; nenhum input date; escolher dia navega via ?dia=; quadro mostra só a visão diária correta.</done>
</task>

<task type="auto">
  <name>Task 3: Revisão de usabilidade (rodapé, estado vazio, textos) + build</name>
  <files>src/app/(app)/tarefas/tarefas-quadro.tsx, src/lib/tarefas/quadro.ts</files>
  <action>
    Passada de coerência com a visão diária (textos em pt-BR):
    - Rodapé: trocar o helper "Esta semana" sob "Total de Tarefas" por rótulo coerente com o dia ('Hoje' quando dia === hoje, senão a data dd/MM — pode reusar rotuloDoDia). COLUNA_HELPER: revisar "Canceladas" sob "Não Feitas" → "Não realizadas" (o status não é cancelamento). Manter o resto do layout Kanban de 4 colunas intacto (aprovado em 260714-rnx/260714-so8).
    - Estado vazio: texto atual fala em "período"/"intervalo de datas" — trocar para o dia ("Nenhuma tarefa neste dia", "Escolha outro dia no calendário acima ou crie a primeira tarefa."), e o botão Nova Tarefa do vazio também usa dados.dia.
    - Conferir acessibilidade do novo botão de data (aria-label descritivo, ex. "Escolher dia do quadro").
    - Rodar a suíte completa e o build de produção; corrigir qualquer aviso/erro que surgir das mudanças.
  </action>
  <verify>
    <automated>npx vitest run && npm run build</automated>
  </verify>
  <done>Build de produção verde, todos os testes passando, nenhum texto residual de "intervalo/período/Esta semana" na visão diária.</done>
</task>

</tasks>

<verification>
- `npx vitest run` — suíte completa verde (inclui os testes novos de tarefasDaVisaoDiaria/rotuloDoDia/dataBrasiliaDeIso)
- `npm run build` — produção compila
- Grep de regressão: `formatarIntervalo` não é mais renderizado na toolbar; nenhum `Input type="date"` em tarefas-quadro.tsx; links de criação usam `dados.dia`
</verification>

<success_criteria>
- /tarefas abre na visão de HOJE com um único botão de data ("Hoje") que abre calendário popover; escolher outro dia navega para `?dia=` e o rótulo vira a data
- Coluna Concluídas mostra somente tarefas com concluidaEm no dia visualizado (fuso BR); atrasadas a_fazer/em_andamento continuam visíveis
- Nenhum cron novo; materialização preguiçosa e varredura de atrasadas intactas; queries sequenciais preservadas
- Rodapé e textos coerentes com visão diária, em pt-BR
</success_criteria>

<output>
After completion, create `.planning/quick/260715-ibf-tarefas-corrigir-seletor-de-datas-so-bot/260715-ibf-SUMMARY.md`
</output>

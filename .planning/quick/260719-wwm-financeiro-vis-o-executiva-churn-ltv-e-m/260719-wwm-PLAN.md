---
phase: quick-260719-wwm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/schema.ts
  - src/lib/validations/cliente.ts
  - src/actions/clientes.ts
  - scripts/aplicar-migration-0038.ts
  - src/lib/financeiro/executiva.ts
  - src/lib/financeiro/executiva.test.ts
  - src/actions/financeiro.ts
  - src/app/(app)/financeiro/visao-analitica.tsx
  - src/app/(app)/financeiro/page.tsx
  - src/app/(app)/painel/page.tsx (ou componente dashboard)
  - src/app/(app)/financeiro/transacao-form.tsx
autonomous: true
requirements: [QUICK-WWM-CHURN-LTV, QUICK-WWM-MODAL-TRANSACAO]

must_haves:
  truths:
    - "Encerrar um cliente grava data_encerramento junto com motivo_encerramento"
    - "A página Financeiro (aba Visão Analítica) mostra churn mensal + acumulado 3/6 meses, LTV médio e ranking de motivos de encerramento"
    - "O Painel geral mostra chips/resumo de churn e LTV"
    - "Adicionar/editar transação abre em Dialog centralizado (não empurra a página)"
    - "Testes Vitest cobrem churn e LTV (lógica pura, sem banco)"
  artifacts:
    - path: "src/lib/financeiro/executiva.ts"
      provides: "taxaDeChurn, churnAcumulado, ltvMedio, rankingMotivos — módulo puro, zero import de db/react"
    - path: "src/lib/financeiro/executiva.test.ts"
      provides: "Testes Vitest de churn e LTV"
    - path: "scripts/aplicar-migration-0038.ts"
      provides: "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_encerramento date (idempotente)"
    - path: "src/app/(app)/financeiro/transacao-form.tsx"
      provides: "Formulário dentro de shadcn Dialog"
  key_links:
    - from: "src/actions/clientes.ts"
      to: "clientes.data_encerramento"
      via: "status === 'encerrado' preenche dataEncerramento (mesma linha do motivoEncerramento)"
      pattern: "dataEncerramento"
    - from: "src/app/(app)/financeiro/visao-analitica.tsx"
      to: "src/lib/financeiro/executiva.ts"
      via: "getVisaoAnalitica (ou nova função de dados) consome o módulo puro"
      pattern: "executiva"
---

<objective>
Financeiro — visão executiva (churn mensal + acumulado, LTV médio, ranking de motivos de encerramento) com cards na Visão Analítica e chips no Painel; e modernização do formulário de nova transação para Dialog centralizado no padrão do modal de novo lead do CRM.

Output: coluna `clientes.data_encerramento` (migration 0038 aditiva), módulo puro testado `src/lib/financeiro/executiva.ts`, cards/chips na UI, `transacao-form.tsx` como Dialog.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/db/schema.ts
@src/lib/validations/cliente.ts
@src/actions/clientes.ts
@src/lib/financeiro/calculos.ts
@src/actions/financeiro.ts
@src/app/(app)/financeiro/page.tsx
@src/app/(app)/financeiro/visao-analitica.tsx
@src/app/(app)/financeiro/transacao-form.tsx
@src/components/crm/novo-lead-dialog.tsx
@src/components/ui/dialog.tsx
@scripts/aplicar-migration-0036.ts

<interfaces>
Padrões OBRIGATÓRIOS do projeto (STATE.md):
- Matemática financeira em módulo PURO em src/lib/financeiro (zero import de db/auth/react) — actions e UI só consomem (decisão quick-260714-ita).
- Queries de dados: poucas queries AGREGADAS SEQUENCIAIS + merge em memória via módulo puro (pool max=5, nunca engordar os Promise.all do /financeiro/page.tsx — adicionar fetch sequencial após previsaoMeses, como getVisaoCobrancas).
- MIGRATIONS: NUNCA rodar drizzle-kit migrate/generate (snapshots 0023/0029 colidem — 0034 em diante são geradas à mão). Seguir o padrão de scripts/aplicar-migration-0036.ts: script tsx idempotente com ADD COLUMN IF NOT EXISTS lendo DIRECT_URL. Próximo número livre: 0038. Gerar o script mas NÃO aplicar (usuário aplica).
- Encerramento hoje: src/actions/clientes.ts linha ~26 já normaliza `motivoEncerramento: data.status === 'encerrado' ? ... : null` — data_encerramento entra no MESMO ponto.
- schema.ts: motivoEncerramento em clientes (linha 73); contratos têm dataInicio/valorMensal (numeric string).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migration 0038 data_encerramento + módulo puro de churn/LTV sob TDD</name>
  <files>src/lib/db/schema.ts, src/lib/validations/cliente.ts, src/actions/clientes.ts, scripts/aplicar-migration-0038.ts, src/lib/financeiro/executiva.ts, src/lib/financeiro/executiva.test.ts</files>
  <behavior>
    Testes (executiva.test.ts) escritos ANTES da implementação:
    - taxaDeChurn(mes): 1 encerrado no mês / 10 ativos no início do mês = 10%; 0 ativos no início → null (sem divisão por zero); encerrado sem data_encerramento não conta.
    - churnAcumulado(3 meses / 6 meses): soma encerrados na janela / ativos no início da janela; janelas sem base → null.
    - ltvMedio: tempo de vida médio em meses × ticket mensal médio. REGRA DOCUMENTADA (comentário no módulo + exportar a premissa): clientes ENCERRADOS contam vida do dataInicio do PRIMEIRO contrato até data_encerramento; clientes ATIVOS contam vida até hoje (entram no cálculo — com ~10 clientes, só encerrados deixaria o número vazio/oscilante). Ticket médio = média de valor_mensal dos contratos vigentes/últimos.
    - rankingMotivos: agrupa motivo_encerramento (trim, case-insensitive), ordena por contagem desc, ignora null/vazio.
    - Casos de borda: nenhum encerrado (churn 0%, ranking vazio), vida < 1 mês (mínimo 1 mês ou fração — decidir e testar).
  </behavior>
  <action>
    1. RED: criar executiva.test.ts com os casos acima falhando; commit test(quick-260719-wwm).
    2. GREEN: implementar src/lib/financeiro/executiva.ts — módulo PURO (recebe arrays de {status, dataEncerramento, motivoEncerramento, createdAt} e contratos {clienteId, dataInicio, valorMensal}); zero import de db/react.
    3. Schema: adicionar `dataEncerramento: date('data_encerramento')` (nullable) em clientes, comentário citando migration 0038, logo abaixo de motivoEncerramento.
    4. scripts/aplicar-migration-0038.ts: cópia do padrão 0036 — `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_encerramento date`. NÃO aplicar.
    5. Fluxo de encerramento: em src/actions/clientes.ts, na mesma normalização do motivoEncerramento, gravar `dataEncerramento: data.status === 'encerrado' ? hojeBrasilia() : null` (preservar data existente se o cliente JÁ estava encerrado — não sobrescrever em edições posteriores; ler o registro atual ou usar sql COALESCE conforme o padrão da action). Validação em cliente.ts não precisa de campo novo (data é automática).
    6. Degradação graciosa: enquanto a coluna não existir no banco, as queries que a selecionam devem falhar de forma controlada ou o dado ser tratado como null (seguir padrão de colunas pendentes do projeto — try/catch com fallback).
  </action>
  <verify>
    <automated>npx vitest run src/lib/financeiro/executiva.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>Testes de churn/LTV/ranking verdes; coluna no schema; script 0038 gerado (NÃO aplicado); encerramento grava a data.</done>
</task>

<task type="auto">
  <name>Task 2: Dados agregados + UI — cards na Visão Analítica e chips no Painel</name>
  <files>src/actions/financeiro.ts, src/app/(app)/financeiro/page.tsx, src/app/(app)/financeiro/visao-analitica.tsx, src/app/(app)/painel/page.tsx (ou src/lib/dashboard/data.ts + componente)</files>
  <action>
    1. Nova função de dados `getVisaoExecutiva()` em src/actions/financeiro.ts (ou junto de getVisaoAnalitica): poucas queries AGREGADAS SEQUENCIAIS — clientes (id, status, data_encerramento, motivo_encerramento, created_at) + primeiro contrato por cliente (min data_inicio, valor_mensal) — e delega TODO o cálculo ao módulo puro executiva.ts. Try/catch com fallback null se a coluna data_encerramento ainda não existir (migration pendente).
    2. Em financeiro/page.tsx: chamar getVisaoExecutiva() SEQUENCIALMENTE após getPrevisaoReceitaPorMes() (nunca engordar os Promise.all — regra do pool). Passar para <VisaoAnalitica>.
    3. Em visao-analitica.tsx: nova seção "Visão Executiva" com cards no padrão StatCard/Card existente: Churn do mês (% + acumulado 3m/6m como helper, com nota de que os números oscilam com ~10 clientes), LTV médio (R$ + helper "vida média X meses × ticket R$Y"), card/lista "Motivos de encerramento" (ranking com contagem). Estado vazio honesto ("Nenhum encerramento registrado") e aviso discreto se a migration 0038 estiver pendente (dados null). Tudo pt-BR com acentos.
    4. Painel: chips/resumo compactos de Churn (mês) e LTV médio — adicionar onde couber sem quebrar o grid (ex.: helper nos KPIs financeiros existentes ou linha de chips sob a faixa de KPIs). Reusar o dado via getVisaoExecutiva ou estender getDashboardData com query sequencial; degradação graciosa idem.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>Aba Visão Analítica exibe Churn (mês + 3m/6m), LTV médio e ranking de motivos; Painel exibe chips de churn/LTV; sem dados = estados vazios honestos, nunca números inventados.</done>
</task>

<task type="auto">
  <name>Task 3: Formulário de transação vira Dialog centralizado</name>
  <files>src/app/(app)/financeiro/transacao-form.tsx</files>
  <action>
    Refatorar TransacaoForm para renderizar o formulário dentro do shadcn Dialog (src/components/ui/dialog.tsx), seguindo o padrão visual do NovoLeadDialog do CRM (src/components/crm/novo-lead-dialog.tsx): DialogContent centralizado com largura máxima adequada (~max-w-2xl), DialogHeader com título "Nova transação" / "Editar transação", corpo rolável se necessário (max-h + overflow-y-auto), footer com Salvar/Cancelar.
    - Manter TODO o comportamento atual: RHF + zodResolver com transacaoSchema, modo edição via prop `transacao` (dialog nasce aberto), onClose, toasts, reset e router.refresh().
    - Gatilho: mesmo botão "Adicionar transação" (corrigir copy para pt-BR com acentos: "Adicionar transação", "Descrição", "Recorrência", "Operação", "Mídia", "Cartão", "Transferência", "Não informada", "Salário", "Transação registrada com sucesso." etc. — revisar todas as strings do arquivo).
    - Campos mantidos: tipo receita/despesa, categoria (mensalidade, projeto, outros serviços — manter values do enum), descrição, valor, data, status, dia de vencimento, centro de custo, recorrência (recorrente/avulsa mantendo opções atuais), demais opcionais.
    - Fechar o dialog não pode perder submit em andamento (disabled durante isPending); onOpenChange chama handleCancel.
    - NÃO alterar transacaoSchema nem as actions.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>Botão abre Dialog centralizado (página não é mais empurrada); criação e edição funcionam como antes; textos em pt-BR com acentos.</done>
</task>

</tasks>

<verification>
- `npx vitest run src/lib/financeiro` verde (novos testes de executiva + regressão de calculos/a-receber).
- `npx tsc --noEmit` e `npm run build` verdes.
- Encerrar cliente grava data_encerramento; Visão Analítica e Painel mostram churn/LTV; transação abre em modal.
- Migration 0038 GERADA e NÃO aplicada — usuário roda `npx tsx --env-file=.env.local scripts/aplicar-migration-0038.ts`.
</verification>

<success_criteria>
- Churn mensal + acumulado 3/6 meses, LTV médio (premissa documentada no código) e ranking de motivos visíveis no Financeiro; chips no Painel.
- Lógica 100% em módulo puro testado (padrão do projeto para matemática financeira).
- Formulário de transação em Dialog no padrão do CRM, pt-BR com acentos.
- Degradação graciosa enquanto a migration 0038 não for aplicada.
</success_criteria>

<output>
After completion, create `.planning/quick/260719-wwm-financeiro-vis-o-executiva-churn-ltv-e-m/260719-wwm-SUMMARY.md`
</output>

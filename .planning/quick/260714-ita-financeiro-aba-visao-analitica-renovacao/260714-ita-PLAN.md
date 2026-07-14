---
phase: quick-260714-ita
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/financeiro/calculos.ts
  - src/lib/financeiro/calculos.test.ts
  - src/actions/financeiro.ts
  - src/app/(app)/financeiro/visao-analitica.tsx
  - src/app/(app)/financeiro/page.tsx
autonomous: true
requirements: [260714-ita]

must_haves:
  truths:
    - "Usuario ve uma aba 'Visao Analitica' no /financeiro ao lado de Visao Geral / A Receber / A Pagar / Previsao"
    - "A aba mostra 4 StatCards (Taxa de Renovacao, MRR Previsto, Receita Avulsa, Lucro/Cliente) com dados reais do banco"
    - "A aba mostra o card 'Despesas vs Faturamento' com barra colorida por faixa (verde/ambar/vermelho) e os valores absolutos"
    - "A aba mostra o card 'Dependencia de Faturamento' com Top 5 / Top 10 do MRR e a lista dos 5 maiores clientes"
    - "Os KPIs Receita Paga, Despesas Pagas e Lucro do Overview exibem 'mes ant. R$X' e a variacao % quando ha base de comparacao"
    - "O KPI 'A Receber' exibe 'N cobrancas pendentes'"
    - "Um chip 'Dia X/Y (Z%)' aparece ao lado do MonthSelector somente quando o mes selecionado e o mes corrente"
    - "Nenhum calculo divide por zero: variacao com anterior=0 vira null, receita=0 vira 'Sem receita no periodo', renovacao 0/0 vira 100% com '0/0 contratos'"
    - "A pagina continua carregando em 2 lotes sequenciais com withRetry (sem lote 3) e sem regressao de build/tipos/testes"
  artifacts:
    - path: "src/lib/financeiro/calculos.ts"
      provides: "Funcoes puras de calculo (variacao %, faixa despesas/faturamento, taxa de renovacao, dependencia, lucro/cliente, periodo do mes anterior, progresso do mes)"
      exports: ["calcularVariacaoPercentual", "calcularDespesasVsFaturamento", "contarRenovados", "calcularTaxaRenovacao", "calcularLucroPorCliente", "calcularDependencia", "periodoMesAnterior", "progressoDoMes"]
    - path: "src/lib/financeiro/calculos.test.ts"
      provides: "Testes vitest dos casos de borda (anterior=0, receita=0, renovacao 0/0, percentuais top5/top10)"
      contains: "describe("
    - path: "src/actions/financeiro.ts"
      provides: "Server Action getVisaoAnalitica(mes, ano) seguindo o padrao das actions existentes"
      contains: "export async function getVisaoAnalitica"
    - path: "src/app/(app)/financeiro/visao-analitica.tsx"
      provides: "Server Component puro que renderiza a aba Visao Analitica a partir de props"
      exports: ["VisaoAnalitica"]
      min_lines: 80
    - path: "src/app/(app)/financeiro/page.tsx"
      provides: "Aba registrada, getVisaoAnalitica no lote 2, helpers de mes anterior nos KPIs, chip de progresso do mes"
      contains: "getVisaoAnalitica"
  key_links:
    - from: "src/app/(app)/financeiro/page.tsx"
      to: "getVisaoAnalitica"
      via: "Promise.all do LOTE 2 dentro de carregarDados()"
      pattern: "getVisaoAnalitica\\(mes, ano\\)"
    - from: "src/actions/financeiro.ts"
      to: "src/lib/financeiro/calculos.ts"
      via: "import das funcoes puras (a action nao reimplementa a matematica)"
      pattern: "from '@/lib/financeiro/calculos'"
    - from: "src/app/(app)/financeiro/page.tsx"
      to: "src/app/(app)/financeiro/visao-analitica.tsx"
      via: "<TabsContent value=\"analitica\"><VisaoAnalitica dados={visaoAnalitica} /></TabsContent>"
      pattern: "<VisaoAnalitica"
---

<objective>
Adicionar a aba **Visao Analitica** ao /financeiro e enriquecer os KPIs do Overview com comparativo do mes anterior — usando SOMENTE dados que ja existem (contratos, transacoes, clientes). Sem migration.

Purpose: hoje o /financeiro responde "quanto entrou e quanto saiu neste mes". Falta responder "isso e melhor ou pior que o mes passado?", "estou renovando contratos?", "quanto do meu faturamento depende de 5 clientes?" e "estou gastando demais em relacao ao que fatura?". Sao as perguntas que antecipam problema — o core value do sistema.

Output:
- `src/lib/financeiro/calculos.ts` — matematica pura e testada (fonte unica dos calculos)
- `src/lib/financeiro/calculos.test.ts` — vitest cobrindo os casos de borda (todos os "divide por zero")
- `getVisaoAnalitica(mes, ano)` em `src/actions/financeiro.ts`
- `src/app/(app)/financeiro/visao-analitica.tsx` — Server Component puro
- `page.tsx` — aba registrada, action no LOTE 2, helpers "mes ant." nos KPIs, chip "Dia X/Y (Z%)"
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

@src/actions/financeiro.ts
@src/app/(app)/financeiro/page.tsx
@src/app/(app)/financeiro/previsao-caixa.tsx
@src/app/(app)/financeiro/month-selector.tsx
@src/components/stat-card.tsx
@src/lib/db/schema.ts
@src/lib/date-br.ts
@vitest.config.ts
</context>

<interfaces>
<!-- Contratos reais extraidos do codigo. NAO explorar a base — use isto. -->

**StatCard** (`src/components/stat-card.tsx`) — reaproveitar, nao criar card novo:
```ts
type StatCardColor = 'primary' | 'success' | 'warning' | 'danger'
type StatCardProps = {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color?: StatCardColor          // default 'primary'
  trend?: { value: string; direction: 'up' | 'down'; positive?: boolean }
  helper?: string
}
// Semantica do trend: verde se (trend.positive ?? trend.direction === 'up'), senao vermelho.
// => Para DESPESA, subir e ruim: passar positive: variacao < 0.
```

**Schema** (`src/lib/db/schema.ts`) — colunas relevantes (dinheiro e sempre `numeric` => string em JS):
```ts
contratos:  { id, clienteId, dataInicio: date, dataVencimento: date, valorMensal: numeric(10,2) }
transacoes: { id, tipo: 'receita'|'despesa', categoria: 'mensalidade'|'projeto'|'outro'|'ferramenta'|'ads_agencia'|'salario',
              clienteId, descricao, valor: numeric(10,2), data: date,
              status: 'pago'|'pendente'|'vencido', ... }
clientes:   { id, nome, status: 'ativo'|'pausado'|'encerrado', ... }
```
`date` do drizzle-postgres retorna **string 'YYYY-MM-DD'**; `numeric` retorna **string**. Sempre `Number(...)` na fronteira.

**Padrao das actions** (`src/actions/financeiro.ts`) — arquivo tem `'use server'` no topo:
```ts
export async function getPrevisaoCaixa() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { totalReceber: 0, totalPagar: 0, saldoProjetado: 0, items: [] }  // estrutura ZERADA, nunca lanca
  ...
}
export async function getResumoFinanceiro(mes?: number, ano?: number): Promise<{ receita: number; despesa: number; lucro: number; aReceber: number; aPagar: number }>
export async function calcularMrr(): Promise<number>
```
Imports ja presentes no arquivo: `{ eq, sql, and, lte, gte, desc, inArray } from 'drizzle-orm'`, `{ db } from '@/lib/db'`, `{ transacoes, contratos, clientes, profiles } from '@/lib/db/schema'`, `{ getCurrentUser, requireAdmin } from '@/lib/auth/session'`.

**Datas em Brasilia** (`src/lib/date-br.ts`):
```ts
export function hojeBrasilia(): string          // 'YYYY-MM-DD'
export function dataMenosDias(n: number, base?: string): string
```

**Vitest** (`vitest.config.ts`): `environment: 'node'`, **`globals: false`** => todo teste importa explicitamente:
```ts
import { describe, it, expect } from 'vitest'
```
Testes ficam colocados ao lado do fonte (`src/lib/date-br.test.ts`, `src/lib/trafego/aggregate.test.ts`). Script: `npm test` === `vitest run`.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Funcoes puras de calculo + testes (fonte unica da matematica)</name>
  <files>src/lib/financeiro/calculos.ts, src/lib/financeiro/calculos.test.ts</files>
  <behavior>
    Escreva os testes ANTES da implementacao (RED -> GREEN). Casos obrigatorios:

    `calcularVariacaoPercentual(atual, anterior)`
    - (150, 100) => 50
    - (50, 100) => -50
    - (100, 0) => **null** (nunca dividir por zero)
    - (0, 0) => **null**
    - (0, 100) => -100

    `calcularDespesasVsFaturamento(despesa, receita)`
    - (3000, 10000) => { percentual: 30, faixa: 'saudavel', despesa: 3000, receita: 10000 }
    - (7000, 10000) => faixa 'atencao'   (60 <= p < 80)
    - (6000, 10000) => faixa 'atencao'   (borda: 60 exato ja e atencao)
    - (8000, 10000) => faixa 'critico'   (borda: 80 exato ja e critico)
    - (9500, 10000) => faixa 'critico'
    - (5000, 0)     => { percentual: **null**, faixa: **null**, despesa: 5000, receita: 0 }

    `contarRenovados(vencidos, contratosDoCliente)`
    - vencidos = [{ clienteId: 'a', dataVencimento: '2026-07-31' }, { clienteId: 'b', dataVencimento: '2026-07-15' }]
      contratos = [{ clienteId: 'a', dataInicio: '2026-08-01' }]  => 1
    - contrato posterior de OUTRO cliente nao conta => 0
    - contrato do mesmo cliente com dataInicio <= dataVencimento (nao e posterior) => 0
    - vencidos = [] => 0

    `calcularTaxaRenovacao(renovados, total)`
    - (3, 4) => { renovados: 3, total: 4, percentual: 75 }
    - (0, 0) => { renovados: 0, total: 0, percentual: **100** }  (sem vencimentos = nada a perder)
    - (0, 2) => percentual 0

    `calcularLucroPorCliente(lucro, qtdClientes)`
    - (10000, 4) => 2500
    - (10000, 0) => **0**
    - (-1000, 2) => -500

    `calcularDependencia(linhas)` — entrada `{ nome: string; valor: number }[]` (ordem qualquer)
    - 12 clientes de valor 100 cada (mrrTotal 1200) => percentTop5 = 41.67 (arredondado a 2 casas), percentTop10 = 83.33, topClientes.length === 10
    - lista vazia => { mrrTotal: 0, topClientes: [], percentTop5: 0, percentTop10: 0 } (sem divisao por zero)
    - 3 clientes (600/300/100) => mrrTotal 1000, percentTop5 = 100, percentTop10 = 100, topClientes ordenado desc, percentual do 1o = 60
    - resultado sempre ordenado por valor desc

    `periodoMesAnterior(mes, ano)`
    - (7, 2026)  => { mes: 6, ano: 2026, primeiroDia: '2026-06-01', ultimoDia: '2026-06-30' }
    - (1, 2026)  => { mes: 12, ano: 2025, primeiroDia: '2025-12-01', ultimoDia: '2025-12-31' }  (virada de ano)
    - (3, 2024)  => ultimoDia '2024-02-29' (bissexto)

    `progressoDoMes('2026-07-14')`
    - => { dia: 14, diasNoMes: 31, percentual: 45 }  (percentual arredondado)
    - ('2026-02-28') => { dia: 28, diasNoMes: 28, percentual: 100 }
  </behavior>
  <action>
    Criar `src/lib/financeiro/calculos.ts` com funcoes PURAS (zero import de db/auth/react — sao a fonte unica da matematica que a action e a UI consomem) e `src/lib/financeiro/calculos.test.ts` com `import { describe, it, expect } from 'vitest'` (globals: false — importar sempre).

    Assinaturas exatas:
    ```ts
    export type Faixa = 'saudavel' | 'atencao' | 'critico'

    /** Variacao % de `atual` sobre `anterior`. null quando anterior === 0 (base inexistente => variacao indefinida, NAO infinito). */
    export function calcularVariacaoPercentual(atual: number, anterior: number): number | null

    /** percentual = despesa / receita * 100. null quando receita === 0 (UI mostra "Sem receita no periodo"). Faixas: <60 saudavel, 60-80 atencao, >=80 critico. */
    export function calcularDespesasVsFaturamento(
      despesa: number, receita: number,
    ): { percentual: number | null; faixa: Faixa | null; despesa: number; receita: number }

    /** Um contrato vencido conta como renovado se existe contrato do MESMO cliente com dataInicio > aquele dataVencimento. Datas 'YYYY-MM-DD' comparam corretamente como string (ISO lexicografico) — nao criar Date. */
    export function contarRenovados(
      vencidos: { clienteId: string; dataVencimento: string }[],
      contratosDoCliente: { clienteId: string; dataInicio: string }[],
    ): number

    /** percentual 100 quando total === 0 (nenhum contrato vencia no mes => nada foi perdido). */
    export function calcularTaxaRenovacao(renovados: number, total: number): { renovados: number; total: number; percentual: number }

    /** 0 quando qtdClientes === 0. */
    export function calcularLucroPorCliente(lucro: number, qtdClientes: number): number

    export function calcularDependencia(
      linhas: { nome: string; valor: number }[],
    ): {
      mrrTotal: number
      topClientes: { nome: string; valor: number; percentual: number }[]  // top 10, ordenado desc
      percentTop5: number
      percentTop10: number
    }

    export function periodoMesAnterior(mes: number, ano: number): { mes: number; ano: number; primeiroDia: string; ultimoDia: string }

    export function progressoDoMes(hojeISO: string): { dia: number; diasNoMes: number; percentual: number }
    ```

    Notas de implementacao:
    - Arredondar percentuais com `Math.round(x * 100) / 100` (2 casas). NAO arredondar valores em reais — os valores vem de `Number(numeric)` e devem passar intactos para a UI formatar.
    - `contarRenovados`: montar um `Map<clienteId, dataInicio[]>` a partir de `contratosDoCliente` e usar `.some(inicio => inicio > v.dataVencimento)`. Comparacao de string ISO e correta e evita armadilha de fuso.
    - `periodoMesAnterior`: `ultimoDia` = `new Date(Date.UTC(ano, mes, 0))` (dia 0 do mes seguinte = ultimo dia do mes) ancorado em UTC; formatar com `.toISOString().slice(0, 10)`. Cuidado: os argumentos de `Date.UTC` sao 0-indexados, entao para o mes ANTERIOR `mesAnt` (1-indexado) o ultimo dia e `Date.UTC(anoAnt, mesAnt, 0)`.
    - `progressoDoMes`: parsear a string com split (`const [a, m, d] = hojeISO.split('-').map(Number)`), NUNCA `new Date(hojeISO)` sem ancora — evita drift de fuso. `diasNoMes` via `new Date(Date.UTC(a, m, 0)).getUTCDate()`.
  </action>
  <verify>
    <automated>npx vitest run src/lib/financeiro/calculos.test.ts</automated>
  </verify>
  <done>Todos os testes passam (incluindo os 4 casos de borda exigidos: variacao com anterior=0, despesas/faturamento com receita=0, renovacao 0/0, percentuais top5/top10). `calculos.ts` nao importa db, auth nem react.</done>
</task>

<task type="auto">
  <name>Task 2: Action getVisaoAnalitica(mes, ano)</name>
  <files>src/actions/financeiro.ts</files>
  <action>
    Adicionar ao FINAL de `src/actions/financeiro.ts` (arquivo ja tem `'use server'`). Importar as funcoes puras da Task 1 — a action NAO reimplementa matematica:
    ```ts
    import {
      calcularVariacaoPercentual, calcularDespesasVsFaturamento, contarRenovados,
      calcularTaxaRenovacao, calcularLucroPorCliente, calcularDependencia, periodoMesAnterior,
      type Faixa,
    } from '@/lib/financeiro/calculos'
    import { hojeBrasilia } from '@/lib/date-br'
    ```

    Exportar o tipo e a estrutura zerada:
    ```ts
    export type VisaoAnaliticaData = {
      mesAnterior: { receita: number; despesa: number; lucro: number; mrr: number }
      variacao: { receita: number | null; despesa: number | null; lucro: number | null; mrr: number | null }
      receitaAvulsa: number
      lucroPorCliente: number
      clientesAtivos: number
      despesasVsFaturamento: { percentual: number | null; faixa: Faixa | null; despesa: number; receita: number }
      taxaRenovacao: { renovados: number; total: number; percentual: number }
      dependencia: { mrrTotal: number; topClientes: { nome: string; valor: number; percentual: number }[]; percentTop5: number; percentTop10: number }
    }
    ```
    `getVisaoAnalitica(mes?: number, ano?: number): Promise<VisaoAnaliticaData>` — padrao identico a `getPrevisaoCaixa`: `const currentUser = await getCurrentUser(); if (!currentUser) return VISAO_ANALITICA_VAZIA` (constante com tudo zerado / nulls / arrays vazios). NUNCA lanca.

    **CRITICO — pressao de conexao:** as queries internas rodam **SEQUENCIALMENTE** (`await` um a um, SEM `Promise.all` interno). O pool e `max=3` e esta action entra num `Promise.all` de 5 no LOTE 2 da pagina; paralelizar por dentro estouraria o pool e reintroduziria o travamento que o quick 260713-usi resolveu.

    Defaults: `const agora = new Date(); const m = mes ?? agora.getMonth() + 1; const a = ano ?? agora.getFullYear()`.

    Queries, nesta ordem:

    1. **Mes anterior (receita/despesa/lucro)** — `const { mes: mAnt, ano: aAnt, ultimoDia } = periodoMesAnterior(m, a)` e reusar `const resumoAnterior = await getResumoFinanceiro(mAnt, aAnt)` (mesma logica ja testada em producao — nao duplicar o SQL).

    2. **MRR do mes anterior** — soma de `contratos.valorMensal` vigentes no ULTIMO DIA do mes anterior:
       ```ts
       const [mrrAntRow] = await db
         .select({ total: sql<string>`coalesce(sum(${contratos.valorMensal}), '0')` })
         .from(contratos)
         .where(and(lte(contratos.dataInicio, ultimoDia), gte(contratos.dataVencimento, ultimoDia)))
       const mrrAnterior = Number(mrrAntRow.total)
       ```

    3. **Agregado do mes atual em UMA query** (receita paga + despesa paga + receita avulsa juntos — economiza round-trip):
       ```ts
       const [atual] = await db
         .select({
           receita: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' and ${transacoes.status} = 'pago' then ${transacoes.valor} else 0 end), '0')`,
           despesa: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'despesa' and ${transacoes.status} = 'pago' then ${transacoes.valor} else 0 end), '0')`,
           avulsa:  sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' and ${transacoes.status} = 'pago' and ${transacoes.categoria} <> 'mensalidade' then ${transacoes.valor} else 0 end), '0')`,
         })
         .from(transacoes)
         .where(and(
           sql`extract(month from ${transacoes.data}) = ${m}`,
           sql`extract(year from ${transacoes.data}) = ${a}`,
         ))
       ```
       `const receitaAtual = Number(atual.receita)`, `despesaAtual`, `receitaAvulsa = Number(atual.avulsa)`. `lucroAtual = receitaAtual - despesaAtual`.

    4. **Clientes ativos (contagem)**:
       ```ts
       const [cliRow] = await db
         .select({ total: sql<number>`count(*)::int` })
         .from(clientes)
         .where(eq(clientes.status, 'ativo'))
       const clientesAtivos = Number(cliRow.total)
       ```

    5. **Taxa de renovacao** — contratos cujo `dataVencimento` cai DENTRO do MES SELECIONADO. Derivar as bordas do mes atual direto (o helper `periodoMesAnterior` e so para o mes anterior — nao force ele aqui):
       ```ts
       const primeiroDiaMes = `${a}-${String(m).padStart(2, '0')}-01`
       const ultimoDiaMes = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
       ```
       Query A (vencidos no mes):
       ```ts
       const vencidos = await db
         .select({ clienteId: contratos.clienteId, dataVencimento: contratos.dataVencimento })
         .from(contratos)
         .where(and(gte(contratos.dataVencimento, primeiroDiaMes), lte(contratos.dataVencimento, ultimoDiaMes)))
       ```
       Query B — SO executar `if (vencidos.length > 0)` (evita query inutil e `inArray` com lista vazia):
       ```ts
       const posteriores = await db
         .select({ clienteId: contratos.clienteId, dataInicio: contratos.dataInicio })
         .from(contratos)
         .where(and(
           inArray(contratos.clienteId, [...new Set(vencidos.map((v) => v.clienteId))]),
           gt(contratos.dataInicio, primeiroDiaMes),
         ))
       ```
       (importar `gt` de 'drizzle-orm' — adicionar ao import existente). Depois: `const taxaRenovacao = calcularTaxaRenovacao(contarRenovados(vencidos, posteriores), vencidos.length)`. O filtro por data em SQL e apenas um pre-corte; a regra exata (`dataInicio > dataVencimento daquele contrato`) fica na funcao pura testada.

    6. **Dependencia (MRR por cliente vigente HOJE)** — `const hoje = hojeBrasilia()`:
       ```ts
       const linhas = await db
         .select({ nome: clientes.nome, valor: sql<string>`sum(${contratos.valorMensal})` })
         .from(contratos)
         .innerJoin(clientes, eq(contratos.clienteId, clientes.id))
         .where(and(lte(contratos.dataInicio, hoje), gte(contratos.dataVencimento, hoje)))
         .groupBy(clientes.id, clientes.nome)
       const dependencia = calcularDependencia(linhas.map((l) => ({ nome: l.nome, valor: Number(l.valor) })))
       ```
       (a ordenacao desc e o top 10 ficam na funcao pura — nao duplicar no SQL).

    Montagem final: `variacao` via `calcularVariacaoPercentual(atual, anterior)` para receita, despesa, lucro e mrr (mrr atual = `dependencia.mrrTotal`); `despesasVsFaturamento = calcularDespesasVsFaturamento(despesaAtual, receitaAtual)`; `lucroPorCliente = calcularLucroPorCliente(lucroAtual, clientesAtivos)`; `mesAnterior = { receita: resumoAnterior.receita, despesa: resumoAnterior.despesa, lucro: resumoAnterior.lucro, mrr: mrrAnterior }`.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>`getVisaoAnalitica` exportada e tipada, retorna `VISAO_ANALITICA_VAZIA` sem sessao, nao lanca, executa suas queries sequencialmente e delega TODA a matematica para `@/lib/financeiro/calculos`. `npx tsc --noEmit` limpo.</done>
</task>

<task type="auto">
  <name>Task 3: UI — componente da aba, registro no Tabs, helpers do Overview e chip do mes</name>
  <files>src/app/(app)/financeiro/visao-analitica.tsx, src/app/(app)/financeiro/page.tsx</files>
  <action>
    **A) `src/app/(app)/financeiro/visao-analitica.tsx`** — Server Component PURO: **sem `'use client'`**, sem hooks, sem handlers. Recebe `{ dados }: { dados: VisaoAnaliticaData }` (importar o tipo de `@/actions/financeiro`) e exporta `export function VisaoAnalitica({ dados }: ...)`.

    Reaproveitar o padrao visual existente (`previsao-caixa.tsx`): `Card/CardHeader/CardTitle/CardContent` de `@/components/ui/card` com `className="border-none shadow-sm"`, `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` no topo do modulo, `tabular-nums` em numero. NAO inventar design novo. Cores SO semanticas: `text-chart-success` / `bg-chart-success`, `text-chart-warning` / `bg-chart-warning`, `text-destructive` / `bg-destructive`, `text-muted-foreground`.

    Layout (`<div className="space-y-6">`):

    1. **4 StatCards** em `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">` — icones de `lucide-react`:
       - `Taxa de Renovacao` — value `${dados.taxaRenovacao.percentual}%`, helper `` `${dados.taxaRenovacao.renovados}/${dados.taxaRenovacao.total} contratos` `` (com total=0 sai "0/0 contratos"), icon `RefreshCw`, color `success` se percentual >= 80, `warning` se >= 50, senao `danger`.
       - `MRR Previsto` — value `formatadorMoeda.format(dados.dependencia.mrrTotal)`, helper `"Receita recorrente esperada"`, icon `Repeat`, color `success`. Se `dados.variacao.mrr !== null`, passar `trend={{ value: `${Math.abs(dados.variacao.mrr)}%`, direction: dados.variacao.mrr >= 0 ? 'up' : 'down' }}`.
       - `Receita Avulsa` — value `formatadorMoeda.format(dados.receitaAvulsa)`, helper `"Extras + antecipados"`, icon `PlusCircle`, color `primary`.
       - `Lucro/Cliente` — value `formatadorMoeda.format(dados.lucroPorCliente)`, helper `` `${dados.clientesAtivos} clientes ativos` ``, icon `Users`, color `dados.lucroPorCliente >= 0 ? 'success' : 'danger'`.

    2. **Card "Despesas vs Faturamento"**:
       - `CardTitle className="text-base"` = "Despesas vs Faturamento".
       - Se `dados.despesasVsFaturamento.percentual === null` => renderizar so `<p className="text-sm text-muted-foreground">Sem receita no periodo</p>` no CardContent (nada de barra).
       - Senao: percentual grande (`text-3xl font-semibold tabular-nums`) na cor da faixa (`saudavel` -> `text-chart-success`, `atencao` -> `text-chart-warning`, `critico` -> `text-destructive`) + rotulo da faixa ("Saudavel" / "Atencao" / "Critico").
       - Barra: trilho `<div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">` com preenchimento `<div className="h-full rounded-full transition-all" style={{ width: `${Math.min(percentual, 100)}%` }} />` usando `bg-chart-success` / `bg-chart-warning` / `bg-destructive` conforme a faixa. **Clamp obrigatorio em 100%** (despesa pode exceder a receita).
       - Legenda das 3 faixas em `text-xs text-muted-foreground`: "Saudavel ate 60% | Atencao 60-80% | Critico 80%+".
       - Valores absolutos: `Despesas: {formatadorMoeda.format(dvf.despesa)} | Receita: {formatadorMoeda.format(dvf.receita)}` em `text-xs text-muted-foreground`.

    3. **Card "Dependencia de Faturamento"**:
       - `CardTitle` "Dependencia de Faturamento" + subtitulo `<p className="text-xs text-muted-foreground">Quanto do seu MRR esta concentrado nos maiores clientes</p>` (mesmo padrao do subtitulo em `previsao-caixa.tsx`).
       - Se `dados.dependencia.topClientes.length === 0` => `<div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum contrato vigente.</div>`.
       - Senao: duas linhas com barrinha de proporcao — "Top 5 Clientes — {percentTop5}% do MRR" e "Top 10 — {percentTop10}%", cada uma com trilho `bg-muted` e preenchimento com `style={{ width: `${Math.min(p, 100)}%` }}`. Cor do Top 5: `bg-destructive` se >= 80 (concentracao perigosa), `bg-chart-warning` se >= 60, senao `bg-chart-success`. Top 10 usa `bg-primary`.
       - Lista dos **top 5** (`dados.dependencia.topClientes.slice(0, 5)`): nome (`font-medium`, `truncate`), valor formatado (`tabular-nums`) e `{percentual}%` em `text-muted-foreground`. Key = `nome` (ja unico por groupBy).

    **B) `src/app/(app)/financeiro/page.tsx`**:
    - Importar `getVisaoAnalitica` junto das actions existentes; importar `{ VisaoAnalitica } from './visao-analitica'`; `{ hojeBrasilia } from '@/lib/date-br'`; `{ progressoDoMes } from '@/lib/financeiro/calculos'`.
    - **LOTE 2**: incluir `getVisaoAnalitica(mes, ano)` no `Promise.all` existente e no `return [...] as const` de `carregarDados()`, e no destructuring `const [resumo, mrr, transacoes, clientesAtivos, contasReceber, contasPagar, previsao, profilesList, visaoAnalitica] = dados`. **NAO criar lote 3**, nao mexer no lote 1, nao alterar `withRetry` nem a tela de erro de ultimo recurso.
    - **Chip do mes**: dentro do `<div className="flex items-center gap-2">`… na verdade ao lado do `<MonthSelector mes={mes} ano={ano} />` no header (envolver ambos num `<div className="flex items-center gap-2">` se necessario). Renderizar SO quando o mes/ano selecionado for o corrente **em Brasilia**:
      ```tsx
      const hoje = hojeBrasilia()
      const [anoHoje, mesHoje] = hoje.split('-').map(Number)
      const isMesCorrente = mes === mesHoje && ano === anoHoje
      const prog = progressoDoMes(hoje)
      ```
      ```tsx
      {isMesCorrente && (
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
          Dia {prog.dia}/{prog.diasNoMes} ({prog.percentual}%)
        </span>
      )}
      ```
    - **Helpers dos KPIs** (grid de 6 ja existente — nao mudar o grid). Definir um helper local acima do return:
      ```tsx
      const trendDe = (variacao: number | null, subirEBom: boolean) =>
        variacao === null
          ? undefined
          : { value: `${Math.abs(variacao)}%`, direction: (variacao >= 0 ? 'up' : 'down') as 'up' | 'down', positive: subirEBom ? variacao >= 0 : variacao < 0 }
      ```
      - `Receita Paga`: `helper={`mes ant. ${formatadorMoeda.format(visaoAnalitica.mesAnterior.receita)}`}` + `trend={trendDe(visaoAnalitica.variacao.receita, true)}`.
      - `Despesas Pagas`: `helper={`mes ant. ${formatadorMoeda.format(visaoAnalitica.mesAnterior.despesa)}`}` + `trend={trendDe(visaoAnalitica.variacao.despesa, false)}` (despesa subindo = vermelho).
      - `Lucro`: `helper={`mes ant. ${formatadorMoeda.format(visaoAnalitica.mesAnterior.lucro)}`}` + `trend={trendDe(visaoAnalitica.variacao.lucro, true)}`.
      - `A Receber`: `helper={`${contasReceber.length} cobrancas pendentes`}`.
      - NAO mexer nos cards MRR e A Pagar.
    - **Aba**: adicionar `<TabsTrigger value="analitica">Visao Analitica</TabsTrigger>` no `TabsList` existente (depois de "Previsao"; o TabsList ja tem `overflow-x-auto`, entao 5 abas cabem) e:
      ```tsx
      <TabsContent value="analitica">
        <VisaoAnalitica dados={visaoAnalitica} />
      </TabsContent>
      ```
      Manter `defaultValue="geral"`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run && npm run build</automated>
  </verify>
  <done>Build, tipos e testes passam. A aba "Visao Analitica" existe no Tabs, os 3 KPIs mostram "mes ant. R$X", "A Receber" mostra "N cobrancas pendentes", o chip "Dia X/Y (Z%)" aparece so no mes corrente, e `getVisaoAnalitica` esta no LOTE 2 (nao existe lote 3).</done>
</task>

</tasks>

<verification>
Verificacao OBRIGATORIA no final (constraint do usuario — nao concluir com build quebrado):

```bash
npx tsc --noEmit    # zero erros de tipo
npx vitest run      # todos os testes passam (incl. calculos.test.ts)
npm run build       # build de producao limpo
```

Checagens estruturais:
- `grep -c "Promise.all" src/app/(app)/financeiro/page.tsx` => continua **2** (lote 1 e lote 2 — nenhum lote 3 criado).
- `grep "getVisaoAnalitica(mes, ano)" src/app/(app)/financeiro/page.tsx` => presente no LOTE 2.
- `grep -E "Promise.all" src/actions/financeiro.ts` dentro de `getVisaoAnalitica` => **ausente** (queries sequenciais, pool max=3).
- `grep "'use client'" src/app/(app)/financeiro/visao-analitica.tsx` => **ausente** (Server Component puro).
- `grep -E "(import .*db|@/lib/auth|react)" src/lib/financeiro/calculos.ts` => **ausente** (funcoes puras).
- Nenhum arquivo em `drizzle/` alterado — sem migration.

Commit: adicionar SOMENTE os 5 arquivos por caminho explicito. **NUNCA `git add -A`.**
</verification>

<success_criteria>
- [ ] `npx tsc --noEmit`, `npx vitest run` e `npm run build` passam
- [ ] Testes cobrem os 4 casos de borda exigidos: variacao com anterior=0 => null; despesas/faturamento com receita=0 => null; taxa de renovacao 0/0 => 100%; percentuais top5/top10 da dependencia
- [ ] `getVisaoAnalitica(mes, ano)` segue o padrao das actions (getCurrentUser no topo, estrutura zerada sem sessao, nunca lanca) e roda queries sequenciais
- [ ] Aba "Visao Analitica" registrada no Tabs com 4 StatCards + card Despesas vs Faturamento (3 faixas) + card Dependencia de Faturamento (Top 5/Top 10 + lista)
- [ ] KPIs Receita Paga / Despesas Pagas / Lucro com helper "mes ant. R$X" e variacao %; "A Receber" com "N cobrancas pendentes"
- [ ] Chip "Dia X/Y (Z%)" ao lado do MonthSelector apenas no mes corrente (Brasilia)
- [ ] Carga continua em 2 lotes + withRetry; zero migration; zero mudanca de schema
- [ ] Design 100% reaproveitado (StatCard/Card/Tabs, cores chart-success/chart-warning/destructive)
</success_criteria>

<output>
Ao concluir, criar `.planning/quick/260714-ita-financeiro-aba-visao-analitica-renovacao/260714-ita-SUMMARY.md`
</output>

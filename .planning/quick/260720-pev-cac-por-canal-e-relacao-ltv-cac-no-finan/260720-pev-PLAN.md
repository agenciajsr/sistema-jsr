---
phase: quick-260720-pev
plan: 01
type: execute
wave: 1
depends_on: []
requirements: [QUICK-260720-pev]
files_modified:
  - src/lib/db/schema.ts
  - src/lib/validations/investimento-aquisicao.ts
  - drizzle/0039_investimentos_aquisicao.sql
  - scripts/aplicar-migration-0039.ts
  - src/lib/financeiro/cac.ts
  - src/lib/financeiro/cac.test.ts
  - src/actions/financeiro.ts
  - src/app/(app)/financeiro/aquisicao-form.tsx
  - src/app/(app)/financeiro/visao-analitica.tsx
  - src/app/(app)/financeiro/page.tsx
autonomous: true
gap_closure: false

must_haves:
  truths:
    - "O usuário lança, por competência (mês) e canal, quanto a JSR investiu em aquisição, numa tela dedicada no Financeiro"
    - "Cada card de canal mostra o CAC (investimento do canal ÷ clientes ganhos daquele canal no período), no mês e acumulado 3m/6m"
    - "Um card mostra a relação LTV/CAC (quantas vezes o retorno cobre o custo de aquisição), reusando o LTV já calculado"
    - "Com poucos clientes, o número não some: canais sem cliente ganho aparecem com CAC indefinido em vez de dividir por zero"
    - "A tela degrada com aviso (não com erro) enquanto a migration 0039 não for aplicada"
  artifacts:
    - path: "src/lib/financeiro/cac.ts"
      provides: "Canais canônicos, classificador de origem livre→canal, CAC por canal (mês/acumulado) e relação LTV/CAC — módulo puro"
      contains: "export function cacPorCanal"
    - path: "src/lib/financeiro/cac.test.ts"
      provides: "Testes Vitest do cálculo de CAC e LTV/CAC (TDD, RED primeiro)"
      contains: "describe"
    - path: "drizzle/0039_investimentos_aquisicao.sql"
      provides: "DDL da tabela investimentos_aquisicao (NÃO aplicada)"
      contains: "create table"
    - path: "scripts/aplicar-migration-0039.ts"
      provides: "Script de aplicação manual da 0039 (segue o padrão da 0038)"
    - path: "src/actions/financeiro.ts"
      provides: "getCacAquisicao (sequencial), createInvestimentoAquisicao, listInvestimentosAquisicao"
      exports: ["getCacAquisicao", "createInvestimentoAquisicao"]
  key_links:
    - from: "src/app/(app)/financeiro/page.tsx"
      to: "getCacAquisicao"
      via: "fetch SEQUENCIAL após o lote 2 (nunca dentro de Promise.all — regra do pool)"
      pattern: "await getCacAquisicao"
    - from: "src/actions/financeiro.ts"
      to: "src/lib/financeiro/cac.ts"
      via: "delega todo o cálculo ao módulo puro"
      pattern: "cacPorCanal|relacaoLtvCac"
    - from: "src/app/(app)/financeiro/visao-analitica.tsx"
      to: "getCacAquisicao"
      via: "cards de CAC por canal + LTV/CAC na seção Visão Executiva"
      pattern: "cac|LTV/CAC"
---

<objective>
Fechar a última peça da camada transversal do dashboard executivo do Financeiro: **CAC por canal** e **relação LTV/CAC**. MRR, churn e LTV já foram entregues (quick 260719-wwm); falta o dado de custo de aquisição.

O bloqueio é de DADO, não de cálculo: o sistema sabe de onde cada cliente veio (`clientes.origem_cliente`), mas não sabe quanto a JSR investe para captar. Este plano cria (1) o lugar para lançar o investimento mensal por canal, (2) a matemática pura e testada do CAC, e (3) os cards na Visão Executiva.

Purpose: responder "cada real investido em aquisição volta quantas vezes?" (LTV/CAC ≥ 3 = saudável) e mostrar em qual canal vale colocar mais verba.
Output: tabela `investimentos_aquisicao` + migration 0039 (NÃO aplicada) + módulo puro `cac.ts` sob TDD + actions + tela de lançamento + cards de CAC/LTV-CAC.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/todos/pending/2026-07-20-cac-por-canal-e-relacao-ltv-cac-no-financeiro.md

# Padrões a seguir (JÁ LIDOS pelo planner — o executor deve reusá-los, não reinventar):
@src/lib/financeiro/executiva.ts
@src/actions/financeiro.ts
@src/app/(app)/financeiro/visao-analitica.tsx

<interfaces>
<!-- Contratos-chave extraídos do código. Use-os diretamente, sem explorar. -->

DADO CRÍTICO: `clientes.origemCliente` é TEXTO LIVRE (schema.ts:60, input "Como conheceu a
agência?" em cliente-form.tsx). NÃO existe enum de origem no cliente. Portanto o "canal" da
tela de investimento é uma LISTA CANÔNICA definida por nós, e os clientes são casados a esses
canais por um CLASSIFICADOR de texto livre → canal (keyword + fallback), documentado como
premissa (espelho do PREMISSA_LTV em executiva.ts).

"inicio" de um cliente (já computado em getVisaoExecutiva, financeiro.ts:578) =
  min(contratos.data_inicio) por cliente; fallback clientes.created_at (fatiado 'YYYY-MM-DD').
  → "cliente ganho no período" = inicio cai dentro da competência.

Helpers puros REUSÁVEIS de executiva.ts (mesmas convenções de data ISO string):
  - datas 'YYYY-MM-DD' / competência 'YYYY-MM' comparadas LEXICOGRAFICAMENTE (nunca new Date()).
  - padrão deslocarMes/primeiroDia/ultimoDia para janela acumulada (copiar o estilo, não importar privado).
  - export type ResultadoLtv = { valor: number; vidaMediaMeses: number; ticketMedio: number }
  - export function ltvMedio(clientes, hoje): ResultadoLtv | null   // já existe; reusar o .valor

Regra do POOL (STATE.md 260713-usi / 260714-ita): actions que rodam dentro do Promise.all da
página executam queries SEQUENCIALMENTE; getCacAquisicao roda FORA dos Promise.all, após o
lote 2 (igual getVisaoExecutiva em page.tsx:101). max_pipeline / pool max=5 intocados.

Degradação graciosa (padrão getVisaoExecutiva): try/catch na query da tabela nova; se a coluna/
tabela não existe (migration 0039 pendente) → retorna null; a UI mostra aviso, nunca número inventado.

MIGRATIONS (STATE.md 260715-1rq): NUNCA `drizzle-kit migrate`. Escrever o .sql à mão (o generate
está quebrado por colisão de snapshots) + script `scripts/aplicar-migration-0039.ts` no molde do
0038 (postgres DIRECT_URL, max:1, DDL idempotente com IF NOT EXISTS). NÃO rodar o script.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Tabela investimentos_aquisicao + validação + migration 0039 (NÃO aplicada)</name>
  <files>src/lib/db/schema.ts, src/lib/validations/investimento-aquisicao.ts, drizzle/0039_investimentos_aquisicao.sql, scripts/aplicar-migration-0039.ts</files>
  <action>
Criar a fundação de dado do lançamento de investimento em aquisição.

1. `src/lib/db/schema.ts` — adicionar a tabela (imports `pgTable, uuid, text, numeric, timestamp, uniqueIndex` já existem no topo, linha 1):
   ```ts
   // Investimento mensal em aquisição por canal (quick-260720-pev). Alimenta o
   // CAC por canal e a relação LTV/CAC da Visão Executiva do Financeiro. "canal"
   // é uma chave canônica (ver CANAIS_AQUISICAO em src/lib/financeiro/cac.ts);
   // origem do cliente (clientes.origem_cliente) é texto livre e é classificada
   // nesses mesmos canais no cálculo.
   export const investimentosAquisicao = pgTable('investimentos_aquisicao', {
     id: uuid('id').primaryKey().defaultRandom(),
     canal: text('canal').notNull(),
     competencia: text('competencia').notNull(), // 'YYYY-MM'
     valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
     notas: text('notas'),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
     updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   }, (t) => [uniqueIndex('ux_invest_canal_competencia').on(t.canal, t.competencia)])
   ```
   O índice único (canal, competência) garante 1 lançamento por canal/mês → a action faz upsert.

2. `src/lib/validations/investimento-aquisicao.ts` — Zod schema (padrão dos outros validators):
   - `canal`: z.string().min(1) (deve ser uma das chaves canônicas — validado contra CANAIS_AQUISICAO da Task 2)
   - `competencia`: z.string().regex(/^\d{4}-\d{2}$/) — 'YYYY-MM'
   - `valor`: z.coerce.number().nonnegative() (0 é válido: mês sem investimento no canal)
   - `notas`: z.string().optional()
   Exportar `investimentoAquisicaoSchema` e `type InvestimentoAquisicaoInput`.

3. `drizzle/0039_investimentos_aquisicao.sql` — DDL à mão (molde 0034/0038, cabeçalho comentado + aviso "aplicar NA MÃO"):
   ```sql
   CREATE TABLE IF NOT EXISTS "investimentos_aquisicao" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "canal" text NOT NULL,
     "competencia" text NOT NULL,
     "valor" numeric(12,2) NOT NULL,
     "notas" text,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL,
     "updated_at" timestamp with time zone DEFAULT now() NOT NULL
   );
   CREATE UNIQUE INDEX IF NOT EXISTS "ux_invest_canal_competencia" ON "investimentos_aquisicao" ("canal","competencia");
   ```

4. `scripts/aplicar-migration-0039.ts` — cópia fiel do 0038 (postgres DIRECT_URL, max:1, dentro de try/finally), executando o CREATE TABLE + CREATE UNIQUE INDEX idempotentes. NÃO executar o script — só deixá-lo pronto.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>Tabela no schema, validator exportado, .sql 0039 e script de aplicação presentes; tsc verde. Migration NÃO aplicada.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Módulo puro cac.ts sob TDD (canais, classificador, CAC, LTV/CAC)</name>
  <files>src/lib/financeiro/cac.ts, src/lib/financeiro/cac.test.ts</files>
  <behavior>
    Escrever cac.test.ts PRIMEIRO (RED), depois cac.ts (GREEN). Casos:
    - classificarCanal: texto livre → canal canônico por keyword (case/acento-insensível):
      "veio pelo Instagram/anúncio" → meta_ads; "google/pesquisa" → google_ads;
      "indicação de cliente" → indicacao; "prospecção/outbound" → prospeccao;
      vazio/desconhecido → 'outro'. (Definir CANAIS_AQUISICAO e as regras de keyword.)
    - cacPorCanal(investimentos, clientesGanhos, competencia): para cada canal, soma do
      investimento na competência ÷ nº de clientes cujo `inicio` cai na competência e cuja
      origem classifica nesse canal. Retorna por canal { canal, investimento, clientesGanhos, cac|null }.
    - CAC = null (indefinido, NÃO 0, NÃO ÷0) quando clientesGanhos === 0 mesmo com investimento > 0.
    - Janela ACUMULADA: cacAcumulado(..., mesFinal, meses) soma investimento e clientes ganhos
      numa janela de N meses terminando em mesFinal (espelho de churnAcumulado). Testar 3m e 6m.
    - relacaoLtvCac(ltvValor, cacGeral): ltvValor ÷ cacGeral; null quando cacGeral é 0/null.
      cacGeral = total investido no período ÷ total de clientes ganhos no período.
    - Arredondamento 2 casas; datas como string ISO comparadas lexicograficamente.
  </behavior>
  <action>
Criar `src/lib/financeiro/cac.ts` seguindo EXATAMENTE o estilo de executiva.ts: módulo PURO
(zero import de db/auth/react), cabeçalho documentando a premissa do CAC e do classificador
(espelho do bloco PREMISSA_LTV), datas ISO string comparadas lexicograficamente, helper
arredondar2, deslocarMes/primeiro/ultimoDia no mesmo formato.

Exportar:
- `CANAIS_AQUISICAO` (array das chaves canônicas: meta_ads, google_ads, indicacao, organico, prospeccao, outro) e `ROTULO_CANAL` (pt-BR com acentos: "Meta Ads", "Google Ads", "Indicação", "Orgânico", "Prospecção", "Outro").
- `PREMISSA_CAC` (string documentando: "CAC do canal = investimento do canal no período ÷ clientes ganhos (início na competência) classificados nesse canal; canal sem cliente ganho fica indefinido").
- `type CanalAquisicao`, tipos de entrada (`InvestimentoCanal = { canal; competencia; valor }`, `ClienteGanho = { origem: string | null; inicio: string | null }`) e saída (`CacCanal`, `ResultadoCac`).
- `classificarCanal(origem)`, `cacPorCanal(...)`, `cacAcumulado(...)`, `relacaoLtvCac(...)`.

O classificador normaliza (trim + toLowerCase + remover acentos) e testa keywords; documentar
no código que origem_cliente é texto livre e por isso o mapeamento é heurístico com fallback 'outro'.

TDD: rodar o teste RED antes de implementar, depois GREEN.
  </action>
  <verify>
    <automated>npx vitest run src/lib/financeiro/cac.test.ts</automated>
  </verify>
  <done>cac.test.ts escrito antes, cac.ts implementado; todos os testes do arquivo passam; nenhum import de db/auth/react.</done>
</task>

<task type="auto">
  <name>Task 3: Actions + tela de lançamento (aba) + cards CAC/LTV-CAC na Visão Executiva</name>
  <files>src/actions/financeiro.ts, src/app/(app)/financeiro/aquisicao-form.tsx, src/app/(app)/financeiro/visao-analitica.tsx, src/app/(app)/financeiro/page.tsx</files>
  <action>
Ligar dado → cálculo → UI.

1. `src/actions/financeiro.ts` — três actions novas (importar `investimentosAquisicao`, o validator da Task 1 e as funções puras da Task 2):
   - `createInvestimentoAquisicao(input)`: valida com `investimentoAquisicaoSchema`; UPSERT por (canal, competencia) via `.onConflictDoUpdate` no índice único (grava valor/notas/updatedAt); `revalidatePath('/financeiro')`. Checar sessão (getCurrentUser) como as demais.
   - `listInvestimentosAquisicao()`: lista os lançamentos (para a tela de histórico), ordenados por competência desc.
   - `getCacAquisicao(): Promise<CacAquisicaoData | null>`: padrão IDÊNTICO ao getVisaoExecutiva —
     try/catch na leitura da tabela nova (tabela ausente = migration 0039 pendente → return null);
     depois, SEQUENCIALMENTE, reusar a MESMA leitura de `inicio` por cliente já feita em
     getVisaoExecutiva (min data_inicio + fallback created_at, e origem_cliente) para montar os
     `ClienteGanho`; delegar todo o cálculo a `cacPorCanal`/`cacAcumulado`/`relacaoLtvCac`; o LTV
     vem de `ltvMedio` (reusar). Retornar { mes, porCanalMes, porCanal3m, porCanal6m, ltvCac }.
     NUNCA dentro de Promise.all (regra do pool) — a página a chama sequencialmente.

2. `src/app/(app)/financeiro/aquisicao-form.tsx` (Client Component) — a TELA DEDICADA de lançamento:
   seletor de competência (mês) + uma linha por canal de CANAIS_AQUISICAO com input de valor (R$),
   botão Salvar chamando createInvestimentoAquisicao, e uma lista/tabela do histórico
   (listInvestimentosAquisicao). Padrão de Dialog/form já usado no financeiro (transacao-form.tsx).
   TODO texto em pt-BR COM acentos ("Competência", "Investimento por canal", "Salvar lançamento").

3. `src/app/(app)/financeiro/visao-analitica.tsx` — dentro da seção `VisaoExecutiva`, adicionar:
   - grid de cards "CAC — {ROTULO_CANAL}" por canal (valor do mês + helper "3m … · 6m …" como o card de churn faz), CAC null exibido como "—" com helper "sem cliente ganho no período".
   - um card "LTV/CAC" (relação), verde ≥3 / amarelo 1–3 / vermelho <1; helper citando o LTV e o CAC geral.
   Reaproveitar StatCard/Card e o formatadorMoeda já no arquivo. Aceitar os dados via nova prop
   opcional `cac?: CacAquisicaoData | null` no componente VisaoExecutiva/VisaoAnalitica; quando null,
   mostrar o MESMO aviso de migration pendente já existente (apontando scripts/aplicar-migration-0039.ts).

4. `src/app/(app)/financeiro/page.tsx`:
   - buscar `getCacAquisicao()` SEQUENCIALMENTE após `getVisaoExecutiva()` (fora dos Promise.all),
     adicionar ao array `dados` e ao destructuring.
   - passar `cac={cacAquisicao}` para `<VisaoAnalitica>`.
   - adicionar uma nova aba "Aquisição" no Tabs (TabsTrigger + TabsContent) renderizando `<AquisicaoForm>`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/lib/financeiro/cac.test.ts && npm run build</automated>
  </verify>
  <done>Tela de lançamento acessível na aba Aquisição; cards de CAC por canal + LTV/CAC aparecem na Visão Executiva (ou aviso de migration pendente); getCacAquisicao é chamada sequencial fora dos Promise.all; tsc + testes + build verdes.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` sem erros.
- `npx vitest run src/lib/financeiro/cac.test.ts` — todos passam (CAC por canal, acumulado 3m/6m, LTV/CAC, divisão-por-zero → null, classificador).
- `npm run build` verde.
- Leitura manual: getCacAquisicao NÃO aparece dentro de nenhum Promise.all em page.tsx.
- Migration 0039 e script de aplicação existem; NÃO foram aplicados/executados.
</verification>

<success_criteria>
- Existe uma tela dedicada no Financeiro (aba "Aquisição") para lançar investimento por competência e canal, com histórico.
- CAC por canal (mês + acumulado 3m/6m) e relação LTV/CAC renderizam na Visão Executiva, junto de churn/LTV.
- Canal sem cliente ganho mostra CAC indefinido ("—"), nunca ÷0.
- Enquanto a migration 0039 não é aplicada, a seção degrada com aviso (não com erro).
- Toda a matemática mora em src/lib/financeiro/cac.ts (puro, testado); actions e UI só consomem.
- Todo texto de UI em pt-BR com acentos.
</success_criteria>

<output>
Após a conclusão, criar `.planning/quick/260720-pev-cac-por-canal-e-relacao-ltv-cac-no-finan/260720-pev-SUMMARY.md`.
Lembrete no summary: aplicar a migration 0039 via `npx tsx --env-file=.env.local scripts/aplicar-migration-0039.ts` (não aplicada por este plano).
</output>

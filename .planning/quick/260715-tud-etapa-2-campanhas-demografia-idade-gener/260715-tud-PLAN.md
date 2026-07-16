---
phase: quick-260715-tud
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/schema.ts
  - src/lib/meta/schemas.ts
  - src/lib/meta/client.ts
  - src/lib/meta/sync.ts
  - src/lib/trafego/painel.ts
  - src/lib/trafego/aggregate.ts
  - src/components/trafego/demografia-section.tsx
  - src/components/trafego/regioes-section.tsx
  - src/components/trafego/tabela-niveis.tsx
  - src/app/(app)/campanhas/page.tsx
  - drizzle/0025_*.sql
  - scripts/aplicar-migration-0025.ts
autonomous: true
requirements: [ETAPA2-DEMOGRAFIA, ETAPA2-REGIOES, ETAPA2-OBJETIVO]

must_haves:
  truths:
    - "Após rodar o sync, existem linhas em demografia_insights (idade × gênero) e regiao_insights para as contas ativas"
    - "campaign_insights passa a gravar o objective oficial do Meta em cada linha nova"
    - "O painel /campanhas mostra a seção Dados Demográficos com barras por faixa etária, cores por gênero, seletor de campanha e de métrica e botão Ocultar Gênero"
    - "O painel /campanhas mostra o ranking de regiões por resultado e custo"
    - "A tabela de campanhas tem chips de filtro por objetivo (VENDAS/LEADS/...) usando o objective oficial, com classificarObjetivo como fallback"
  artifacts:
    - path: "src/lib/meta/client.ts"
      provides: "fetchDemografiaInsights e fetchRegiaoInsights (breakdowns, janela 30d) + objective em fetchCampaignInsights"
    - path: "src/lib/meta/sync.ts"
      provides: "Gravação de demografia_insights, regiao_insights e objective dentro de syncSingleAccount"
    - path: "src/lib/trafego/painel.ts"
      provides: "getPainelCampanhas retorna demografia, regioes e objetivoOficial por campanha"
    - path: "src/components/trafego/demografia-section.tsx"
      provides: "Seção Dados Demográficos (imagem 6 da referência)"
    - path: "scripts/aplicar-migration-0025.ts"
      provides: "Aplicação manual da migration em transação via DIRECT_URL"
  key_links:
    - from: "src/lib/meta/sync.ts"
      to: "demografia_insights / regiao_insights"
      via: "upsert por (adAccountId, campaignId, breakdown, dateStop)"
      pattern: "demografiaInsights|regiaoInsights"
    - from: "src/lib/trafego/painel.ts"
      to: "src/lib/trafego/aggregate.ts"
      via: "classificarObjetivo como fallback quando objective é null"
      pattern: "classificarObjetivo"
---

<objective>
Etapa 2 do painel /campanhas: dados demográficos (idade × gênero), ranking de regiões e objetivo oficial da campanha vindo do Meta — estendendo o sync com novas chamadas de insights com breakdowns, o campo `objective`, duas tabelas novas e a UI correspondente (referência: imagens 6 e 4 de `Imagens_referencia_campanhas/`).

Purpose: completar o painel /campanhas com as seções que ficaram fora da Etapa 1 por exigirem mudança no sync.
Output: sync ampliado + migration 0025 aplicada + seções Demografia/Regiões + filtro por objetivo na tabela.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ETAPA-2-CAMPANHAS.md
@.planning/STATE.md
@src/lib/meta/sync.ts
@src/lib/meta/schemas.ts
@src/lib/meta/client.ts
@src/lib/trafego/painel.ts
@src/lib/trafego/aggregate.ts
@src/lib/db/schema.ts
@Imagens_referencia_campanhas/Captura de tela 2026-07-15 182341.png  (imagem 6 — seção demografia)
@Imagens_referencia_campanhas/Captura de tela 2026-07-15 182307.png  (imagem 4 — chips de objetivo na tabela)

<interfaces>
Padrões existentes que DEVEM ser seguidos (extraídos do código atual):

De src/lib/meta/client.ts:
```typescript
async function metaFetch(path: string, params?: Record<string, string>): Promise<unknown> // já pina versão, token e monitora rate limit
export async function fetchAdInsights(adAccountId: string) // padrão de janela agregada 30d: time_range {since: dataMenosDias(30, hoje), until: hoje}, SEM time_increment
```

De src/lib/meta/sync.ts:
```typescript
export async function syncSingleAccount(account: { id: string; metaAccountId: string }): Promise<number>
// padrão: cada bloco extra (ad insights, saldo) envolto em try/catch próprio com console.warn — nunca derruba o sync da conta
```

De src/lib/trafego/aggregate.ts:
```typescript
export function classificarObjetivo(objetivoPrincipal: string | null): ClasseObjetivo | null // manter como FALLBACK
```

De src/lib/trafego/painel.ts:
```typescript
export async function getPainelCampanhas(clienteId: string, periodo: Periodo = '30d'): Promise<PainelCampanhas | null>
// queries SEQUENCIAIS (pool max=5, NUNCA Promise.all em queries); blocos opcionais em try/catch com degradação graciosa (arrays vazios)
// dedupe de janelas ~30d: ficar só com a janela mais recente por chave (maior dateStop) — mesmo padrão do ad_insights
```

Formato de resposta do Meta com breakdowns (level=campaign, breakdowns=age,gender):
cada item traz campaign_id, campaign_name, spend, impressions, clicks, actions[], action_values[], date_start, date_stop E os campos `age` (ex.: "18-24", "65+", "Unknown") e `gender` ("male"|"female"|"unknown"). Com breakdowns=region: campo `region` (nome da região/estado). Validar com Zod ANTES de gravar.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sync ampliado — schema, migration 0025 aplicada na mão, client com breakdowns e objective</name>
  <files>src/lib/db/schema.ts, src/lib/meta/schemas.ts, src/lib/meta/client.ts, src/lib/meta/sync.ts, drizzle/0025_*.sql, scripts/aplicar-migration-0025.ts</files>
  <action>
    1. **Schema Drizzle** (`src/lib/db/schema.ts`):
       - Nova tabela `demografiaInsights` ('demografia_insights'): id uuid PK, adAccountId FK→adAccounts (cascade), campaignId text NOT NULL, campaignName text NOT NULL, age text NOT NULL, gender text NOT NULL, spend numeric(10,2) default '0', impressions integer default 0, clicks integer default 0, actions jsonb, actionValues jsonb, dateStart date NOT NULL, dateStop date NOT NULL, syncedAt timestamptz defaultNow. Índice em (adAccountId, campaignId, dateStop).
       - Nova tabela `regiaoInsights` ('regiao_insights'): mesma forma, trocando age/gender por `region` text NOT NULL. Índice em (adAccountId, campaignId, dateStop).
       - Coluna nova em `campaignInsights`: `objective: text('objective')` (nullable).
       - Adicionar relations com adAccounts no padrão das existentes.
    2. **Migration**: rodar `npx drizzle-kit generate` para gerar `drizzle/0025_*.sql`. NUNCA rodar `drizzle-kit migrate`. Criar `scripts/aplicar-migration-0025.ts` no MESMO padrão de `scripts/aplicar-migration-0024.ts`: lê DIRECT_URL, ANTES confere no information_schema o estado real (tabelas não existem, coluna objective não existe), separa o SQL por `--> statement-breakpoint` e aplica dentro de `sql.begin()`. Executar com `npx tsx --env-file=.env.local scripts/aplicar-migration-0025.ts` e confirmar sucesso.
    3. **Schemas Zod** (`src/lib/meta/schemas.ts`): `metaDemografiaInsightSchema` (campos do metaInsightSchema reduzidos: campaign_id, campaign_name, spend/impressions/clicks com default '0', actions/action_values default [], date_start, date_stop + `age: z.string()`, `gender: z.string()`) e `metaRegiaoInsightSchema` (idem com `region: z.string()`), cada um com seu response schema (data + paging opcional, mesmo formato dos existentes). Adicionar `objective: z.string().optional()` ao `metaInsightSchema`.
    4. **Client** (`src/lib/meta/client.ts`):
       - `fetchDemografiaInsights(adAccountId)`: `/act_{id}/insights` com level='campaign', breakdowns='age,gender', fields='campaign_id,campaign_name,spend,impressions,clicks,actions,action_values', time_range de 30d até hoje (mesmo cálculo do fetchAdInsights), SEM time_increment (janela agregada — decisão da etapa), limit '200', paginação de no máximo 1 página extra (padrão do fetchAdInsights).
       - `fetchRegiaoInsights(adAccountId)`: idem com breakdowns='region'.
       - Em `fetchCampaignInsights`: adicionar `objective` à lista de fields.
    5. **Sync** (`src/lib/meta/sync.ts`), dentro de `syncSingleAccount`:
       - No loop de campaign insights: incluir `objective: insight.objective ?? null` no objeto `data`.
       - Novo bloco (após ad insights, dentro de try/catch próprio com console.warn `[sync-meta] Erro demografia ...`): buscar demografia e região SEQUENCIALMENTE (não Promise.all — respeitar rate limit). Estratégia de gravação: como é janela agregada de ~30d (1 janela nova por dia, igual ad_insights), fazer upsert por chave (adAccountId, campaignId, age, gender, dateStart) — select limit 1 + update/insert, mesmo padrão dos blocos existentes. Idem para região com (adAccountId, campaignId, region, dateStart).
       - NÃO mexer em adset_insights (fora do escopo desta etapa, decisão registrada).
    6. Atenção ao tempo do cron: são +2 chamadas por conta (~10 contas = +20 chamadas) — aceitável; manter tudo sequencial.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx tsx --env-file=.env.local -e "import('./src/lib/db/schema').then(()=>console.log('ok'))"</automated>
    Adicionalmente: script de migration executado com sucesso (saída mostrando tabelas criadas) e conferência read-only no information_schema confirmando demografia_insights, regiao_insights e campaign_insights.objective.
  </verify>
  <done>Migration 0025 aplicada em produção via script manual; client busca breakdowns age,gender e region + objective; sync grava as duas tabelas novas e a coluna objective sem quebrar o fluxo existente (blocos em try/catch).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: getPainelCampanhas retorna demografia, regiões e objetivo oficial (com fallback)</name>
  <files>src/lib/trafego/painel.ts, src/lib/trafego/aggregate.ts (só se precisar exportar tipo), src/lib/trafego/*.test.ts</files>
  <behavior>
    - Teste 1 (módulo puro): dedupe de janelas de demografia — dado linhas com dateStop diferentes para a mesma (campaignId, age, gender), fica só a mais recente.
    - Teste 2 (módulo puro): agregação por faixa etária × gênero soma spend/impressions/clicks e extrai resultados/compras/leads/conversas via parseActionsExtendido.
    - Teste 3 (módulo puro): objetivo da campanha — quando `objective` do Meta existe (ex.: 'OUTCOME_SALES') mapeia para o chip correspondente; quando null, cai no fallback classificarObjetivo/heurística atual.
  </behavior>
  <action>
    A mecânica pura (dedupe + agregação + mapeamento de objective→rótulo do chip) vive em módulo puro testável (padrão do projeto: `src/lib/trafego/metricas.ts` ou novo `src/lib/trafego/demografia.ts` sem imports de db/auth/react). Escrever os testes ANTES (Vitest, padrão dos 14 testes do catálogo).

    Em `getPainelCampanhas`:
    - Nova Query C (SEQUENCIAL, após a Query B, dentro de try/catch com degradação para arrays vazios): buscar demografia_insights das contas com `gte(dateStop, inicioAtual)`, dedupe pela janela mais recente por (campaignId, age, gender), agregar via módulo puro. Retornar `demografia: LinhaDemografia[]` com { campaignId, campaignName, age, gender, spend, impressions, clicks, resultados, compras, leads, conversas } — a UI filtra por campanha e escolhe a métrica client-side.
    - Nova Query D (SEQUENCIAL): idem para regiao_insights → `regioes: LinhaRegiao[]` com { region, spend, resultados (chave-herói), custoPorResultado } ordenado por resultados desc.
    - Objetivo oficial: buscar o `objective` mais recente por campaignId na mesma Query A (adicionar a coluna ao select; ao agregar por campanha, guardar o objective não-nulo mais recente). Cada `LinhaCampanha` ganha `objetivo: string | null` (rótulo do chip: 'VENDAS' | 'LEADS' | 'CONVERSAS' | 'TRAFEGO' | 'ENGAJAMENTO' | 'RECONHECIMENTO' | 'APP', mapeado dos OUTCOME_* do Meta) — null quando nem objective nem fallback resolvem.
    - Documentar no comentário que demografia/regiões refletem a janela ~30d do Meta independente do período selecionado (mesma limitação aceita dos anúncios — a UI avisa).
    - NUNCA Promise.all entre queries; manter total de queries baixo (A + B + C + D).
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit</automated>
  </verify>
  <done>getPainelCampanhas retorna demografia, regioes e objetivo por campanha; testes do módulo puro passando; suite existente (237+) intacta.</done>
</task>

<task type="auto">
  <name>Task 3: UI — seção Demografia, ranking de Regiões e chips de objetivo na tabela</name>
  <files>src/components/trafego/demografia-section.tsx, src/components/trafego/regioes-section.tsx, src/components/trafego/tabela-niveis.tsx, src/app/(app)/campanhas/page.tsx</files>
  <action>
    Toda a copy em português. Cores de gráfico: `--chart-1..5` de globals.css (definidas light+dark).

    1. **`demografia-section.tsx`** (client) — reproduzir a imagem 6:
       - Card "Dados Demográficos — {nome da campanha}" com: Select de campanha (default: todas ou a de maior spend), grupo de botões-pílula de métrica (Impressões / Resultados / Compras / Leads / Conversas — Resultados default) e botão "Ocultar Gênero" (toggle).
       - Gráfico de barras Recharts (padrão do grafico-performance.tsx): eixo X = faixas etárias (13-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+), barras EMPILHADAS por gênero (Masculino = --chart-1, Feminino = --chart-2 ou tom rosa da paleta, Desconhecido = muted). Com "Ocultar Gênero" ativo: barra única somada. Tooltip com total da faixa e distribuição % por gênero (como na referência). Legenda embaixo.
       - Estado vazio honesto: "Sem dados demográficos ainda — rode uma sincronização" quando demografia vazia (primeiro sync pós-deploy ainda não rodou).
       - Nota discreta de que os dados refletem os últimos ~30 dias (mesma janela dos anúncios).
    2. **`regioes-section.tsx`** — Card "Regiões que mais vendem" (título adaptado ao herói: vendas/leads/conversas): ranking top ~10 regiões com barra proporcional, resultado (chave-herói), investimento e custo por resultado. Mesmo estado vazio honesto.
    3. **`tabela-niveis.tsx`** — chips "Filtrar por objetivo" acima da busca (como na imagem 4): renderizar um chip por objetivo distinto presente nas campanhas (VENDAS, LEADS, ...), toggle de filtro client-side; campanha sem objetivo aparece sempre. Mostrar badge pequeno do objetivo na linha da campanha. Não mexer no resto da tabela.
    4. **`page.tsx` de /campanhas**: passar os novos dados do getPainelCampanhas e posicionar Demografia e Regiões após o Funil de Conversão (ordem da referência).
    5. `npm run build` limpo. NÃO commitar em master sem terminar tudo; commit único do quick no final (deploy é pela master — cron 06h BR fará o primeiro sync com breakdowns).
  </action>
  <verify>
    <automated>npm run build</automated>
    Manual: abrir /campanhas de um cliente com contas vinculadas; antes do primeiro sync as seções novas mostram estado vazio honesto; após rodar o sync manual, demografia/regiões/chips aparecem com dado real.
  </verify>
  <done>Painel /campanhas exibe Dados Demográficos (barras idade×gênero com seletores e Ocultar Gênero), ranking de Regiões e filtro por objetivo na tabela; build de produção limpo.</done>
</task>

</tasks>

<verification>
- `npx vitest run` — suite completa passando (existentes + novos testes do módulo puro).
- `npm run build` — build de produção sem erros.
- Banco (read-only): demografia_insights e regiao_insights existem; campaign_insights tem coluna objective.
- Sync manual (botão existente ou rota) executa sem erro e popula as tabelas novas.
</verification>

<success_criteria>
- Sync grava demografia (idade×gênero), regiões e objective sem estourar tempo/rate limit (chamadas sequenciais, try/catch por bloco).
- Migration 0025 aplicada NA MÃO via script em transação (nunca drizzle-kit migrate), com conferência prévia do estado real do banco.
- /campanhas mostra as três novidades da Etapa 2 fiéis às referências (imagens 6 e 4), com estados vazios honestos e classificarObjetivo mantido como fallback.
</success_criteria>

<output>
Após completar, criar `.planning/quick/260715-tud-etapa-2-campanhas-demografia-idade-gener/260715-tud-SUMMARY.md`
</output>

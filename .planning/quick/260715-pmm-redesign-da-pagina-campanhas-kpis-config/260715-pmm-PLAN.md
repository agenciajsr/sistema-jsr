---
phase: quick-260715-pmm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/schema.ts
  - drizzle/0024_preferencias_campanhas.sql
  - scripts/aplicar-migration-0024.ts
  - src/lib/trafego/aggregate.ts
  - src/lib/trafego/metricas.ts
  - src/lib/trafego/metricas.test.ts
  - src/lib/trafego/painel.ts
  - src/actions/trafego.ts
  - src/app/(app)/campanhas/page.tsx
  - src/components/trafego/grade-kpis.tsx
  - src/components/trafego/organizar-sheet.tsx
  - src/components/trafego/grafico-performance.tsx
  - src/components/trafego/tabela-niveis.tsx
  - src/components/trafego/funil-conversao.tsx
autonomous: true
requirements: [QUICK-PMM-01]
user_setup: []

must_haves:
  truths:
    - "Usuário seleciona cliente + período e vê grade de KPIs calculados dos insights sincronizados (investimento, ROAS, CPA, leads, conversas, compras, CTR, CPM, CPC etc.), métricas sem dados mostrando 0/— sem sumir"
    - "Usuário abre 'Organizar' (painel lateral), liga/desliga e reordena métricas, e a configuração persiste por cliente entre sessões"
    - "Usuário ativa 'Comparar' e cada card mostra variação % vs. período anterior equivalente, com verde/vermelho semanticamente correto (custo subindo = vermelho)"
    - "Usuário vê gráfico de linhas diário multi-métrica com legenda clicável e filtro por campanha"
    - "Usuário alterna tabela entre campanhas/conjuntos/anúncios, busca por nome, filtra status, vê linha de totais e thumbnails nos anúncios (status é badge, NUNCA switch de ação)"
    - "Usuário monta funil de conversão (2-6 etapas, métrica por etapa, % de conversão + custo por unidade) e a configuração persiste por cliente"
    - "Funções existentes preservadas: sync manual, última sync, health score, criativos campeões, contas não vinculadas"
  artifacts:
    - path: "drizzle/0024_preferencias_campanhas.sql"
      provides: "Tabela preferencias_campanhas (por cliente, jsonb) — idempotente"
      contains: "IF NOT EXISTS"
    - path: "src/lib/trafego/painel.ts"
      provides: "getPainelCampanhas — agregação única (período atual + anterior + níveis) com poucas queries GROUP BY"
    - path: "src/lib/trafego/metricas.ts"
      provides: "Catálogo de métricas + cálculo puro (testável) a partir dos totais parseados"
    - path: "src/components/trafego/organizar-sheet.tsx"
      provides: "Sheet Organizar com switches e reordenação"
    - path: "src/components/trafego/funil-conversao.tsx"
      provides: "Funil configurável com barras CSS decrescentes"
  key_links:
    - from: "src/lib/trafego/painel.ts"
      to: "src/lib/trafego/aggregate.ts"
      via: "reutiliza parseActions/parseActionValues/heroiDoObjetivo (fonte única)"
      pattern: "import \\{.*parseActions.*\\} from './aggregate'"
    - from: "src/app/(app)/campanhas/page.tsx"
      to: "src/lib/trafego/painel.ts"
      via: "Server Component chama getPainelCampanhas"
      pattern: "getPainelCampanhas"
    - from: "src/components/trafego/organizar-sheet.tsx"
      to: "src/actions/trafego.ts"
      via: "Server Action salvarPreferenciasCampanhas"
      pattern: "salvarPreferenciasCampanhas"
---

<objective>
Redesign completo da página /campanhas seguindo a referência visual de dashboard Meta Ads (Imagens_referencia_campanhas/, 6 prints): grade de KPIs configurável com painel "Organizar" persistido por cliente, toggle "Comparar" (período atual vs. anterior equivalente), gráfico Performance multi-métrica com legenda clicável, tabela por nível (campanhas/conjuntos/anúncios) com busca/filtro/totais, e Funil de Conversão configurável — tudo somente-visualização, usando apenas dados já sincronizados.

Purpose: transformar /campanhas no painel principal de análise de tráfego da JSR, no nível visual da ferramenta de referência.
Output: página redesenhada + migration 0024 (preferências por cliente) + módulo de agregação único e eficiente.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@Imagens_referencia_campanhas/ (as 6 capturas — referência visual DEFINITIVA; LER antes de codar UI)
@src/app/(app)/campanhas/page.tsx
@src/lib/trafego/aggregate.ts
@src/lib/db/schema.ts
@src/actions/trafego.ts
@src/components/trafego/
@src/components/stat-card.tsx
@src/components/dashboard/ (padrão visual de gráficos)
@src/components/ui/ (sheet.tsx, switch.tsx, tabs.tsx, badge.tsx, chart.tsx já existem no registry)
@src/lib/utils/with-retry.ts
@scripts/aplicar-migration-0022.ts (modelo do script de migration manual)

<interfaces>
Dados disponíveis (src/lib/db/schema.ts):
- campaignInsights: DIÁRIO por campanha — date, spend, impressions, clicks, reach, cpc, cpm, ctr, actions jsonb, actionValues jsonb
- adsetInsights / adInsights: AGREGADOS por período (dateStart/dateStop), com adsetName/campaignName; adInsights tem thumbnailUrl, effectiveStatus, frequency
- adAccounts: clienteId, plataforma='meta', ativo

Fonte única de parsing (src/lib/trafego/aggregate.ts):
- parseActions(actions): { leads, vendas, conversas, linkClicks } — dedup por prioridade de action_type
- parseActionValues(actionValues): receita de compras
- heroiDoObjetivo(objetivoPrincipal, nicho) / classificarObjetivo — métrica-herói
- getMetricasIntervalo(clienteId, dataMin, dataMax) — já compara intervalos fechados (padrão a seguir)
- Periodo = 'hoje' | 'ontem' | '7d' | '30d'; hojeBrasilia()/dataMenosDias() de @/lib/date-br

Decisões LOCKED do usuário:
1. Comparar = PERÍODOS (atual vs. anterior equivalente), não campanhas
2. V1 só dados já sincronizados; NÃO mexer no sync; demográficos/regiões/objetivo oficial Meta FORA
3. Preferências do Organizar persistem POR CLIENTE (jsonb)
4. Somente visualização — status é badge, NUNCA switch de ação
5. Todo texto de UI e comentários em PORTUGUÊS
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Camada de dados — catálogo de métricas puro, getPainelCampanhas agregado e migration 0024 de preferências</name>
  <files>src/lib/trafego/metricas.ts, src/lib/trafego/metricas.test.ts, src/lib/trafego/painel.ts, src/lib/trafego/aggregate.ts, src/lib/db/schema.ts, drizzle/0024_preferencias_campanhas.sql, scripts/aplicar-migration-0024.ts, src/actions/trafego.ts</files>
  <behavior>
    Testes (Vitest, módulo PURO sem db/react) em metricas.test.ts:
    - parseActionsExtendido extrai também: add_to_cart (adições ao carrinho, dedup omni_add_to_cart > add_to_cart > offsite_conversion.fb_pixel_add_to_cart), landing_page_view (omni_landing_page_view > landing_page_view), page_engagement/post_engagement (engajamento), video_view opcional — reutilizando somarGrupo do aggregate (exportar somarGrupo ou mover a lógica compartilhada). Nulos/lixo → tudo 0.
    - calcularMetricas(totais) computa TODAS as derivadas do catálogo: ROAS (receita/spend), CPA (spend/vendas), ticket médio (receita/vendas), custo por conversa, custo por lead, CTR todos, CTR link (linkClicks/impressions), CPM, CPC, CPC link (spend/linkClicks), custo por resultado (herói), com null quando denominador 0.
    - variacao(atual, anterior) → % de variação (null quando anterior 0/null) e variacaoEBoa(metricaId, delta) → boolean (métricas de CUSTO subindo = ruim; volume/receita subindo = bom).
    - CATALOGO_METRICAS: lista ordenada padrão com id, label PT, formato ('moeda'|'numero'|'pct'|'multiplicador'), tipo ('custo'|'volume'|'taxa') — inclui: investimento, valorEmCompras, roas, cpaMedio, ticketMedio, adicoesCarrinho, compras, conversas, custoPorConversa, leads, custoPorLead, impressoes, alcance, cliques, cliquesNoLink, ctrTodos, ctrLink, cpm, cpcMedio, cpcLink, visualizacoesLp, engajamento, resultados, custoPorResultado.
  </behavior>
  <action>
    1. Criar src/lib/trafego/metricas.ts (módulo puro, zero import de db/auth/react — padrão de @/lib/financeiro/calculos) com o catálogo, os cálculos e as funções de variação acima, sob TDD. Estender o parsing REUTILIZANDO a mecânica de aggregate.ts (exportar somarGrupo/isActionItem de aggregate.ts em vez de duplicar — fonte única). "resultados" = resultado da métrica-herói do cliente (heroiDoObjetivo), fallback soma leads+vendas+conversas quando herói zerado? NÃO — manter simples: resultados = resultado da chave-herói; documentar no código.
    2. Criar src/lib/trafego/painel.ts com getPainelCampanhas(clienteId, periodo): UMA passada com POUCAS queries agregadas SEQUENCIAIS (pool max=5, nunca Promise.all interno — decisão 260714-ita):
       - Query A: campaignInsights do período ATUAL + ANTERIOR equivalente numa única query (WHERE date >= inicioAnterior AND date <= fimAtual), separando em memória por data — período anterior: hoje→ontem, ontem→anteontem, 7d→7d anteriores, 30d→30d anteriores (mesma janela deslocada).
       - Dela derivar: totais atual/anterior (via parseActions estendido), série diária por métrica (map date→totais parciais para o gráfico Performance), agregado por campanha (nível campanhas da tabela + filtro do gráfico + funil por campanha).
       - Query B: adsetInsights do período (nível conjuntos). Query C: adInsights do período (nível anúncios, com thumbnailUrl/effectiveStatus). Ambas com inArray(contas) + intervalo de datas; try/catch degradação graciosa como o adRows atual.
       - Retornar tipo PainelCampanhas { totaisAtual, totaisAnterior, seriePorDia, campanhas[], conjuntos[], anuncios[], heroi, receita, temDados }. Manter getResumoCliente intacto para quem mais o usa (saúde/relatórios) — a página nova usa getPainelCampanhas.
    3. Schema + migration: adicionar em schema.ts a tabela preferenciasCampanhas ('preferencias_campanhas'): id uuid pk default, clienteId uuid NOT NULL UNIQUE references clientes(id) on delete cascade, kpis jsonb (ordem + ligadas: [{id, ativo}] na ordem), funil jsonb ({ campanhas: string[] | null, etapas: string[] }), createdAt/updatedAt. Pensada para o futuro portal do cliente (por cliente, não por usuário). Gerar drizzle/0024_preferencias_campanhas.sql À MÃO, IDEMPOTENTE (CREATE TABLE IF NOT EXISTS + índices IF NOT EXISTS). NUNCA rodar drizzle-kit migrate. Criar scripts/aplicar-migration-0024.ts nos moldes de aplicar-migration-0022.ts (DIRECT_URL, sql.begin(), split por '--> statement-breakpoint', tsx --env-file=.env.local). NÃO EXECUTAR o script — deixar pronto e instruir no SUMMARY (padrão do projeto: aplicar na mão).
    4. Actions em src/actions/trafego.ts: getPreferenciasCampanhas(clienteId) (retorna null em erro/'relation does not exist' — degradação graciosa até a migration ser aplicada, padrão getWorkspaceAtual) e salvarPreferenciasCampanhas(clienteId, { kpis?, funil? }) com upsert (onConflictDoUpdate por clienteId), sessão obrigatória, revalidatePath('/campanhas').
    Comentários em português.
  </action>
  <verify>
    <automated>npx vitest run src/lib/trafego/metricas.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>Catálogo + cálculos puros testados; getPainelCampanhas retorna atual+anterior+níveis com ~3 queries agregadas sequenciais; migration 0024 idempotente gerada (NÃO aplicada) com script pronto; actions de preferências com degradação graciosa.</done>
</task>

<task type="auto">
  <name>Task 2: Grade de KPIs configurável + painel Organizar + toggle Comparar</name>
  <files>src/components/trafego/grade-kpis.tsx, src/components/trafego/organizar-sheet.tsx, src/app/(app)/campanhas/page.tsx</files>
  <action>
    Seguir a imagem 1 (grade de cards 5 colunas em xl) e a imagem 2 (painel Organizar) — adaptadas ao design system do projeto (Card border-none shadow-[var(--shadow-sm)], ícone em pílula colorida como StatCard).

    1. grade-kpis.tsx ('use client'): recebe { totaisAtual, totaisAnterior, catalogoCalculado, preferencias, clienteId }. Renderiza cards das métricas ATIVAS na ORDEM salva (fallback: ordem padrão do CATALOGO_METRICAS com todas ligadas). Card: label + ícone lucide numa pílula azul suave (estilo referência), valor grande formatado (moeda/número/%/x). Métrica sem dados no período = 0 / R$ 0,00 / — (nunca some). Header da seção com botões "Organizar" (abre Sheet) e "Comparar" (toggle com estado local): quando ligado, cada card mostra variação % vs. período anterior com seta e cor via variacaoEBoa (custo subindo = vermelho; anterior 0 → "—"). Texto pequeno "vs. período anterior" quando comparando.
    2. organizar-sheet.tsx ('use client'): Sheet (side right) "Organizar" listando TODAS as métricas do catálogo, cada linha com grip (GripVertical), label e Switch (shadcn switch, estilo iOS). Reordenação sem lib nova: drag nativo HTML (onDragStart/onDragOver/onDrop) OU botões de seta cima/baixo — escolher drag nativo se couber limpo, senão setas (funcional > fiel). Estado local otimista; ao mudar, salvar via salvarPreferenciasCampanhas com useTransition + toast de erro (sonner). Se preferências não persistem (migration não aplicada, action retorna erro), avisar no toast e manter só em memória.
    3. page.tsx: substituir a grade atual de StatCards pela GradeKpis, alimentada por getPainelCampanhas + getPreferenciasCampanhas (chamadas SEQUENCIAIS no Server Component, não Promise.all com as demais). Manter maxDuration = 60, manter seletor de cliente/período, sync, última sync, health score, estados vazios existentes. Página continua Server Component.
    Todo texto em português.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint -- --quiet</automated>
  </verify>
  <done>Grade de KPIs configurável fiel à referência; Organizar liga/desliga e reordena com persistência por cliente (degradando graciosamente sem a migration); Comparar mostra % vs. período anterior com semântica de cor correta; nenhum switch de ação sobre campanhas.</done>
</task>

<task type="auto">
  <name>Task 3: Gráfico Performance multi-métrica + tabela por nível + Funil de Conversão + montagem final da página</name>
  <files>src/components/trafego/grafico-performance.tsx, src/components/trafego/tabela-niveis.tsx, src/components/trafego/funil-conversao.tsx, src/app/(app)/campanhas/page.tsx</files>
  <action>
    Seguir imagens 3 (Performance), 4 (tabela), 5-6 (funil) — adaptadas ao padrão visual dos gráficos existentes (ChartContainer/ChartTooltip de @/components/ui/chart, como grafico-verba.tsx e dashboard/).

    1. grafico-performance.tsx ('use client'): LineChart Recharts diário multi-métrica a partir de seriePorDia. Legenda customizada clicável abaixo do gráfico (chips com a cor da métrica; clicada = ativa, inativa = riscada/cinza — como na referência; texto "Clique nas métricas para alterar a visualização"). Métricas disponíveis: investimento, alcance, leads, custo por lead, compras, conversas, cliques, custo por conversa (default ligadas: investimento + herói). DOIS eixos Y: esquerda moeda (métricas de custo/investimento), direita contagem (volume) — yAxisId por tipo do catálogo. Select de campanha no header do card (Todas as campanhas | cada campanha) filtrando a série client-side: para isso getPainelCampanhas deve expor seriePorDia também por campanha (se Task 1 não expôs, estender aqui: seriePorDia[] com campaignId opcional, agregando client-side). Cores: var(--chart-1..5)/paleta do projeto.
    2. tabela-niveis.tsx ('use client'): card com Tabs (campanhas | conjuntos | anúncios), Input de busca por nome, filtro de status (Todos | Ativos | Inativos — só nos níveis com effectiveStatus; campanhas/conjuntos sem status mostram "—"). Colunas: nome (com thumbnail 32px arredondada nos anúncios; fallback quadrado neutro), badge de status (verde "Ativo" / cinza "Inativo" via effectiveStatus — badge VISUAL, sem switch), gasto, CPC, CTR, CPM, impressões, resultados (label da métrica-herói), custo por resultado. Linha de TOTAIS no rodapé (soma/derivadas recalculadas dos itens filtrados). Ordenar por gasto desc. Sem paginação (volume pequeno); overflow-x-auto para mobile.
    3. funil-conversao.tsx ('use client'): card "Funil de Conversão". Seletor de campanhas (dropdown com checkboxes — todas ou subconjunto). Etapas: mín 2, máx 6; cada etapa tem Select de métrica (impressões, cliques, cliques no link, visualizações de página de destino, adições ao carrinho, conversas, leads, compras, resultados), botão remover (a partir da 3ª) e "Adicionar etapa". Visual: barras horizontais centradas com largura proporcional ao valor da 1ª etapa (mín 25%), tons de azul escurecendo (CSS/divs, sem lib), dentro de cada barra o label + valor + custo por unidade (spend/valor da etapa); entre etapas, "X% Conversão" (etapaN+1/etapaN*100; anterior 0 → "—"). Valores computados client-side a partir dos agregados por campanha vindos do servidor (totais das campanhas selecionadas). Configuração (etapas + campanhas) salva em preferencias_campanhas.funil via salvarPreferenciasCampanhas (mesma degradação graciosa da Task 2); carregada como default no mount.
    4. page.tsx — layout final na ordem da referência: header (título + seletor cliente/período + última sync + sync) → linha com contas unificadas + health score → GradeKpis → card Performance → TabelaNiveis → FunilConversao → CriativosCampeoes (mantido; conjuntos-performam.tsx pode ser removido da página, pois a tabela por nível o substitui — remover o import e deixar o arquivo) → ContasNaoVinculadas no fim. Estados vazios existentes preservados. Rodar npm run build ao final.
    Todo texto em português.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>Performance multi-métrica com legenda clicável, eixos duplos e filtro por campanha; tabela alterna campanhas/conjuntos/anúncios com busca, status badge, thumbnails e totais; funil configurável (2-6 etapas, % conversão + custo/unidade) persistido por cliente; página remontada mantendo sync/health/criativos/contas não vinculadas; build verde.</done>
</task>

</tasks>

<verification>
- `npx vitest run` — suíte completa verde (incluindo metricas.test.ts novo)
- `npm run build` — build de produção sem erros
- Conferir que src/lib/meta/sync* NÃO foi tocado (decisão 2)
- Conferir que nenhum componente novo emite ação de ligar/desligar campanha (decisão 4)
- grep -r "drizzle-kit migrate" scripts/ → nada novo; migration 0024 só via script manual
</verification>

<success_criteria>
- Página /campanhas reproduz a estrutura da referência (KPIs → Performance → Tabela → Funil) adaptada ao design system do projeto
- Organizar e Funil persistem por cliente em preferencias_campanhas (jsonb), com degradação graciosa antes da migration ser aplicada
- Comparar mostra variação % de período com cor semanticamente correta
- Carga do banco controlada: ~3-4 queries agregadas sequenciais em getPainelCampanhas (não N por campanha)
- Migration 0024 idempotente gerada + script de aplicação manual pronto (NÃO executado)
- 100% dos textos de UI em português
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260715-pmm-redesign-da-pagina-campanhas-kpis-config/260715-pmm-SUMMARY.md` — incluir instrução de aplicar a migration 0024 na mão (tsx --env-file=.env.local scripts/aplicar-migration-0024.ts).
</output>

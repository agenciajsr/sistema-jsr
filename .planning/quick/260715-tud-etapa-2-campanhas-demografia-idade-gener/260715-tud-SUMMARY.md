---
phase: quick-260715-tud
plan: 01
subsystem: campanhas
tags: [meta-ads, sync, demografia, regioes, objective, recharts]
requires:
  - quick-260715-pmm (redesign /campanhas Etapa 1)
  - fast 47cd411 (correcao pos-deploy)
provides:
  - Tabelas demografia_insights e regiao_insights (migration 0025 APLICADA)
  - Coluna campaign_insights.objective gravada a cada sync
  - Secao Dados Demograficos, ranking de Regioes e chips de objetivo em /campanhas
affects:
  - src/lib/meta/sync.ts (novo bloco de breakdowns por conta)
  - getPainelCampanhas (2 queries novas sequenciais)
tech-stack:
  added: []
  patterns:
    - Janela agregada ~30d com dedupe pela janela mais recente (mesmo padrao do ad_insights)
    - Modulo puro testavel (demografia.ts) sem imports de db/auth/react
key-files:
  created:
    - drizzle/0025_etapa2_campanhas.sql
    - scripts/aplicar-migration-0025.ts
    - src/lib/trafego/demografia.ts
    - src/lib/trafego/demografia.test.ts
    - src/components/trafego/demografia-section.tsx
    - src/components/trafego/regioes-section.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/meta/schemas.ts
    - src/lib/meta/client.ts
    - src/lib/meta/sync.ts
    - src/lib/trafego/painel.ts
    - src/components/trafego/tabela-niveis.tsx
    - src/app/(app)/campanhas/page.tsx
decisions:
  - Demografia/regioes sao janela AGREGADA de ~30d (sem time_increment) — o painel deduplica pela janela mais recente por chave, nunca soma janelas
  - Chip de objetivo usa objective OFICIAL da Meta (OUTCOME_* + legados) com classificarObjetivo como fallback; campanha sem objetivo nunca some do filtro
  - adset_insights NAO foi tocada (fora do escopo, decisao registrada na etapa)
metrics:
  duration: ~25min
  completed: 2026-07-15
---

# Quick 260715-tud: Etapa 2 de /campanhas — Demografia, Regiões e Objetivo oficial

Sync Meta ampliado com breakdowns idade×gênero e região + objective oficial; painel /campanhas ganha seção Dados Demográficos (barras empilhadas com Ocultar Gênero), ranking de Regiões pela chave-herói e filtro por objetivo na tabela.

## O que foi feito

### Task 1 — Sync ampliado (commit 3edd8fc)
- **Schema/migration 0025**: tabelas `demografia_insights` (age×gender) e `regiao_insights` (region), ambas com janela `date_start/date_stop` e índice por (conta, campanha, dateStop); coluna `objective` (nullable) em `campaign_insights`. Migration **APLICADA em produção** via `scripts/aplicar-migration-0025.ts` (transação, DIRECT_URL, conferência prévia e posterior no information_schema — padrão da 0024).
- **Client**: `fetchDemografiaInsights` e `fetchRegiaoInsights` (level=campaign, breakdowns, janela 30d até hoje BR, sem time_increment, Zod, max 1 página extra); `objective` adicionado aos fields do `fetchCampaignInsights`.
- **Sync**: `syncSingleAccount` grava as duas tabelas novas em bloco try/catch próprio (`[sync-meta] Erro demografia/regioes ...`), chamadas SEQUENCIAIS; upsert por (conta, campanha, age, gender, dateStart) e (conta, campanha, region, dateStart). +2 chamadas Meta por conta.

### Task 2 — Dados do painel, sob TDD (commits 94ff783 RED, 23fc772 GREEN)
- Módulo puro `src/lib/trafego/demografia.ts`: `deduplicarJanelaMaisRecente` (genérico por chave), `agregarDemografia`, `agregarRegioes` (custo/resultado, ordenado por resultados desc) e `objetivoDaCampanha` (mapa OUTCOME_* + legados → chip, fallback `classificarObjetivo`). 10 testes novos.
- `getPainelCampanhas`: Query C (demografia) e Query D (regiões) sequenciais com degradação graciosa (arrays vazios); `objective` mais recente por campanha lido na Query A; `LinhaCampanha.objetivo: ObjetivoChip | null`.

### Task 3 — UI (commit 2c28ee4)
- `demografia-section.tsx`: card "Dados Demográficos — {campanha}", Select de campanha (default todas), pílulas Impressões/Resultados/Compras/Leads/Conversas (Resultados default), botão "Ocultar Gênero" (barra única somada), barras EMPILHADAS (Masculino=--chart-1, Feminino=--chart-2, Desconhecido=muted), tooltip com total + distribuição % por gênero, legenda embaixo, estado vazio honesto e aviso da janela ~30d.
- `regioes-section.tsx`: título adaptado ao herói ("Regiões que mais vendem/geram leads/conversas"), top 10 com barra proporcional, resultados, investimento e custo/resultado.
- `tabela-niveis.tsx`: chips "Filtrar por objetivo" acima da busca (toggle, só nível campanhas; campanha sem objetivo aparece sempre) + badge do objetivo na linha.
- `page.tsx`: seções posicionadas após o Funil de Conversão.

## Verificação
- `npx vitest run`: 113 arquivos / 1487 testes passando (10 novos).
- `npx tsc --noEmit` e `npm run build` limpos.
- Migration 0025 confirmada no banco (tabelas + coluna via information_schema).
- **Sync real executado em 1 conta (BM 02 - CA1 - Melzinho)**: 230 campaign insights com `objective` preenchido, **172 linhas de demografia** e **250 de regiões** gravadas — dado real de idade/gênero e estados brasileiros confirmado.

## Desvios do plano

### Ajustes automáticos
**1. [Rule 3 - Bloqueio] Numeração da migration gerada pelo drizzle-kit**
- **Encontrado em:** Task 1
- **Problema:** o journal do Drizzle está fora de sincronia com os nomes dos arquivos (gerou `0022_bitter_doctor_strange.sql` incluindo a `preferencias_campanhas` da 0024).
- **Correção:** arquivo renomeado para `0025_etapa2_campanhas.sql`, statements da 0024 removidos (já aplicada) e tag do journal corrigida.
- **Commit:** 3edd8fc

## Known Stubs
Nenhum — as seções novas mostram estado vazio honesto ("rode uma sincronização") até o primeiro sync de cada conta; o cron diário (06h BR) popula todas as contas.

## Observações operacionais
- O primeiro sync completo pós-deploy (cron ou botão) preencherá demografia/regiões/objective das demais contas — só 1 conta foi sincronizada no teste.
- Demografia/regiões refletem sempre os últimos ~30 dias do Meta, independente do período selecionado no painel (a UI avisa — mesma limitação aceita dos anúncios).

## Self-Check: PASSED
- Arquivos criados conferidos em disco (demografia.ts, demografia.test.ts, demografia-section.tsx, regioes-section.tsx, 0025_etapa2_campanhas.sql, aplicar-migration-0025.ts).
- Commits 3edd8fc, 94ff783, 23fc772, 2c28ee4 presentes no log.

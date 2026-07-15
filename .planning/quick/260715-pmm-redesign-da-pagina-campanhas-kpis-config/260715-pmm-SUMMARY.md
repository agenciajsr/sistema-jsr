---
phase: quick-260715-pmm
plan: 01
subsystem: trafego
tags: [campanhas, kpis, meta-ads, recharts, preferencias, funil]
requires: [campaign_insights, adset_insights, ad_insights, ad_accounts]
provides:
  - getPainelCampanhas (agregação única atual+anterior+níveis)
  - Catálogo de 24 métricas puro e testado (metricas.ts)
  - Tabela preferencias_campanhas (jsonb por cliente) — migration 0024 NÃO aplicada
  - Página /campanhas redesenhada (KPIs → Performance → Tabela → Funil)
affects: [/campanhas]
tech-stack:
  added: []
  patterns:
    - Módulo puro de cálculo (zero db/react) consumido por server e client
    - aggregate.ts reexporta o parsing de metricas.ts (fonte única)
    - Preferências por CLIENTE em jsonb com upsert e degradação graciosa pré-migration
key-files:
  created:
    - src/lib/trafego/metricas.ts
    - src/lib/trafego/metricas.test.ts
    - src/lib/trafego/painel.ts
    - src/components/trafego/grade-kpis.tsx
    - src/components/trafego/organizar-sheet.tsx
    - src/components/trafego/grafico-performance.tsx
    - src/components/trafego/tabela-niveis.tsx
    - src/components/trafego/funil-conversao.tsx
    - drizzle/0024_preferencias_campanhas.sql
    - scripts/aplicar-migration-0024.ts
  modified:
    - src/lib/trafego/aggregate.ts
    - src/lib/db/schema.ts
    - src/actions/trafego.ts
    - src/app/(app)/campanhas/page.tsx
decisions:
  - "Parsing de actions mora em metricas.ts (puro); aggregate.ts reexporta — testável sem banco"
  - "ROAS null quando spend OU receita = 0 (mesma semântica do getResumoCliente)"
  - "Investimento classificado como tipo 'custo' no Comparar (subir = vermelho)"
  - "Janelas 7d/30d do painel = intervalos fechados de exatamente 7/30 dias (comparação justa com o período anterior)"
metrics:
  duration: ~50min
  completed: 2026-07-15
---

# Quick 260715-pmm: Redesign da página /campanhas (KPIs configuráveis) — Summary

Redesign completo da /campanhas no padrão do dashboard Meta Ads de referência: grade de 24 KPIs configurável (Organizar com drag + switches, persistido por cliente), toggle Comparar vs. período anterior equivalente, gráfico Performance multi-métrica com legenda clicável e eixos duplos, tabela por nível (campanhas/conjuntos/anúncios) com busca/filtro/totais e Funil de Conversão configurável — tudo somente-visualização sobre dados já sincronizados.

## O que foi feito

### Task 1 — Camada de dados (commits `0d0bf1c` test, `788cff0` feat)
- **`src/lib/trafego/metricas.ts`** (puro, 14 testes): `parseActionsExtendido` (carrinho, LP views, engajamento, vídeo — dedup por prioridade), `calcularMetricas` (24 derivadas, null quando denominador 0), `variacao`/`variacaoEBoa` (custo subindo = ruim), `CATALOGO_METRICAS` com label PT, formato e tipo.
- **`src/lib/trafego/painel.ts`**: `getPainelCampanhas(clienteId, periodo)` — Query A única para atual+anterior (split em memória), Query B (conjuntos) e C (anúncios) com try/catch de degradação; retorna totais, série diária por campanha, e os 3 níveis agregados. ~3-5 queries sequenciais, nunca N por campanha. `getResumoCliente` intocado.
- **Tabela `preferencias_campanhas`** (jsonb `kpis` + `funil`, unique por cliente, cascade) + migration 0024 idempotente + script manual.
- **Actions**: `getPreferenciasCampanhas` (null em erro — degradação até a migration) e `salvarPreferenciasCampanhas` (upsert por cliente, revalidatePath).

### Task 2 — Grade de KPIs (commit `f5b20da`)
- `GradeKpis`: cards 5 colunas (xl) com ícone em pílula azul, valor formatado (métrica sem dados = R$ 0,00/0/0,00% — nunca some), Comparar com seta e cor semântica, "vs. período anterior".
- `OrganizarSheet`: painel lateral com grip + drag nativo HTML + Switch por métrica; estado otimista, toast em erro de persistência (config vale só na sessão até a migration).
- `page.tsx` migrada para `getPainelCampanhas` + `getPreferenciasCampanhas` (sequenciais).

### Task 3 — Performance, Tabela e Funil (commit `0bddf26`)
- `GraficoPerformance`: LineChart diário, 8 métricas na legenda clicável (default: investimento + herói), eixo esquerdo R$ / direito contagem, Select de campanha filtrando a série client-side.
- `TabelaNiveis`: abas campanhas/conjuntos/anúncios, busca, filtro Ativos/Inativos (só anúncios têm `effectiveStatus`; demais mostram "—"), thumbnail 32px com fallback, badge de status VISUAL (sem switch), linha de totais recalculada dos itens filtrados, ordenação por gasto.
- `FunilConversao`: 2-6 etapas com Select de métrica, remover a partir da 3ª, "% Conversão" entre etapas, custo/unidade dentro da barra, barras CSS centradas (mín 25%) em tons de azul, seletor de campanhas com checkboxes; persistido em `preferencias_campanhas.funil`.
- Layout final: header → contas+health → KPIs → Performance → Tabela → Funil → Criativos campeões → Contas não vinculadas. `ConjuntosPerformam` saiu da página (arquivo mantido); `GraficoVerba` segue usado por outras telas.

## ⚠️ Ação pendente do usuário — aplicar a migration 0024

A tabela `preferencias_campanhas` ainda NÃO existe no banco. Até aplicar, o Organizar/Funil funcionam mas a configuração não persiste (toast avisa). Para aplicar:

```bash
npx tsx --env-file=.env.local scripts/aplicar-migration-0024.ts
```

O script confere o estado real do banco antes, roda em transação e confirma as colunas ao final. NUNCA usar `drizzle-kit migrate`.

## Desvios do plano

**1. [Rule 3 - Bloqueio] Parsing movido para metricas.ts em vez de exportado de aggregate.ts**
- **Encontrado em:** Task 1
- **Problema:** metricas.ts precisa ser puro/testável, mas aggregate.ts importa `@/lib/db` (abriria conexão no vitest).
- **Correção:** a mecânica (somarGrupo, parseActions, parseActionValues, tipos) mudou-se para metricas.ts; aggregate.ts reexporta tudo — imports existentes e a fonte única preservados.
- **Commit:** 788cff0

Fora isso, plano executado como escrito.

## Verificação
- `npx vitest run` — 1477 testes verdes (14 novos)
- `npm run build` — build de produção OK
- `git diff src/lib/meta/` — sync NÃO tocado (decisão 2)
- Nenhum componente novo emite ação de ligar/desligar campanha (status = Badge)
- `grep drizzle-kit migrate scripts/` — só comentários explicando por que não usar

## Known Stubs
Nenhum — todos os painéis consomem dados reais sincronizados; antes da migration 0024 as preferências degradam para os padrões (comportamento documentado, não stub).

## Self-Check: PASSED
- Arquivos criados/modificados presentes no disco ✓
- Commits 0d0bf1c, 788cff0, f5b20da, 0bddf26 no log ✓

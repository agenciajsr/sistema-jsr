---
phase: quick-260712-2vk
plan: 01
subsystem: campanhas
tags: [saude-campanhas, alertas, health-score, meta-ads, drizzle, vitest]

requires:
  - phase: quick-260711-q7a
    provides: tabelas ad_accounts/campaign_insights + sync Meta
  - phase: quick-260711-sv1
    provides: pipeline de agregação de tráfego (parseActions, metricaHeroi, listarClientesComContas)
  - phase: quick-260711-i9j
    provides: motor de alertas (Alerta, getAlertas, ordenarPorSeveridade)
provides:
  - Detecção de anomalias de performance por cliente (metas manuais + baseline automático)
  - Health score 0-100 por cliente com rótulo (Saudável/Atenção/Crítico)
  - getMetricasIntervalo para comparação de períodos (7d atual vs. 7d anterior)
  - Metas CPA/CPL/ROAS editáveis por cliente (migration aditiva NÃO aplicada)
affects: [campanhas, alertas, ficha-cliente, dashboard]

tech-stack:
  added: []
  patterns:
    - "Funções puras testáveis (avaliarSaudeCliente/calcularHealthScore) separadas dos orquestradores async de I/O"
    - "Thresholds e pesos como constantes nomeadas no topo do módulo"
    - "Concatenação de alertas de campanha em getAlertas dentro de try/catch (falha isolada não derruba os demais)"

key-files:
  created:
    - src/lib/saude/avaliar-campanhas.ts
    - src/lib/saude/avaliar-campanhas.test.ts
    - src/components/ficha/metas-cliente.tsx
    - src/components/trafego/health-score-cliente.tsx
    - drizzle/0005_young_goliath.sql
  modified:
    - src/lib/db/schema.ts
    - src/lib/trafego/aggregate.ts
    - src/lib/alertas/types.ts
    - src/actions/alertas.ts
    - src/actions/clientes.ts
    - src/app/(app)/clientes/[id]/page.tsx
    - src/app/(app)/campanhas/page.tsx
    - src/app/(app)/alertas/page.tsx
    - src/components/dashboard/alertas-importantes.tsx

key-decisions:
  - "Detecção combinada: meta manual quando existir; caso contrário baseline automático por variação vs. período anterior"
  - "Gate de volume (SPEND_MINIMO_AVALIACAO=50) aplicado a todos os sinais comparativos, exceto sem_conversao que usa SPEND_SEM_CONVERSAO=100"
  - "Health score começa em 100 e penaliza por alerta ativo (sem_conversao -30, cpa_alto crítico -25, demais atenção -12); piso 0"
  - "getSaudeDoCliente chamado em /campanhas apenas quando resumo.temDados (evita ruído de cliente sem dados)"

patterns-established:
  - "Comparação de período: getMetricasIntervalo(clienteId, dataMinima, dataMaxima) com intervalo fechado, reaproveitando parseActions"
  - "Novos TipoAlerta exigem completar os Records exaustivos em /alertas e no painel"

requirements-completed: [SAUDE-CAMPANHAS-P1]

duration: 12min
completed: 2026-07-12
---

# Quick 260712-2vk: Monitoramento de Saúde de Campanhas (Parte 1) Summary

**Detecção de anomalias de performance (metas manuais + baseline automático por histórico) e health score 0-100 por cliente, reaproveitando o motor de alertas e o pipeline de agregação existentes — sem sincronizar nenhum dado novo.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-12T02:12:00Z
- **Completed:** 2026-07-12T02:24:00Z
- **Tasks:** 5 (uma em TDD)
- **Files modified/created:** 14

## Accomplishments

- Módulo de avaliação de saúde com funções PURAS testadas (19 casos vitest) cobrindo cpa_alto (meta/auto), performance_caindo, ctr_caindo, sem_conversao e cálculo de health score.
- Alertas de campanha integrados em `getAlertas` dentro de try/catch — aparecem no dashboard, em /alertas e na ficha (via clienteId) sem UI nova, e uma falha na avaliação não derruba os demais alertas.
- Metas CPA/CPL/ROAS editáveis na ficha (aba Contas de anúncio) e badge de health score no cliente selecionado em /campanhas.
- Migration aditiva `0005_young_goliath.sql` (somente ADD COLUMN em clientes) gerada e revisada — NÃO aplicada.

## Task Commits

1. **Task 1: Schema de metas + migration aditiva** - `7946f72` (feat)
2. **Task 2: getMetricasIntervalo (comparação de período)** - `b67c5b7` (feat)
3. **Task 3 (TDD RED): testes de saúde/health score** - `05e9aa7` (test)
4. **Task 3 (TDD GREEN): avaliarSaudeCliente/calcularHealthScore + orquestradores** - `9e4d980` (feat)
5. **Task 4: wire getAlertasCampanhas em getAlertas (try/catch)** - `d91e0ac` (feat)
6. **Task 5: form de metas na ficha + badge de health score** - `81e0e70` (feat)

## Files Created/Modified

- `src/lib/db/schema.ts` — 3 colunas nullable em clientes (metaCpa/metaCpl/metaRoas).
- `drizzle/0005_young_goliath.sql` — migration aditiva (3x ADD COLUMN), NÃO aplicada.
- `src/lib/trafego/aggregate.ts` — MetricasIntervalo + getMetricasIntervalo (getResumoCliente inalterado).
- `src/lib/saude/avaliar-campanhas.ts` — sinais de saúde + health score (puros) + orquestradores async.
- `src/lib/saude/avaliar-campanhas.test.ts` — 19 testes vitest da lógica determinística.
- `src/lib/alertas/types.ts` — TipoAlerta estendido (cpa_alto/performance_caindo/ctr_caindo/sem_conversao).
- `src/actions/alertas.ts` — getAlertasCampanhas concatenado em getAlertas dentro de try/catch.
- `src/actions/clientes.ts` — updateMetasCliente (guard + validação número>=0 + revalidate).
- `src/components/ficha/metas-cliente.tsx` — form de metas (client, useTransition, toast).
- `src/components/trafego/health-score-cliente.tsx` — badge colorido de health score.
- `src/app/(app)/clientes/[id]/page.tsx` — seção de Metas na aba Contas de anúncio.
- `src/app/(app)/campanhas/page.tsx` — badge de health score no cliente selecionado.
- `src/app/(app)/alertas/page.tsx` e `src/components/dashboard/alertas-importantes.tsx` — Records exaustivos de TipoAlerta completados para os novos tipos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Completar Records exaustivos de TipoAlerta**
- **Found during:** Task 3 (GREEN) / Task 4
- **Issue:** Estender `TipoAlerta` com 4 tipos novos quebrou a compilação (`tsc`) em `src/app/(app)/alertas/page.tsx` (mapas TIPO_ICON/TIPO_LABEL) e `src/components/dashboard/alertas-importantes.tsx` (TIPO_HREF), que usam `Record<TipoAlerta, ...>` exaustivo.
- **Fix:** Adicionadas entradas para cpa_alto/performance_caindo/ctr_caindo/sem_conversao (ícones, labels e href `/campanhas`). O plano previa a extensão de TipoAlerta na Task 4; ela foi antecipada para a Task 3 (GREEN) porque o próprio módulo e seus testes precisam dos tipos para compilar.
- **Files modified:** src/lib/alertas/types.ts, src/app/(app)/alertas/page.tsx, src/components/dashboard/alertas-importantes.tsx
- **Commit:** `9e4d980`

**2. [Rule 1 - Tidy] Remover import não usado**
- **Found during:** Task 5 (verificação de lint)
- **Issue:** `Alerta` importado e não usado em `src/app/(app)/alertas/page.tsx` (aviso pré-existente, no arquivo já sendo editado).
- **Fix:** Removido `Alerta` do import de tipos.
- **Commit:** `81e0e70`

## Deferred / Out of Scope

Erros/avisos de lint PRÉ-EXISTENTES em arquivos NÃO tocados por este plano, registrados em `deferred-items.md`:
- `src/lib/meta/client.ts:160` — prefer-const (erro pré-existente).
- `src/lib/dashboard/data.ts` — 3 avisos no-unused-vars.
- Conhecidos permitidos pelo plano (não regressões): `ui/sidebar.tsx`, `hooks/use-mobile.ts`, `any` em `sync-meta-ads.ts`.

Nenhum erro/aviso de lint foi introduzido pelas mudanças deste plano.

## Verification

- `npx tsc --noEmit` — limpo.
- `npm test` (vitest) — 6 arquivos, 49 testes verdes (incluindo os 19 novos de avaliar-campanhas).
- `npm run build` (next build) — sucesso; /campanhas e /clientes/[id] são rotas dinâmicas (build passa sem a migration aplicada).
- `npm run lint` — 4 erros / 6 avisos, TODOS pré-existentes; zero novos.
- `drizzle/0005_young_goliath.sql` — somente ADD COLUMN em clientes; NÃO aplicada.

## Nota para o orquestrador

**APLICAR a migration `drizzle/0005_young_goliath.sql` antes de exercitar o runtime** (adiciona meta_cpa/meta_cpl/meta_roas em clientes). Até lá, salvar metas na ficha falhará em runtime, mas o build passa por serem rotas dinâmicas.

## Known Stubs

Nenhum. Todos os caminhos usam dados reais; o badge de health score só renderiza quando há dados de campanha e o form de metas persiste em colunas reais (após a migration ser aplicada).

## Self-Check: PASSED

Arquivos criados verificados no disco (6/6) e commits verificados no histórico (6/6).

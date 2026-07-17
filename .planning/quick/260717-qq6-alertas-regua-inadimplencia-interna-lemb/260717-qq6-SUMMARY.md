---
phase: quick-260717-qq6
plan: 01
subsystem: alertas / crm / cobranca
tags: [alertas, inadimplencia, asaas, contratos, crm, sla, kanban]
requires: [infra de alertas persistidos (260714-ccl), cobrancas (0032), fluxo de assinatura (0030)]
provides:
  - "Alertas fatura_vencendo/fatura_vencida sobre cobrancas (regua interna, dedup + resolucao automatica)"
  - "Alerta assinatura_pendente para contrato parado >3 dias em aguardando_assinatura"
  - "SLA de 1o contato de 24h: carimbo primeiro_contato_em + indicador no card + alerta sla_primeiro_contato"
affects: [/alertas, /crm (kanban), cron sync-meta (avaliarEPersistirAlertas)]
tech-stack:
  added: []
  patterns: [avaliadores puros + queries sequenciais, degradacao graciosa a coluna ausente, migration manual via script pontual]
key-files:
  created:
    - src/lib/alertas/avaliar-operacional.ts
    - src/lib/alertas/avaliar-operacional.test.ts
    - src/lib/crm/sla-contato.ts
    - src/lib/crm/sla-contato.test.ts
    - drizzle/0034_primeiro_contato.sql
    - scripts/aplicar-migration-0034.ts
  modified:
    - src/lib/alertas/types.ts
    - src/lib/alertas/calcular.ts
    - src/lib/db/schema.ts
    - src/actions/crm-atividades.ts
    - src/lib/crm/dados.ts
    - src/components/crm/card-oportunidade.tsx
    - src/app/(app)/alertas/alertas-client.tsx
    - src/components/dashboard/alertas-importantes.tsx
decisions:
  - "Chaves de dedup DISTINTAS fatura-vencendo-{id} / fatura-vencida-{id}: quando a fatura vence, um alerta resolve sozinho e o outro abre"
  - "Fatura pendente com vencimento no passado tambem vira fatura_vencida (status pode demorar a virar via webhook)"
  - "Carimbo do 1o contato: conclusao de atividade SEMPRE carimba; criacao so quando tipo e contato real (ligacao/whatsapp/email/reuniao) E inicio <= agora (tarefa futura nao conta)"
  - "0034 escrita a MAO no padrao 0030-0033: drizzle-kit generate esta quebrado por colisao pre-existente de snapshots (0023/0029 apontam ambos para o 0025)"
  - "SLA prevalece visualmente sobre o aviso 'Nao contatado' (+7d) — nunca dois avisos no mesmo card; heuristica +7d intocada"
metrics:
  duration: ~35min
  completed: 2026-07-17
---

# Quick 260717-qq6: Alertas operacionais internos (inadimplência, assinatura, SLA 1º contato) — Summary

Três grupos de alerta interno integrados ao ciclo de vida persistido existente (dedup/reabertura/resolução automática, zero mudança em persistir.ts): régua de inadimplência sobre `cobrancas`, lembrete de contrato parado em assinatura e SLA de 1º contato de 24h no CRM com carimbo `primeiro_contato_em` e indicador vermelho no card do kanban.

## O que foi feito

### Task 1 — Avaliadores puros + integração (ea5080a)
- `TipoAlerta` estendido: `fatura_vencendo`, `fatura_vencida`, `assinatura_pendente`, `sla_primeiro_contato`.
- `src/lib/crm/sla-contato.ts` puro: `SLA_PRIMEIRO_CONTATO_HORAS=24` (configurável editando a constante), `horasAguardando`, `estourouSla` (24h em ponto = estourado), `textoAguardando` (≥48h vira "há 2d").
- `src/lib/alertas/avaliar-operacional.ts` puro: `avaliarCobrancas` (≤3 dias atenção, ≤1 dia crítico, vencida crítico com dias de atraso e valor pt-BR), `avaliarAssinaturaPendente` (>3 dias, fallback `createdAt`), `avaliarSlaPrimeiroContato`.
- `calcular.ts`: 3 queries novas SEQUENCIAIS, cada bloco com try/catch próprio; a do SLA degrada graciosamente enquanto a 0034 não for aplicada.
- 25 testes novos.

### Task 2 — Migration 0034 + carimbo (81268e7)
- `drizzle/0034_primeiro_contato.sql`: APENAS `ALTER TABLE crm_oportunidades ADD COLUMN primeiro_contato_em timestamptz` (aditiva, **NÃO aplicada**).
- `scripts/aplicar-migration-0034.ts` no padrão dos 0029-0033 (DIRECT_URL, checagem em information_schema, transação).
- `carimbarPrimeiroContato` em crm-atividades.ts: UPDATE idempotente (`WHERE primeiro_contato_em IS NULL`) dentro de try/catch que só loga; chamado em `concluirAtividadeCrm` e em `criarAtividadeCrm` quando o tipo é contato real e o início ≤ agora.

### Task 3 — Indicador no card (fbce9c7)
- `dados.ts`: query (15) separada/sequencial em try/catch → `Set` de abertas sem 1º contato; `OportunidadeCard` ganha `aguardando1oContato` + `horasAguardando1oContato`; heurística `semContato` +7d intocada.
- Card: linha "aguardando 1º contato há Xh" discreta; ao estourar 24h vira `text-red-600 dark:text-red-400` + `ring-1 ring-red-500/40`; prevalece sobre "Nao contatado".

## Verificação
- `npx vitest run`: 2929 testes verdes (25 novos)
- `npx tsc --noEmit`: sem erros
- `npm run build`: verde
- 0034 NÃO aplicada ao banco; nenhuma query usa Promise.all

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] drizzle-kit generate quebrado — 0034 escrita à mão**
- **Found during:** Task 2
- **Issue:** `npx drizzle-kit generate` falha com colisão pré-existente de snapshots (0023 e 0029 apontam ambos para o snapshot da 0025); o journal também já não registra as 0030-0033.
- **Fix:** SQL da 0034 escrito à mão no mesmo padrão das 0030-0033 (fora do journal), conteúdo idêntico ao que o kit geraria (um único ALTER TABLE ADD COLUMN).
- **Files:** drizzle/0034_primeiro_contato.sql
- **Commit:** 81268e7

**2. [Rule 3 - Bloqueio] Mapas de UI de alertas exigem os tipos novos**
- **Found during:** Task 1 (tsc)
- **Issue:** `Record<TipoAlerta, ...>` em alertas-client.tsx e alertas-importantes.tsx quebrou ao estender a união.
- **Fix:** Ícone/label/href adicionados para os 4 tipos (Fatura→/financeiro, Assinatura→/contratos, 1º contato→/crm).
- **Commit:** ea5080a

## Pendências para o usuário
- **Aplicar a migration 0034** quando quiser ativar o SLA de 1º contato: `npx tsx --env-file=.env.local scripts/aplicar-migration-0034.ts`. Até lá, tudo funciona sem o indicador/alerta de SLA (degradação graciosa); os alertas de fatura e assinatura já funcionam imediatamente.
- Leads antigos não têm carimbo retroativo: abertos sem 1º contato aparecerão como aguardando desde a criação (comportamento esperado — força a limpeza da base).

## Known Stubs
Nenhum — sem placeholders novos.

## Self-Check: PASSED
- Arquivos criados conferidos em disco (avaliar-operacional.ts/.test.ts, sla-contato.ts/.test.ts, 0034.sql, script) ✓
- Commits ea5080a, 81268e7, fbce9c7 existem no log ✓

---
phase: quick-260721-ogt
plan: 01
subsystem: financeiro
tags: [recorrencia, rollover, previsao, materializacao-preguicosa, migration-0041]
requires:
  - "src/lib/cobrancas/regras.ts (padrão de competências pendentes idempotentes)"
  - "src/lib/tarefas/dados.ts (padrão de materialização preguiçosa idempotente)"
  - "src/lib/db/index.ts (pool max=5/max_pipeline=1 — queries sequenciais)"
provides:
  - "src/lib/financeiro/recorrencia.ts (aritmética PURA de competência recorrente)"
  - "src/lib/financeiro/rollover.ts (rolarRecorrentes — materialização idempotente)"
  - "previsões (por mês + caixa 30d) que PROJETAM a série (fonte única do futuro)"
  - "migration 0041 (índice único parcial transacao_pai_id,data) — GERADA, não aplicada"
  - "scripts/limpar-recorrentes-futuras.ts — GERADO, não aplicado"
affects:
  - "src/actions/financeiro.ts (createTransacao não pré-gera; previsões projetam)"
  - "src/app/api/cron/sync-meta/route.ts (carona do rollover)"
  - "src/app/(app)/financeiro/page.tsx (rollover preguiçoso)"
tech-stack:
  added: []
  patterns:
    - "Recorrência que ROLA mês a mês (só a competência atual materializada; a próxima nasce pelo calendário) — igual às cobranças, em vez de pré-gerar o futuro inteiro"
    - "Blindagem contra dupla contagem à prova de ordem: a query real EXCLUI recorrentes futuros; a projeção é a fonte única do futuro"
key-files:
  created:
    - "src/lib/financeiro/recorrencia.ts"
    - "src/lib/financeiro/recorrencia.test.ts"
    - "src/lib/financeiro/rollover.ts"
    - "drizzle/0041_transacoes_pai_data_unique.sql"
    - "scripts/aplicar-migration-0041.ts"
    - "scripts/limpar-recorrentes-futuras.ts"
  modified:
    - "src/actions/financeiro.ts"
    - "src/app/api/cron/sync-meta/route.ts"
    - "src/app/(app)/financeiro/page.tsx"
    - "src/lib/db/schema.ts"
decisions:
  - "Trigger AUTOMÁTICO na virada (não on-payment); escopo = TODAS as recorrentes (despesa E receita); limpeza remove só as futuras (mantém âncora/mês atual/passado)"
  - "Blindagem contra dupla contagem: query real exclui filho recorrente de competência > mês atual (à prova de ordem — não depende de a limpeza ter rodado)"
  - "Séries SEM contrato ganham horizonte de projeção ROLANTE (hoje+12 meses); nenhum mês já exibido muda de valor"
metrics:
  duration: 54min
  tasks: 3
  files: 10
  tests: "649 verdes (630 baseline + 19 novos), 0 regressão"
  completed: 2026-07-21
---

# Quick 260721-ogt: Recorrência do Financeiro (rolar mês a mês) Summary

Transações recorrentes do /financeiro (despesa E receita) passam a ROLAR mês a mês — só a competência atual é materializada e a próxima nasce automaticamente na virada, como as cobranças dos clientes — em vez de pré-gerar todo o futuro (12 meses / ~27 semanas); as previsões passam a PROJETAR a série (número não muda), com blindagem contra dupla contagem à prova de ordem.

## O que foi feito

### Task 1 — Módulo puro de competência recorrente (TDD)
`src/lib/financeiro/recorrencia.ts` — espelho financeiro de `cobrancas/regras.ts`, zero import de db/auth/react, aritmética 100% UTC (meio-dia, sem date-fns):
- `proximaDataRecorrente(data, recorrencia)` — semanal +7d; mensal/trimestral +1/+3 meses grampeando o dia ao último dia do mês alvo (31/jan→28/fev; bissexto→29/fev; 31→30). Reproduz exatamente o `addMonths` que gerou as séries hoje no banco (server UTC), para o `jaGeradas` casar com os filhos existentes.
- `ocorrenciasRecorrentesNoIntervalo(dataBase, recorrencia, dataFinal, de, ate)` — enumera as datas DEPOIS da base, dentro de [de, ate], respeitando o teto `dataFinal`. Usada pela materialização E pela projeção.
- `datasPendentesRecorrentes({dataBase, recorrencia, dataFinal, jaGeradas, hoje})` — teto = hoje (nunca pré-gera futuro; contrato vencido encerra em dataFinal), idempotente por `jaGeradas`.
- 19 testes verdes (semanal/mensal/trimestral, clamp 31→28/29/30, idempotência, cap por dataFinal, teto=hoje, avulsa→[]).

### Task 2 — Rollover idempotente + parar de pré-gerar + migration 0041
- `src/lib/financeiro/rollover.ts` — `rolarRecorrentes()`: módulo server comum (sem 'use server'), queries SEQUENCIAIS, espelho de `gerarCobrancasMensais`. Seleciona âncoras (pai NULL, recorrência ≠ avulsa), monta `jaGeradas` (filhos + a própria âncora), calcula `dataFinal` por contrato vigente (1 query agregada), materializa as competências pendentes em UM insert `onConflictDoNothing`. try/catch → `{ criadas: 0 }` (degradação graciosa).
- Carona no cron `sync-meta` (try/catch próprio, resumo no JSON) + preguiçoso no `/financeiro` (1× SEQUENCIAL, ANTES do `withRetry`, fora de qualquer Promise.all — respeita o pool max=5/max_pipeline=1 e o freeze do debug 260721).
- `createTransacao` agora só insere a âncora; `gerarParcelasRecorrentes` REMOVIDA (import órfão `addWeeks` retirado; `addMonths` mantido — usado em getPrevisaoCaixa).
- Migration 0041: índice único parcial `ux_transacoes_pai_data (transacao_pai_id, data) WHERE transacao_pai_id IS NOT NULL` — no schema Drizzle + `drizzle/0041_*.sql` + `scripts/aplicar-migration-0041.ts`. GERADA, NÃO aplicada.

### Task 3 — Previsões projetadas + script de limpeza
- `getPrevisaoReceitaPorMes` e `getPrevisaoCaixa`: a query REAL agora EXCLUI os filhos recorrentes de competência FUTURA (`to_char(data,'YYYY-MM') > mês atual AND transacao_pai_id IS NOT NULL AND recorrencia <> 'avulsa'`) e ACRESCENTA a projeção da série (começa no 1º dia do mês seguinte → não sobrepõe o mês atual). Horizonte = dataVencimento do contrato vigente ou hoje+12 meses (igual ao teto antigo). Ambas sequenciais, com degradação graciosa (projeção falha → cai só nas reais). Base de data unificada em `hojeBrasilia()`.
- `scripts/limpar-recorrentes-futuras.ts` — dry-run por padrão (lista por série id/descrição/data/tipo/valor/status), `--apply` remove SÓ futuras (`competência > atual`, status pendente/vencido), NUNCA âncoras/mês atual/passado/pagas, DELETE em `sql.begin()`. Idempotente. GERADO, NÃO aplicado.

## Blindagem contra dupla contagem (ponto financeiro mais importante)

A projeção NÃO depende de a limpeza ter rodado. A query real exclui o futuro recorrente; a projeção é a fonte ÚNICA dos meses futuros recorrentes. Assim, sobrevivendo ou não uma linha futura pré-gerada (deploy antes do `--apply`, ou `--apply` esquecido), o mês futuro NUNCA é contado duas vezes. O mês atual e o passado continuam 100% das linhas reais; avulsas futuras continuam reais.

## Deviations from Plan

None — plano executado exatamente como escrito. (Único ajuste técnico: tipagem `LinhaAlvo = (typeof alvo)[number]` no script de limpeza para o `RowList` do postgres.js — Rule 3, correção de tipo bloqueante, sem mudança de comportamento.)

## ⚠️ Pendências do ORQUESTRADOR (NÃO aplicadas pelo executor — convenção da casa)

O executor GEROU código + scripts + testes verdes, mas NÃO tocou no banco. Passos manuais do orquestrador, **NESTA ORDEM**:

1. Revisar o dry-run: `npx tsx --env-file=.env.local scripts/limpar-recorrentes-futuras.ts`
2. Aplicar a LIMPEZA: `npx tsx --env-file=.env.local scripts/limpar-recorrentes-futuras.ts --apply`
3. Aplicar a MIGRATION 0041: `npx tsx --env-file=.env.local scripts/aplicar-migration-0041.ts`

**A limpeza roda ANTES da migration 0041** — ambas são do orquestrador. Se sobrar duplicata `(transacao_pai_id, data)`, o índice único falha ao ser criado; a limpeza remove as futuras e reduz esse risco. Se a criação do índice falhar mesmo assim, o orquestrador investiga duplicatas remanescentes.

NÃO pushar/deployar automaticamente — testar local primeiro.

## Verification

- `npx tsc --noEmit -p tsconfig.json` → exit 0.
- `npx vitest run` → 649 pass / 0 fail (630 baseline + 19 novos; zero regressão).
- `createTransacao` não referencia mais `gerarParcelasRecorrentes` (só um comentário); a função sumiu.
- `rolarRecorrentes` chamado em `sync-meta/route.ts` e em `financeiro/page.tsx`.
- Migration 0041 e script de limpeza EXISTEM e NÃO foram aplicados.

## Commits

- `a1c3d4e` — feat: módulo puro de competência recorrente do financeiro (TDD)
- `5589b59` — feat: rollover idempotente das recorrentes + para de pré-gerar futuro
- `1380c7b` — feat: previsões projetam a série + script de limpeza das futuras

## Self-Check: PASSED

Todos os 7 arquivos criados existem em disco; os 3 commits (a1c3d4e, 5589b59, 1380c7b) existem no histórico.

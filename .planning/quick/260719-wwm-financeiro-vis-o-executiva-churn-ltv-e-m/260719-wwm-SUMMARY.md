---
phase: quick-260719-wwm
plan: 01
subsystem: financeiro
tags: [churn, ltv, visao-executiva, dialog, tdd]
requires: []
provides:
  - "src/lib/financeiro/executiva.ts — taxaDeChurn, churnAcumulado, ltvMedio, rankingMotivos (módulo puro)"
  - "clientes.data_encerramento (migration 0038 GERADA, NÃO aplicada)"
  - "getVisaoExecutiva() em src/actions/financeiro.ts"
  - "TransacaoForm em Dialog centralizado"
affects: [financeiro, painel, clientes]
tech-stack:
  added: []
  patterns: ["módulo puro financeiro sob TDD", "query agregada sequencial pós-Promise.all", "degradação graciosa a coluna pendente (retry sem a coluna)"]
key-files:
  created:
    - src/lib/financeiro/executiva.ts
    - src/lib/financeiro/executiva.test.ts
    - scripts/aplicar-migration-0038.ts
  modified:
    - src/lib/db/schema.ts
    - src/actions/clientes.ts
    - src/actions/financeiro.ts
    - src/app/(app)/financeiro/page.tsx
    - src/app/(app)/financeiro/visao-analitica.tsx
    - src/app/(app)/painel/page.tsx
    - src/app/(app)/financeiro/transacao-form.tsx
decisions:
  - "LTV: ativos ENTRAM no cálculo (vida até hoje); mês comercial de 30 dias; vida mínima 1 mês — premissa exportada em PREMISSA_LTV"
  - "Churn conta SÓ por data_encerramento (encerrado sem data fica fora do churn e da base)"
  - "Escrita degradada: create/update de cliente retenta SEM data_encerramento se a coluna não existir (migration 0038 pendente)"
metrics:
  duration: "7min"
  completed: "2026-07-20"
---

# Quick 260719-wwm: Financeiro — Visão Executiva (churn, LTV, motivos) + modal de transação — Summary

Churn mensal/acumulado 3-6m, LTV médio (vida × ticket, premissa documentada) e ranking de motivos de encerramento calculados em módulo puro sob TDD, exibidos na Visão Analítica e como chips no Painel; formulário de transação modernizado para Dialog centralizado no padrão do CRM.

## Tasks

| Task | Nome | Commits |
| ---- | ---- | ------- |
| 1 | Migration 0038 + módulo puro executiva (TDD) | 9d83c0a (RED), fe8f585 (GREEN), 8fc496a (schema/action/script) |
| 2 | getVisaoExecutiva + cards/chips na UI | 79f57f9 |
| 3 | TransacaoForm vira Dialog centralizado | 0b3c172 |

## O que foi feito

- **executiva.ts (puro, 19 testes):** `taxaDeChurn` (encerrados no mês / ativos no início; base 0 → null), `churnAcumulado` (janela 3/6 meses), `ltvMedio` (vida média × ticket médio; null sem dado — nunca inventa número), `rankingMotivos` (trim + case-insensitive, desc).
- **Migration 0038:** `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_encerramento date` — script idempotente no padrão 0036. **NÃO aplicada** — rodar `npx tsx --env-file=.env.local scripts/aplicar-migration-0038.ts`.
- **Encerramento grava a data:** create/update em `src/actions/clientes.ts` preenchem `dataEncerramento = hojeBrasilia()` ao encerrar, preservando a data original se o cliente já estava encerrado; reativar limpa. Retry sem a coluna se a migration estiver pendente (salvar cliente nunca quebra).
- **getVisaoExecutiva:** 2 queries agregadas SEQUENCIAIS (clientes + min/último contrato por cliente), cálculo 100% no módulo puro; retorna null com migration pendente.
- **UI:** seção "Visão Executiva" no topo da aba Visão Analítica (card Churn do mês com 3m/6m no helper, card LTV com premissa no helper, card Motivos de encerramento com estados vazios honestos e aviso da migration 0038); chips "Churn do mês" e "LTV médio" no Painel (somem se dados null). Chamadas sequenciais após os Promise.all existentes (regra do pool).
- **Transação em Dialog:** mesmo RHF + zodResolver + toasts + router.refresh(); edição nasce aberta; fechar bloqueado durante isPending; copy revisada em pt-BR com acentos ("Adicionar transação", "Descrição", "Recorrência", "Não informada", "Salário" etc.). Schema e actions intocados.

## Deviations from Plan

None - plan executed exactly as written. (Nota operacional: o worktree do agente estava 5 dias atrás do master e foi fast-forwarded para ff4391f antes de executar.)

## Known Stubs

Nenhum — estados vazios são honestos ("Nenhum encerramento registrado", "—"), nunca números inventados.

## Verificação

- `npx vitest run src/lib/financeiro`: 61 testes verdes (19 novos + regressão calculos/a-receber).
- `npx tsc --noEmit`: sem erros. `npm run build`: compilado com sucesso (erros de query no build = ausência de banco na geração estática, padrão pré-existente).
- Pendente do usuário: aplicar a migration 0038 e conferir visualmente Financeiro → Visão Analítica, Painel e o modal de transação.

## Self-Check: PASSED

- FOUND: src/lib/financeiro/executiva.ts, executiva.test.ts, scripts/aplicar-migration-0038.ts
- FOUND: commits 9d83c0a, fe8f585, 8fc496a, 79f57f9, 0b3c172

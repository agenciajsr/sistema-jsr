---
phase: quick-260716-sr5
plan: 01
subsystem: cobrancas
tags: [asaas, financeiro, contratos, crm, migration]
requires: [quick-260716-qzu]
provides:
  - clientes.modo_cobranca (migration 0033 GERADA, NAO aplicada)
  - deveUsarAsaas (regra pura testada)
  - retentarAsaasNaFatura (backfill do link na mesma linha)
  - setModoCobranca / cadastrarClienteNoAsaas / gerarCobrancaDoMesPorCliente
  - getVisaoCobrancas + aba Cobranças em /financeiro
affects: [/financeiro, /contratos, /clientes/[id], dialog de conversão do CRM]
tech-stack:
  added: []
  patterns: [queries agregadas sequenciais + merge em memória, regra pura testada em lib]
key-files:
  created:
    - drizzle/0033_modo_cobranca.sql
    - scripts/aplicar-migration-0033.ts
    - src/app/(app)/financeiro/cobrancas-tab.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/cobrancas/regras.ts
    - src/lib/cobrancas/regras.test.ts
    - src/lib/cobrancas/gerar.ts
    - src/lib/cobrancas/dados.ts
    - src/actions/cobrancas.ts
    - src/actions/crm.ts
    - src/components/crm/converter-cliente-dialog.tsx
    - src/components/ficha/faturas-cliente.tsx
    - src/components/ficha/cobranca-cliente.tsx
    - src/app/(app)/clientes/[id]/page.tsx
    - src/app/(app)/financeiro/page.tsx
    - src/app/(app)/contratos/tabela-contratos.tsx
decisions:
  - "deveUsarAsaas retorna true SOMENTE para 'automatico_asaas' — nulo/legado/desconhecido = manual (nunca cobrar taxa por engano)"
  - "Default do modo = manual_pix (na coluna, no Zod e no dialog) — cliente novo nunca gera custo no Asaas sem escolha explícita"
  - "usaAsaas depreciada mas ESPELHADA (setModoCobranca e conversão gravam as duas) para não dessincronizar telas antigas"
  - "gerarOuReaproveitarCobranca: fatura do mês já existente NUNCA duplica — reaproveita link ou retenta o Asaas na MESMA linha"
metrics:
  duration: ~13min
  completed: 2026-07-16
---

# Quick 260716-sr5: Cobrança por cliente (modo Asaas x manual PIX) Summary

Modo de cobrança POR CLIENTE (`automatico_asaas` | `manual_pix`) na coluna nova `clientes.modo_cobranca` (0033): cliente manual nunca toca o Asaas mas a fatura local mensal continua nascendo; escolha na conversão do lead ganho + edição na aba Faturas; aba "Cobranças" consolidada em /financeiro; botão de /contratos deixou de duplicar fatura e de falhar em silêncio.

## O que foi feito

### Task 1 — Fundação (TDD)
- **Migration 0033** (`drizzle/0033_modo_cobranca.sql`, ADITIVA, **NÃO aplicada**): coluna `modo_cobranca text NOT NULL DEFAULT 'manual_pix'` + backfill (`usa_asaas = true` OU `asaas_customer_id IS NOT NULL` → automático) + COMMENT depreciando `usa_asaas`.
- **Script** `scripts/aplicar-migration-0033.ts` no padrão exato da 0032 (DIRECT_URL, transação, pré-checagem da 0032, confirmação pós). **NÃO executado** — o orquestrador aplica.
- **`deveUsarAsaas`** em regras.ts sob TDD (RED `ab6838b` → GREEN): 3 casos novos, só `automatico_asaas` retorna true.
- **`gerarCobrancaDoMes`** pula o bloco Asaas quando `!asaasDisponivel() || !deveUsarAsaas(cliente)` — fatura local nasce sempre.
- **`retentarAsaasNaFatura`**: backfill do payment/link na MESMA linha pendente/vencida sem asaasPaymentId (só cliente automático).
- **Fix do bug do botão manual**: `gerarOuReaproveitarCobranca` checa a fatura do mês ANTES de inserir (criado_via manual não bate no índice único parcial) — reaproveita link, retenta o Asaas na existente, ou erro pt-BR claro para manual_pix. Fatura paga não regenera.
- **Actions novas**: `setModoCobranca` (Zod enum, espelha usaAsaas), `cadastrarClienteNoAsaas`, `gerarCobrancaDoMesPorCliente` (resolve contrato vigente via `contratoElegivel`).

### Task 2 — Conversão + ficha
- Dialog de conversão do lead ganho: seletor "Modo de cobrança" (2 botões pt-BR, default manual) → persistido no insert do cliente via `converterOportunidadeEmCliente` (schema Zod estendido).
- Aba Faturas: badge "Asaas" (azul) / "Manual PIX" (âmbar, com `dark:`) + select chamando `setModoCobranca` com toast.
- `CobrancaCliente` (aba antiga): switch usa_asaas REMOVIDO — vira badge somente leitura apontando para a aba Faturas; nenhuma UI chama mais `setUsaAsaas`.

### Task 3 — Aba Cobranças + /contratos
- `getVisaoCobrancas()`: 3 queries agregadas SEQUENCIAIS (clientes ativos/aguardando/em_aviso, contratos assinados, faturas da competência corrente) + merge em memória.
- `cobrancas-tab.tsx`: tabela Cliente | Modo | Fatura do mês | Valor | Vencimento | Ações ("Cadastrar no Asaas", "Gerar cobrança do mês", "Quitar (PIX manual)", "Ver fatura"); banner quando Asaas não configurado; todo desfecho vira toast.
- `/financeiro`: fetch sequencial após o lote 2 + `TabsTrigger "Cobranças (n)"` (n = pendente/vencida/sem fatura) após "A Receber".
- `/contratos`: handler cobre aviso com link (toast.info incluindo o link), aviso sem link (warning), erro (error) e sucesso com link — nada silencioso.

## Verificação
- `npx vitest run`: **418 testes verdes** (3 novos de deveUsarAsaas).
- `npx tsc --noEmit`: sem erros. `npm run build`: compila (ECONNREFUSED na geração estática sem banco = esperado).
- Grep de sanidade: todas as chamadas `criarCliente`/`criarCobranca` do Asaas vivem em gerar.ts, atrás de `deveUsarAsaas`/ação explícita.

## Deviations from Plan

None - plan executed exactly as written.

## Pendências para o orquestrador
- **Aplicar a migration 0033**: `npx tsx --env-file=.env.local scripts/aplicar-migration-0033.ts` (exige 0032 aplicada antes). Até lá, qualquer query que selecione `modo_cobranca` falha em produção — deploy só após aplicar.

## Commits
- `ab6838b` test: teste falhando para deveUsarAsaas (RED)
- `66294ac` feat: migration 0033 + deveUsarAsaas + geração respeita o modo + fix duplicação (GREEN)
- `8480deb` feat: modo na conversão do lead + edição na aba Faturas
- `9d7abb1` feat: aba Cobranças em /financeiro + toasts confiáveis em /contratos

## Self-Check: PASSED

Arquivos criados e commits ab6838b/66294ac/8480deb/9d7abb1 confirmados no repositório.

---
phase: quick-260716-qzu
plan: 01
subsystem: cobranca
tags: [asaas, cobrancas, faturas, webhook, cron, drizzle]
requires: [quick-260716-i87, quick-260716-ky2]
provides:
  - Tabela cobrancas (fonte da verdade) + clientes.asaas_customer_id (migration 0032, NAO aplicada)
  - Cliente REST Asaas (sandbox/producao, Zod na borda, degradacao sem env)
  - Regras puras de cobranca sob TDD (13 testes)
  - Gatilho de 1a cobranca na assinatura + geracao mensal por carona no cron sync-meta
  - Webhook /api/webhooks/asaas (paga/vencida/cancelada) com token timingSafeEqual
  - Actions gerarCobrancaManual e confirmarRecebimentoManual (receivedInCash)
  - Aba Faturas na ficha do cliente + botao Cobranca em /contratos
affects: [fase-5-parte-2, financeiro]
tech-stack:
  added: []
  patterns: [modulo-puro-tdd, fonte-da-verdade-local, degradacao-graciosa-sem-env, carona-no-cron]
key-files:
  created:
    - drizzle/0032_cobrancas_asaas.sql
    - scripts/aplicar-migration-0032.ts
    - src/lib/asaas/client.ts
    - src/lib/cobrancas/regras.ts
    - src/lib/cobrancas/regras.test.ts
    - src/lib/cobrancas/gerar.ts
    - src/lib/cobrancas/dados.ts
    - src/app/api/webhooks/asaas/route.ts
    - src/actions/cobrancas.ts
    - src/components/ficha/faturas-cliente.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/contratos/assinatura.ts
    - src/app/api/cron/sync-meta/route.ts
    - src/app/(app)/clientes/[id]/page.tsx
    - src/app/(app)/contratos/tabela-contratos.tsx
decisions:
  - "Tabela cobrancas e a fonte da verdade (D-04); falha do Asaas nunca desfaz a linha local nem bloqueia a ativacao"
  - "Cobranca AVULSA mes a mes (D-01, nunca /v3/subscriptions), billingType UNDEFINED (D-02)"
  - "Funcao de leitura chama getFaturasDoCliente (nao getCobrancasDoCliente) para nao colidir com @/actions/financeiro que le transacoes"
  - "Actions em src/actions/cobrancas.ts (convencao do projeto), nao src/app/actions como o plano listava"
metrics:
  duration: ~20min
  completed: 2026-07-16
---

# Quick 260716-qzu: Fase 5 Parte 1 — Cobrança via Asaas — Summary

**One-liner:** Ciclo completo de faturas com o Asaas como meio de quitação: tabela `cobrancas` local como fonte da verdade, 1ª cobrança no gatilho de assinatura, geração mensal por carona no cron sync-meta, webhook de status, quitação PIX manual (com receivedInCash) e aba Faturas pt-BR na ficha do cliente.

## O que foi feito

### Task 1 — Fundação (TDD)
- **Migration 0032** (`drizzle/0032_cobrancas_asaas.sql`, ADITIVA, **NÃO aplicada**): `clientes.asaas_customer_id` + tabela `cobrancas` + índice único parcial `cobrancas_contrato_competencia_uniq` (contrato_id, competencia) WHERE criado_via='automatico'.
- **`scripts/aplicar-migration-0032.ts`** no padrão exato da 0031 (DIRECT_URL, transação, pré-checagem da 0031, confirmação pós-aplicação).
- **`src/lib/asaas/client.ts`**: base sandbox/produção por ASAAS_ENV, header `access_token`, Zod `.passthrough()` em toda resposta, erro pt-BR com `errors[0].description`, timeout 15s, `asaasDisponivel()` para degradação sem env.
- **`src/lib/cobrancas/regras.ts`** (puro, zero db/react): `competenciaDe`, `dataVencimento` (grampeio 31→28/29, mínimo = hoje), `contratoElegivel`, `competenciasPendentes` (recupera meses perdidos, respeita assinatura/vigência). 13 testes RED→GREEN.

### Task 2 — Fluxos
- **`gerar.ts`**: `garantirClienteAsaas` (idempotente, documento do cliente com fallback em dadosContratante, erro pt-BR sem CPF/CNPJ), `gerarCobrancaDoMes` (insert local com onConflictDoNothing → Asaas em try/catch, warn e segue), `gerarPrimeiraCobranca`, `gerarCobrancasMensais` (queries sequenciais).
- **`confirmarAssinatura`** dispara a 1ª cobrança em try/catch — nunca bloqueia a ativação.
- **Cron sync-meta** ganhou etapa `gerarCobrancasMensais()` (try/catch próprio, resumo `{cobrancas}` na resposta) + marca 'vencida' pendentes passadas sem asaasPaymentId. Nenhum cron novo.
- **Webhook `/api/webhooks/asaas`**: token `asaas-access-token` vs ASAAS_WEBHOOK_TOKEN (timingSafeEqual; env ausente = warn e segue; divergente = 401), Zod no payload, eventos RECEIVED/CONFIRMED→paga, OVERDUE→vencida, DELETED/REFUNDED→cancelada, sempre 200 rápido; 1ª fatura paga ativa o cliente.
- **`src/actions/cobrancas.ts`**: `gerarCobrancaManual` (só contrato assinado) e `confirmarRecebimentoManual` (quita local + receivedInCash em try/catch, ativa cliente), com checagem de sessão e revalidatePath.

### Task 3 — UI
- **Aba "💰 Faturas"** na ficha do cliente: competência, valor R$, vencimento dd/mm, badge de status com variantes dark:, origem, quitação, link "Ver fatura", botão "Confirmar recebimento (PIX manual)" com confirmação, estado vazio e banner quando ASAAS_API_KEY ausente.
- **Coluna "Cobrança"** em /contratos (ícone Banknote, habilitada só para statusFluxo 'assinado') com toasts de sucesso/aviso/erro.

## Deviations from Plan

### Ajustes de convenção (Rule 2/3 — sem impacto funcional)
**1. Actions em `src/actions/cobrancas.ts` (plano listava `src/app/actions/`)** — convenção estabelecida do projeto é `src/actions/*`; seguida conforme CLAUDE.md ("follow existing patterns").
**2. Função de leitura renomeada para `getFaturasDoCliente`** — o nome `getCobrancasDoCliente` do plano já existe em `@/actions/financeiro` (lê `transacoes`) e é importado pela mesma página; renomeada para evitar colisão/ambiguidade.
**3. `npm install` no worktree** — dependências não estavam instaladas no worktree (tsc falhava em `@react-pdf/renderer`); instalação local, sem mudança em package.json.

## Verificação
- `npx vitest run`: **415 testes verdes** (13 novos das regras + suíte intacta).
- `npx tsc --noEmit`: sem erros. `npm run build`: compilado com sucesso (erros ECONNREFUSED nos logs são só a geração estática sem banco neste ambiente — fallbacks existentes).
- Migration 0032 ADITIVA e **NÃO aplicada**; script segue o padrão 0031. Nenhum uso de /v3/subscriptions; billingType UNDEFINED; nenhum cron novo em vercel.json.
- Sem ASAAS_API_KEY nada quebra: assinatura ativa o cliente, fatura local nasce sem link, UI mostra banner.

## Known Stubs
Nenhum — sem dados falsos; sem env do Asaas a UI declara explicitamente o modo interno.

## Pendências para o orquestrador/usuário
1. **Aplicar a migration 0032**: `npx tsx --env-file=.env.local scripts/aplicar-migration-0032.ts` (após 0029–0031).
2. **Envs** (sandbox primeiro): `ASAAS_API_KEY`, `ASAAS_ENV=sandbox`, `ASAAS_WEBHOOK_TOKEN` (.env.local e Vercel).
3. **Painel Asaas → Integrações → Webhooks**: criar webhook para `/api/webhooks/asaas` com authToken = ASAAS_WEBHOOK_TOKEN.

## Commits
- 9dbbb85 test: testes falhando das regras puras (RED)
- 1e12391 feat: fundação — migration 0032, schema, client Asaas, regras puras (GREEN)
- dfe9b29 feat: fluxos — assinatura, cron, webhook, actions
- 3ef4ba7 feat: UI — aba Faturas + botão Cobrança

## Self-Check: PASSED
Todos os arquivos criados existem e os 4 commits (9dbbb85, 1e12391, dfe9b29, 3ef4ba7) estão no histórico.

# Quick Task 260716-wgs — SUMMARY

**Concluída:** 2026-07-17

## O que mudou

- **Novo** `src/lib/cobrancas/receita.ts`: `registrarReceitaDaCobranca` (insere transação `receita/mensalidade/pago` com marcador `[cobranca:<id>]` em notas — idempotente, sem migration) e `removerReceitaDaCobranca` (estorno tira do financeiro; só apaga transação com o marcador). Puras `marcadorCobranca`/`montarTransacaoDaCobranca` testadas (3 testes, `receita.test.ts`).
- `src/app/api/webhooks/asaas/route.ts`: PAYMENT_RECEIVED/CONFIRMED → registra receita (forma 'asaas', formaPagamento null); PAYMENT_REFUNDED/DELETED → remove receita vinculada. Tudo em try/catch — nunca quebra o webhook.
- `src/actions/cobrancas.ts` (`confirmarRecebimentoManual`): registra receita (forma 'pix_manual' → formaPagamento 'pix') + revalidatePath('/financeiro').

## Backfill executado

- Fatura paga do teste E2E (R$ 1.500, competência 2026-07, cliente Jacson Ribeiro Sandbox) lançada retroativamente em `transacoes` com o mesmo marcador — já aparece em receita/lucro do /financeiro.

## Verificação

- Vitest: 3/3 do módulo novo (421 no total do projeto seguem valendo).
- Typecheck: único erro é pré-existente (`@react-pdf/renderer` ausente localmente).
- E2E pendente natural: próximo pagamento de fatura no sandbox deve criar a transação sozinho.

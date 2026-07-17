# Quick Task 260716-ux6 — SUMMARY

**Concluída:** 2026-07-17 (commit `e929a65`)

## O que mudou

- `src/lib/asaas/client.ts`: `criarCobranca` agora envia `billingType: 'BOLETO'` (antes `'UNDEFINED'`). Na página de fatura do Asaas isso exibe **boleto + Pix** e remove cartão de crédito/débito. Comentário D-02 atualizado.

## Contexto da sessão

- Corrigido também (fora do repo, no painel Vercel): `ASAAS_ENV=sandbox` e `ASAAS_API_KEY` recolada — causa do 401 "chave inválida" era env errada em produção.
- Typecheck: único erro é pré-existente e não relacionado (`@react-pdf/renderer` ausente no node_modules local).

## Verificação pendente (manual)

- Gerar nova cobrança no sandbox e conferir que a fatura mostra apenas Pix/boleto. Faturas antigas já criadas no Asaas mantêm o billingType antigo.

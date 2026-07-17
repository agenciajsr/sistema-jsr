# Quick Task 260716-wgs: Fatura paga vira receita no financeiro

**Objetivo:** O usuário pagou uma fatura Asaas no teste E2E e os R$ 1.500 não apareceram em receita/lucro do /financeiro — os KPIs leem só a tabela `transacoes`. Ligar cobranças→financeiro.

## Tarefas

1. **Módulo `src/lib/cobrancas/receita.ts`** (helpers puros + acesso a DB):
   - marcador `[cobranca:<id>]` guardado em `notas` (dedup sem migration)
   - `registrarReceitaDaCobranca(cobranca, { forma, dataPagamento })`: se já existe transação com o marcador → não duplica; senão insere `tipo=receita, categoria=mensalidade, status=pago, recorrencia=avulsa, clienteId, valor, data=dataPagamento, formaPagamento` ('pix' no PIX manual; null no Asaas — não sabemos se foi pix/boleto)
   - `removerReceitaDaCobranca(cobrancaId)`: apaga a transação com o marcador (usada no estorno/cancelamento de fatura que já estava paga)
   - funções puras (`marcadorCobranca`, `montarTransacaoDaCobranca`) testadas em `receita.test.ts`
2. **Chamadas:**
   - `src/app/api/webhooks/asaas/route.ts`: após marcar `paga` → registrar (forma 'asaas'); nos eventos REFUNDED/DELETED quando a cobrança estava paga → remover receita vinculada. Sempre em try/catch — nunca quebra o webhook.
   - `src/actions/cobrancas.ts` (`confirmarRecebimentoManual`): após quitar → registrar (forma 'pix_manual') + revalidatePath('/financeiro').
3. **Verificação:** testes vitest do módulo puro; teste manual: pagar fatura no sandbox → receita aparece no /financeiro.

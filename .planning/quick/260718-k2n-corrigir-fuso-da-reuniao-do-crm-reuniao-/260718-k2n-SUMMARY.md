# SUMMARY — quick-260718-k2n: corrigir fuso da reunião do CRM + tarefa espelho

## O que foi feito

1. **Fix do fuso** (`src/lib/crm/reuniao.ts` + `src/actions/crm-atividades.ts`)
   - Novo helper puro `montarInstanteBrasilia(data, hora)` com offset `-03:00` explícito.
   - `criarReuniaoCrm` agora usa o helper para `dataInicio`/`dataFim` — antes usava `new Date` sem offset, que na Vercel (UTC) gravava a reunião 3h errada.
   - Testes em `src/lib/crm/reuniao.test.ts` (15:00 BRT → 18:00Z, minutos preservados, virada de dia).

2. **Tarefa espelho no quadro /tarefas** (`src/actions/crm-atividades.ts`)
   - Após o bloco do Google Calendar, insert em `tarefas` com: título `Reunião: {lead} (HH:MM)`, `data = v.data` (data local BR, nunca derivada do UTC), prioridade `alta`, etiqueta `['Reunião']`, responsável = usuário logado, link do Meet na descrição quando houver.
   - Em try/catch PRÓPRIO: falha no espelho nunca quebra o agendamento.
   - ⚠️ **A tarefa espelho é INDEPENDENTE**: concluir/cancelar a tarefa no quadro NÃO sincroniza de volta com o CRM (e vice-versa).

3. **Script de correção do dado antigo** (`scripts/corrigir-fuso-reunioes-crm.ts`)
   - Dry-run por padrão: `npx tsx --env-file=.env.local scripts/corrigir-fuso-reunioes-crm.ts`
   - Dry-run validado: lista exatamente 1 reunião afetada — **Daíla Aires, 20/07** (`15:00Z → 18:00Z`, ou seja, passa a marcar 15:00 BRT correto).
   - `--executar` faz backup JSON em `scripts/backup-fuso-reunioes-<ts>.json` e soma +3h em transação.
   - ⚠️ **O `--executar` em produção é passo MANUAL do usuário, APÓS o deploy do fix** (o corte é `now()` — rodar antes de agendar reuniões novas pós-deploy).

## Verificação

- `npx vitest run` — 3492 passando, 0 falhas
- `npm run build` — verde (precisou de `npm install` antes: `@react-pdf/renderer` estava faltando no node_modules local)
- Dry-run do script — lista a reunião da Daíla Aires sem alterar nada

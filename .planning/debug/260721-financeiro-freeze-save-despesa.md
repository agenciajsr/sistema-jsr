---
status: awaiting_human_verify
trigger: "A página /financeiro fica fora do ar (504/timeout) depois de mutações que revalidam a página — hoje ao SALVAR despesa, ontem ao EXCLUIR aquisição."
created: 2026-07-21T00:00:00Z
updated: 2026-07-21T12:00:00Z
---

## Current Focus

hypothesis: CONFIRMADA. Toda mutação em /financeiro chama router.refresh() (+ revalidatePath), re-executando o Server Component inteiro (~14 queries render-blocking, maxDuration=60, embrulhado por withRetry). O withRetry NÃO cancela as queries da 1ª tentativa (documentado como "manter quentes") → num soluço do pooler abandona ~14 SELECTs; sob Fluid Compute a maior (listTransacoes) fica em ClientRead segurando AccessShareLock = o zumbi de 13min que bloqueou a migration 0040 e que o statement_timeout não mata. O delete-aquisição (1e84e67) já foi decouplado; faltavam: transacao create/update/delete, conta marcar-pago, aquisição CREATE.
test: Decouplar TODAS as mutações de /financeiro do reload pesado (padrão 1e84e67): update otimista no cliente, sem router.refresh. Verificar com tsc + vitest.
expecting: Salvar despesa mostra a linha na hora, SEM reload da página pesada → sem freeze, sem gerar zumbi.
next_action: Implementar store de contexto para a lista de transações (compartilha estado entre form de criação e tabela) + otimista em contas-table e aquisicao-form.

## Fix directions consideradas (evidência antes de consertar)

- ESCOLHIDA: decouplar mutações do reload pesado (otimista, padrão 1e84e67). Estático/tsc-verificável, mata o gatilho reportado, reduz frequência dos reloads pesados (→ menos episódios de zumbi). Sessão atual.
- REJEITADA: quebrar /financeiro em <Suspense> paralelos. VIOLA a disciplina documentada (STATE.md / src/lib/db/index.ts): NUNCA aumentar paralelismo — boundaries de Suspense renderizam concorrentemente e estourariam o pool max=5 / max_pipeline=1 (a carga hoje é deliberadamente sequencial em 2 lotes para proteger o pool). Pioraria a contenção.
- FOLLOW-UP (precisa de staging/runtime, não dá pra verificar aqui): (1) matar o zumbi na raiz — withRetry que abandona SELECTs é o fabricante do ClientRead; reavaliar se o max_pipeline=1 (fix de 14/jul) já removeu a causa que justificava o "F5 automático", tornando o withRetry net-negativo. (2) tornar listTransacoes/getResumoFinanceiro/getVisaoAnalitica sargáveis (data >= 1º-do-mês AND data < 1º-do-próximo em vez de extract()) — reduz execução/lock, MAS mexe em número financeiro (CLAUDE.md: nunca arriscar número errado) → verificar contra o banco antes.

## Symptoms

expected: Depois de salvar uma despesa em /financeiro, a página recarrega normalmente mostrando a nova despesa.
actual: Depois que salva, /financeiro fica fora do ar (não carrega / 504 / derrubada). Intermitente mas reproduzível hoje ao salvar despesa; ontem ao excluir aquisição.
errors: Sem erro exibido ao usuário. No banco: conexão zumbi pid 993257 segurando AccessShareLock em `clientes`, state=active, wait_event=ClientRead, xact_age=13min, query = listTransacoes. Bloqueou o ADD COLUMN da migration 0040.
reproduction: /financeiro → cadastrar despesa → Salvar. createTransacao chama revalidatePath('/financeiro') e o form chama router.refresh() → re-render completo da página (~14 queries).
started: Freeze crônico há semanas (ver 260712-504-timeout-auth-amplification.md, não resolvida). Recentes: ontem no excluir aquisição (fix parcial 1e84e67), hoje no salvar despesa.

## Eliminated

- hypothesis: Regressão do trabalho de hoje (perfil interno / coluna clientes.interno).
  evidence: O bug já ocorria ontem (excluir aquisição) antes da 0040. Orquestrador confirmou.
  timestamp: 2026-07-21T00:00:00Z

## Evidence

- timestamp: 2026-07-21T00:00:00Z
  checked: src/app/(app)/financeiro/transacao-form.tsx (onSubmit, linhas 136-155)
  found: Após createTransacao/updateTransacao com sucesso, o form SEMPRE chama router.refresh() (linha 153). router.refresh() re-executa o Server Component FinanceiroPage inteiro no servidor.
  implication: Toda mutação de transação força reload da página mais pesada. Combinado com o revalidatePath('/financeiro') da action, o gatilho de reload é duplo. Idêntico ao problema do excluir aquisição corrigido em 1e84e67 (que REMOVEU o router.refresh e fez remoção otimista local).

- timestamp: 2026-07-21T00:00:00Z
  checked: src/app/(app)/financeiro/page.tsx (carregarDados, linhas 73-135)
  found: carregarDados dispara ~14 queries (Lote1=4, Lote2=5, +5 sequenciais) render-blocking numa função com maxDuration=60, embrulhado por withRetry (timeout 12s / retry 15s / delay 3s). Cada action interna também chama getCurrentUser.
  implication: Página inteira depende de TODAS as ~14 queries terminarem juntas. Um único painel lento derruba tudo.

- timestamp: 2026-07-21T00:00:00Z
  checked: src/lib/utils/with-retry.ts + comentários em src/lib/db/index.ts (linhas 13-21)
  found: withTimeout NÃO cancela a promise original — as queries da 1ª tentativa que estouraram o teto CONTINUAM rodando em background (documentado como intencional: "deixa as conexões quentes"). O max do pool foi subido 3→5 justamente porque "o withRetry não cancela as queries da 1ª tentativa".
  implication: O withRetry é o FABRICANTE das órfãs em ClientRead. Cada soluço = 14 SELECTs abandonadas + 14 da 2ª tentativa. Sob Fluid Compute (suspensão da instância), uma SELECT abandonada pós-execução fica em ClientRead segurando lock — o zumbi observado. O statement_timeout (só execução) nunca a mata.

- timestamp: 2026-07-21T00:00:00Z
  checked: listTransacoes / getResumoFinanceiro / getVisaoAnalitica (filtros de mês)
  found: Todas filtram com `extract(month from data)=m AND extract(year from data)=a` — função sobre a coluna, NÃO-sargável (força seq scan, não usa índice em data). listTransacoes ainda faz leftJoin clientes + leftJoin profiles e retorna o mês INTEIRO de linhas (maior volume de resultado entre as ~14 queries; as demais são agregados de 1 linha ou listas filtradas menores).
  implication: listTransacoes é a mais lenta para executar E a que streama mais linhas → maior janela em ClientRead → naturalmente a que vira zumbi. Explica por que o zumbi observado era exatamente listTransacoes.

## Resolution

root_cause: TODA mutação em /financeiro (transacao create/update/delete, conta marcar-pago, aquisição create) chamava router.refresh(), que re-executa o Server Component /financeiro inteiro — ~14 queries render-blocking (maxDuration=60) embrulhadas por withRetry. O withRetry NÃO cancela as SELECTs da 1ª tentativa (design "manter quentes"); num soluço do pooler abandona ~14 queries e, sob Fluid Compute, a de maior volume (listTransacoes: join de 3 tabelas + mês inteiro) fica em ClientRead segurando AccessShareLock = a conexão zumbi (13min observados, bloqueou a migration 0040). O statement_timeout (só execução) não mata ClientRead. Ou seja: a mutação era o GATILHO (força reload da página mais frágil) e o withRetry o AMPLIFICADOR (fabrica o zumbi). O delete-aquisição (1e84e67) já tinha sido decouplado; faltavam as outras 5 mutações.
fix: Decouplar TODAS as mutações de /financeiro do reload pesado (padrão 1e84e67 — a mutação já persistiu no banco; a UI reflete localmente, KPIs/analítica recalculam no próximo carregamento real). (1) Novo TransacoesProvider (contexto client, keyed por mês/ano) compartilha a lista entre o form de criação/edição e a tabela; create/update/delete atualizam o store, sem router.refresh. (2) contas-table: marcar-pago some da tela otimisticamente (Set de pagos), sem router.refresh. (3) aquisição create: createInvestimentoAquisicao agora faz .returning() da linha; o form faz upsert local por id, sem router.refresh. NÃO mexi no withRetry/pool nem nas queries extract() (ver follow-up) — mudança de UMA variável (o gatilho), estático/verificável sem deploy.
verification: npx tsc --noEmit exit 0. npx vitest run: 630 pass / 0 fail. Verificação em produção (soluço real / Fluid Compute) PENDENTE — precisa do usuário confirmar em produção que salvar despesa não derruba mais o /financeiro.
files_changed: [src/app/(app)/financeiro/transacoes-store.tsx (novo), src/app/(app)/financeiro/transacao-form.tsx, src/app/(app)/financeiro/transacoes-table.tsx, src/app/(app)/financeiro/page.tsx, src/app/(app)/financeiro/contas-table.tsx, src/app/(app)/financeiro/aquisicao-form.tsx, src/actions/financeiro.ts]

## Follow-up recomendado (precisa de staging/runtime — fora desta sessão)

- MATAR O ZUMBI NA RAIZ: o withRetry que abandona SELECTs é o fabricante do ClientRead. Avaliar se o max_pipeline=1 (fix de 14/jul) já removeu a causa do cold-start-hang que justificava o "F5 automático" — nesse caso o withRetry virou net-negativo (só fabrica zumbi). Requer teste em produção/staging para não reintroduzir a falha de cold start.
- SARGABILIDADE: listTransacoes/getResumoFinanceiro/getVisaoAnalitica filtram com extract(month/year from data) (não-sargável, seq scan). Trocar por range (data >= 1º-do-mês AND data < 1º-do-próximo) reduz execução/lock da query que mais zumbiza — MAS mexe em número financeiro; verificar os totais contra o banco antes (CLAUDE.md: nunca arriscar número errado).

## Nota de finalização

O agente de debug caiu por erro de API (conexão fechou) logo após rodar os testes.
O orquestrador verificou de forma independente: `npx tsc --noEmit` exit 0 e
`npx vitest run` = 630 pass / 0 fail. Diff revisado (store + 5 mutações
decoupladas do reload pesado). Status: aguardando verificação do usuário em
produção (salvar despesa não derruba mais o /financeiro).
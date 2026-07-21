---
phase: quick-260721-ogt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/financeiro/recorrencia.ts
  - src/lib/financeiro/recorrencia.test.ts
  - src/lib/financeiro/rollover.ts
  - src/actions/financeiro.ts
  - src/app/api/cron/sync-meta/route.ts
  - src/app/(app)/financeiro/page.tsx
  - src/lib/db/schema.ts
  - drizzle/0041_transacoes_pai_data_unique.sql
  - scripts/aplicar-migration-0041.ts
  - scripts/limpar-recorrentes-futuras.ts
autonomous: true
requirements: [FIN-RECORRENCIA-ROLLOVER]
must_haves:
  truths:
    - "Criar uma transação recorrente (despesa OU receita) insere só a instância da competência atual — nunca pré-gera 12 meses/27 semanas de futuro."
    - "Na virada do mês a nova competência aparece automaticamente, tanto de carona no cron sync-meta quanto ao abrir /financeiro (materialização preguiçosa, sem depender do timing do cron)."
    - "Competência não paga permanece (vencido); a seguinte nasce pelo calendário do mesmo jeito, como as cobranças."
    - "O card 'Previsão por mês' e a 'Previsão de caixa (30 dias)' mostram os MESMOS números de antes para os meses já exibidos, agora projetados da série — apesar de as linhas futuras terem sido removidas — e SEM dupla contagem (query real exclui recorrente futuro; projeção é a fonte única do futuro)."
    - "Séries recorrentes SEM contrato passam a ter horizonte de projeção ROLANTE (hoje+12 meses) — decisão consciente (checker Warning 2): pode exibir alguns meses a mais na cauda do que as linhas antigas (criadas com dataCriação+12), o que é melhoria, não queda; nenhum mês já exibido muda de valor."
    - "Materializar duas vezes (cron + page load concorrentes) não duplica nenhuma instância — idempotente."
  artifacts:
    - path: "src/lib/financeiro/recorrencia.ts"
      provides: "Aritmética PURA de competência recorrente (stepping UTC + pendentes + projeção por intervalo), espelho de cobrancas/regras.ts"
      min_lines: 60
    - path: "src/lib/financeiro/recorrencia.test.ts"
      provides: "TDD do módulo puro (semanal/mensal/trimestral, clamp 31→28, idempotência por jaGeradas, cap por dataFinal, avulsa)"
      contains: "describe("
    - path: "src/lib/financeiro/rollover.ts"
      provides: "rolarRecorrentes() — materialização preguiçosa idempotente, queries SEQUENCIAIS, espelho de gerarCobrancasMensais"
      exports: ["rolarRecorrentes"]
    - path: "drizzle/0041_transacoes_pai_data_unique.sql"
      provides: "Índice único parcial (transacao_pai_id, data) — trava de corrida da materialização"
      contains: "ux_transacoes_pai_data"
    - path: "scripts/limpar-recorrentes-futuras.ts"
      provides: "Limpeza IDEMPOTENTE das instâncias futuras pré-geradas (gerada, aplicada pelo ORQUESTRADOR após revisão)"
      contains: "dry-run"
  key_links:
    - from: "src/actions/financeiro.ts (createTransacao)"
      to: "NÃO chama mais gerarParcelasRecorrentes"
      via: "remoção da chamada + remoção da função"
      pattern: "gerarParcelasRecorrentes"
    - from: "src/app/api/cron/sync-meta/route.ts"
      to: "rolarRecorrentes()"
      via: "carona try/catch próprio após gerarCobrancasMensais"
      pattern: "rolarRecorrentes"
    - from: "src/app/(app)/financeiro/page.tsx"
      to: "rolarRecorrentes()"
      via: "await sequencial em try/catch ANTES do withRetry (roda 1×, nunca quebra a página)"
      pattern: "rolarRecorrentes"
    - from: "src/actions/financeiro.ts (getPrevisaoReceitaPorMes, getPrevisaoCaixa)"
      to: "projeção pura da série"
      via: "merge de linhas reais + ocorrências projetadas dos meses futuros"
      pattern: "ocorrenciasRecorrentesNoIntervalo|projec"
---

<objective>
Fazer as transações recorrentes do /financeiro ROLAREM mês a mês (só a competência
atual aparece, e a próxima nasce automaticamente na virada) — como as cobranças dos
clientes — em vez de pré-gerar o futuro inteiro. Inclui a limpeza cuidadosa das
instâncias futuras já pré-geradas SEM bagunçar a previsão financeira.

Purpose: Hoje `gerarParcelasRecorrentes` (financeiro.ts:92) gera todas as parcelas de
uma vez (até fim do contrato ou 12 meses): séries mensais nascem com 12 linhas,
semanais com ~27. Isso polui o banco e a previsão. Espelhamos o padrão comprovado das
cobranças (competências pendentes até o mês atual, idempotente) e das tarefas
(materialização preguiçosa idempotente ao abrir a tela).

Output: módulo puro de competência recorrente (TDD), rollover idempotente rodando de
carona no cron E preguiçoso no /financeiro, previsões (por mês + caixa 30d) que passam
a PROJETAR a série (número não muda), migration 0041 (índice único = trava de corrida)
e um script de limpeza idempotente das futuras — gerado aqui, aplicado pelo orquestrador.

DECISÕES JÁ FECHADAS (não reabrir): (1) trigger AUTOMÁTICO na virada, não on-payment;
(2) escopo = TODAS as recorrentes (despesa E receita); (3) limpeza remove só as futuras,
mantendo âncora/mês atual/passado.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Padrão a ESPELHAR (o "certo" da casa)
@src/lib/cobrancas/regras.ts
@src/lib/cobrancas/regras.test.ts
@src/lib/cobrancas/gerar.ts
@src/lib/tarefas/recorrencia.ts
@src/lib/tarefas/dados.ts

# Onde o rollover roda de carona / código a alterar
@src/app/api/cron/sync-meta/route.ts
@src/actions/financeiro.ts
@src/app/(app)/financeiro/page.tsx

# Disciplina de banco (freeze recém-corrigido — NÃO regredir)
@.planning/debug/260721-financeiro-freeze-save-despesa.md

<interfaces>
<!-- Contratos que o executor USA — extraídos do codebase, sem exploração. -->

Modelo da série (schema.ts — SEM flag/molde nova; reusa a âncora):
  transacoes.recorrencia: enum ['semanal','mensal','trimestral','avulsa'] (default 'avulsa')
  transacoes.transacaoPaiId: uuid self-ref (onDelete 'set null')
  → ÂNCORA da série  = transacaoPaiId IS NULL  AND recorrencia != 'avulsa'  (é uma transação REAL, a 1ª competência)
  → FILHOS da série   = transacaoPaiId = âncora  (também com recorrencia setada)
  Índice existente: transacoes_data_idx on (data, tipo)

Colunas de transacoes a copiar da âncora p/ o filho (rollover):
  tipo, categoria, clienteId, descricao, valor, diaVencto, notas, centroCusto,
  recorrencia, formaPagamento, responsavelId + { data, status:'pendente', transacaoPaiId:âncora.id }

Espelho de cobranças (regras.ts): competenciasPendentes(contrato, jaGeradas, hoje)
  → função PURA, idempotente por jaGeradas, nunca passa do mês atual. É o molde do Task 1.
Espelho de cobranças (gerar.ts): gerarCobrancasMensais() roda de carona no cron
  (sync-meta/route.ts ~linha 42, try/catch próprio). É o molde do Task 2.
Espelho de tarefas (dados.ts): materialização preguiçosa idempotente ao abrir /tarefas,
  QUERIES SEQUENCIAIS + onConflictDoNothing sobre índice único (tarefa_mae_id, data).

hojeBrasilia(): string 'YYYY-MM-DD' — from '@/lib/date-br'. Use SEMPRE (server roda UTC).

⚠️ POOL: src/lib/db/index.ts max=5, max_pipeline=1 — queries paralelas na MESMA conexão
penduram para sempre. NUNCA Promise.all interno; NUNCA engordar os Promise.all da página
(Lote1/Lote2). rolarRecorrentes é SEQUENCIAL e roda FORA de qualquer Promise.all.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Módulo PURO de competência recorrente (TDD, espelho de cobrancas/regras.ts)</name>
  <files>src/lib/financeiro/recorrencia.ts, src/lib/financeiro/recorrencia.test.ts</files>
  <behavior>
    Escreva os testes ANTES (RED). Módulo PURO: zero import de db/auth/react/next.
    Datas SEMPRE string 'YYYY-MM-DD'. Aritmética 100% UTC (mesmo espírito de
    tarefas/recorrencia.ts — NÃO usar date-fns, que opera em fuso local e vaza dia).

    Tipo: `type RecorrenciaFin = 'semanal' | 'mensal' | 'trimestral' | 'avulsa'`

    1) `proximaDataRecorrente(data, recorrencia): string`
       - semanal → +7 dias (setUTCDate).
       - mensal → +1 mês; trimestral → +3 meses; GRAMPEANDO o dia ao último dia do
         mês alvo (31/jan +1 = 28/fev; 31/jan+1 em bissexto = 29/fev; 31 → 30 em mês de 30).
       - avulsa → lança/retorna a própria data (não itera; caller nunca chama p/ avulsa).
       Teste: 2026-01-31 →(mensal) 2026-02-28; 2028-01-31 →(mensal) 2028-02-29;
              2026-08-21 →(mensal) 2026-09-21; 2026-01-15 →(trimestral) 2026-04-15;
              2026-08-21 →(semanal) 2026-08-28.

    2) `ocorrenciasRecorrentesNoIntervalo(dataBase, recorrencia, dataFinal, de, ate): string[]`
       - Enumera as datas da série DEPOIS de dataBase (exclusivo), stepping por
         proximaDataRecorrente, dentro de [de, ate] (inclusive), respeitando o teto
         dataFinal quando != null (nunca gera data > dataFinal). avulsa → [].
       - Usada tanto pela materialização quanto pela projeção da previsão.
       Teste: dataBase 2026-08-21 mensal, dataFinal null, de/ate cobrindo 4 meses → 4 datas
              (21/09,21/10,21/11,21/12); com dataFinal 2026-10-31 → só 21/09 e 21/10.

    3) `datasPendentesRecorrentes({ dataBase, recorrencia, dataFinal, jaGeradas, hoje }): string[]`
       - limite = (dataFinal != null && dataFinal < hoje) ? dataFinal : hoje  (NUNCA gera futuro:
         teto = hoje; contrato já vencido encerra a série em dataFinal).
       - = ocorrenciasRecorrentesNoIntervalo(dataBase, recorrencia, dataFinal, dataBase, limite)
         FILTRADO por `!jaGeradas.includes(d)`. avulsa → [].
       - Idempotente: rodar 2× somando o 1º resultado a jaGeradas devolve [] (espelho de
         competenciasPendentes / ocorrenciasFaltantes). Teste a idempotência explicitamente.
       Teste: âncora 2026-05-21 mensal, hoje 2026-07-21, jaGeradas=[2026-05-21] →
              [2026-06-21, 2026-07-21]; rodar de novo com jaGeradas += resultado → [].
              hoje futuro não gera além de hoje; avulsa → [].
  </behavior>
  <action>
    Implemente após os testes ficarem vermelhos, até ficarem verdes (GREEN). Ancore toda
    a aritmética em `new Date(`${data}T12:00:00Z`)` + getters/setters UTC (getUTCDate,
    setUTCMonth, Date.UTC(...,0) p/ último dia do mês) — idêntico à filosofia de
    src/lib/tarefas/recorrencia.ts. Confirme que o clamp mensal reproduz exatamente o
    que date-fns addMonths produzia (as séries JÁ no banco foram geradas assim no server
    UTC): p/ manter jaGeradas casando com os filhos existentes que sobraram após a limpeza.
    Comente no topo que este módulo é o espelho financeiro de cobrancas/regras.ts.
  </action>
  <verify>
    <automated>npx vitest run src/lib/financeiro/recorrencia.test.ts</automated>
  </verify>
  <done>Testes verdes cobrindo semanal/mensal/trimestral, clamp 31→28/29/30, idempotência por jaGeradas, cap por dataFinal, teto=hoje e avulsa→[]. tsc limpo.</done>
</task>

<task type="auto">
  <name>Task 2: Rollover idempotente (módulo server + carona no cron + preguiçoso no /financeiro + parar de pré-gerar + migration 0041)</name>
  <files>src/lib/financeiro/rollover.ts, src/actions/financeiro.ts, src/app/api/cron/sync-meta/route.ts, src/app/(app)/financeiro/page.tsx, src/lib/db/schema.ts, drizzle/0041_transacoes_pai_data_unique.sql, scripts/aplicar-migration-0041.ts</files>
  <action>
    (A) NOVO `src/lib/financeiro/rollover.ts` — módulo SERVER comum, SEM 'use server'
    (export de arquivo 'use server' vira endpoint). Espelho de gerarCobrancasMensais.
    Cabeçalho comentando: QUERIES SEQUENCIAIS, pool max=5/max_pipeline=1, NUNCA Promise.all.
    `export async function rolarRecorrentes(): Promise<{ criadas: number }>`:
      1. hoje = hojeBrasilia().
      2. SELECT âncoras: transacoes WHERE transacaoPaiId IS NULL AND recorrencia != 'avulsa'
         (campos a copiar — ver <interfaces>). Se vazio → return { criadas: 0 }.
      3. SEQUENCIAL: SELECT filhos já existentes (transacaoPaiId IN âncoraIds) → { transacaoPaiId, data }.
         Monte Map<âncoraId, string[]> de datas já geradas e INCLUA a data da própria âncora
         em cada lista (a âncora é a 1ª competência — jaGeradas deve contê-la).
      4. SEQUENCIAL: dataFinal por cliente = contrato VIGENTE (dataInicio<=hoje<=dataVencimento)
         → dataVencimento; senão null. Reuse a mesma lógica de gerarParcelasRecorrentes:97-111,
         mas em UMA query agregada (clienteId → max(dataVencimento) dos vigentes) p/ os
         clienteIds das âncoras com cliente. Âncora sem cliente → dataFinal null (rola indefinido).
      5. Por âncora: pendentes = datasPendentesRecorrentes({ dataBase: âncora.data, recorrencia,
         dataFinal, jaGeradas, hoje }). Acumule as linhas de insert copiando os campos da âncora
         (status 'pendente', data = pendente, transacaoPaiId = âncora.id).
      6. Se houver linhas: UM `db.insert(transacoes).values(linhas).onConflictDoNothing()`
         (o índice único da migration 0041 é a trava de corrida; antes de aplicá-la o
         onConflictDoNothing não casa constraint e vira insert simples — a idempotência
         segura pelo filtro jaGeradas, que basta na prática sem concorrência).
      Tudo dentro de try/catch que loga e retorna { criadas: 0 } (degradação graciosa —
      migration ausente / soluço de conexão nunca quebra caller).

    (B) `src/app/api/cron/sync-meta/route.ts`: após o bloco gerarCobrancasMensais (~linha 42),
    adicione um try/catch PRÓPRIO chamando `await rolarRecorrentes()` (falha aqui não quebra
    o sync) e inclua o resumo no JSON de resposta (padrão idêntico ao de cobranças).

    (C) `src/app/(app)/financeiro/page.tsx`: materialização preguiçosa BARATA. Adicione
    `try { await rolarRecorrentes() } catch (e) { console.error('[financeiro] rollover', e) }`
    SEQUENCIAL, ANTES do bloco `withRetry`/`carregarDados` (roda 1× — NÃO dentro do factory
    retriado, NÃO dentro de nenhum Promise.all). Comente o porquê (cron roda a cada 6h; não
    pode a despesa do mês só aparecer horas depois da virada — debug 260721: nunca engordar
    os Promise.all nem aumentar paralelismo).

    (D) `src/actions/financeiro.ts`: em `createTransacao`, REMOVA a chamada a
    gerarParcelasRecorrentes (linhas ~83-86) — agora só insere a âncora (a 1ª competência);
    as próximas nascem pelo rollover. DELETE a função `gerarParcelasRecorrentes` inteira
    (92-147) — é justamente o anti-padrão que pré-gera o futuro. Ajuste imports órfãos
    (addWeeks; MANTENHA addMonths — ainda usado em getPrevisaoCaixa). tsc deve ficar limpo.

    (E) Migration 0041 — índice único parcial (trava de corrida, espelho do unique de tarefas):
      - schema.ts: no index builder de transacoes (linha 174-176) adicione
        `paiDataUnq: uniqueIndex('ux_transacoes_pai_data').on(table.transacaoPaiId, table.data).where(sql`${table.transacaoPaiId} IS NOT NULL`)`
        (importe uniqueIndex/sql se preciso). É só p/ manter o modelo Drizzle em dia — NÃO rode drizzle-kit.
      - `drizzle/0041_transacoes_pai_data_unique.sql`: `CREATE UNIQUE INDEX IF NOT EXISTS
        "ux_transacoes_pai_data" ON "transacoes" ("transacao_pai_id","data") WHERE "transacao_pai_id" IS NOT NULL;`
      - `scripts/aplicar-migration-0041.ts`: copie o molde de scripts/aplicar-migration-0039.ts
        (postgres DIRECT_URL max:1, CREATE UNIQUE INDEX IF NOT EXISTS ... idempotente). NÃO aplicar aqui.
    ⚠️ Ordem de aplicação pelo ORQUESTRADOR (documente no SUMMARY): rodar a LIMPEZA (Task 3)
    ANTES da migration 0041 — se sobrar duplicata (transacao_pai_id, data) o índice único falha;
    a limpeza remove as futuras e reduz esse risco. Se falhar, orquestrador investiga dups.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>rolarRecorrentes existe (sequencial, try/catch, onConflictDoNothing); cron e /financeiro chamam-no; createTransacao não pré-gera e gerarParcelasRecorrentes foi removida; migration 0041 (SQL + apply script + schema) gerada e NÃO aplicada. tsc limpo, vitest verde.</done>
</task>

<task type="auto">
  <name>Task 3: Previsões projetadas da série (número não muda) + script de limpeza idempotente das futuras</name>
  <files>src/actions/financeiro.ts, scripts/limpar-recorrentes-futuras.ts</files>
  <action>
    CONTEXTO FINANCEIRO CRÍTICO (CLAUDE.md — nunca arriscar número errado): a limpeza remove
    linhas FUTURAS que hoje ALIMENTAM getPrevisaoReceitaPorMes e getPrevisaoCaixa. Para o número
    NÃO cair silenciosamente, as duas passam a PROJETAR a série (competências futuras derivadas
    da recorrência), preservando o mês atual como linhas reais. Regra de não-duplicação: a limpeza
    PRESERVA o mês atual (linhas reais) e remove só competências > mês atual; a projeção cobre só
    competências > mês atual (começa no 1º dia do mês seguinte). Assim real e projetado nunca se
    sobrepõem.

    ⚠️ BLINDAGEM CONTRA DUPLA CONTAGEM (checker Warning 1 — CRÍTICO, à prova de ordem):
    a projeção NÃO pode depender de a limpeza já ter rodado. A query REAL deve EXCLUIR os
    filhos recorrentes FUTUROS (competência > mês atual AND transacaoPaiId IS NOT NULL AND
    recorrencia != 'avulsa'), deixando a PROJEÇÃO como FONTE ÚNICA dos meses futuros
    recorrentes. Assim, sobrevivendo ou não uma linha futura pré-gerada (deploy antes do
    --apply, ou --apply esquecido), o mês futuro NUNCA é contado duas vezes. O mês ATUAL e
    o passado continuam vindo 100% das linhas reais (a exclusão só vale p/ competência > atual);
    avulsas futuras continuam reais (a exclusão só pega recorrentes).

    (A) `getPrevisaoReceitaPorMes` (financeiro.ts:499): a query de linhas REAIS (receita,
    pendente/vencido, data > hoje, GROUP BY 'YYYY-MM') passa a EXCLUIR os filhos recorrentes
    de competência futura (`NOT (to_char(data,'YYYY-MM') > <competência atual> AND
    transacaoPaiId IS NOT NULL AND recorrencia != 'avulsa')`) — ver BLINDAGEM acima. Assim ela
    devolve o mês atual (recorrentes reais) + avulsas futuras, e os meses futuros recorrentes
    vêm SÓ da projeção. ACRESCENTE, SEQUENCIAL (fora de Promise.all): SELECT âncoras de RECEITA recorrente
    (transacaoPaiId IS NULL, tipo receita, recorrencia != 'avulsa') + dataFinal por contrato
    (mesma agregação do rollover; sem contrato → horizonte hoje+12 meses, IGUAL ao teto antigo
    de gerarParcelasRecorrentes, p/ o card mostrar os MESMOS meses de antes). Para cada âncora,
    projete com `ocorrenciasRecorrentesNoIntervalo(âncora.data, recorrencia, dataFinal, primeiroDiaMesSeguinte, horizonte)`,
    agrupe por 'YYYY-MM' somando âncora.valor. MERGE por mês: total = reais + projetadas.
    (Mês atual vem 100% das reais; meses futuros = avulsas reais + projeção recorrente — sem dupla contagem.)

    (B) `getPrevisaoCaixa` (financeiro.ts:389): a query REAL de pendente/vencido em [hoje, hoje+30]
    (receita E despesa) passa a EXCLUIR os filhos recorrentes de competência futura (mesma
    BLINDAGEM da (A): `NOT (to_char(data,'YYYY-MM') > <competência atual> AND transacaoPaiId IS NOT
    NULL AND recorrencia != 'avulsa')`) — assim, se uma linha futura pré-gerada cair dentro dos 30
    dias antes da limpeza, ela não é somada junto com a projeção. ACRESCENTE, SEQUENCIAL (queries
    internas em sequência — esta action roda dentro de um Promise.all do Lote 2; NÃO paralelizar por
    dentro, NÃO adicionar novo membro ao Promise.all da página): SELECT âncoras recorrentes (ambos
    os tipos) + dataFinal, projete `ocorrenciasRecorrentesNoIntervalo(âncora.data, recorrencia,
    dataFinal, primeiroDiaMesSeguinte, em30dias)` (começa no mês seguinte → não sobrepõe as reais do
    mês atual dentro da janela), some ao totalReceber/totalPagar conforme âncora.tipo e concatene aos
    items. Comente que a projeção cobre só a fatia do próximo mês dentro dos 30 dias.

    ⚠️ CONSISTÊNCIA DE DATA (checker info 5): ancore `primeiroDiaMesSeguinte`/`em30dias` da projeção
    na MESMA base de data da query real. Hoje getPrevisaoCaixa usa `new Date()` (fuso do server = UTC
    na Vercel). Prefira `hojeBrasilia()` para AMBAS (real + projeção) para a borda do mês/30d não
    divergir por 1 dia — mas se mudar a base da query real, confira que o número não desloca vs. antes.

    Ambas em try/catch de degradação graciosa (projeção falha → cai só nas linhas reais, nunca quebra).

    (C) NOVO `scripts/limpar-recorrentes-futuras.ts` — limpeza IDEMPOTENTE, GERADA aqui e APLICADA
    pelo ORQUESTRADOR após revisão (NÃO rodar neste task). Molde de conexão = scripts/aplicar-migration-0039.ts
    (postgres DIRECT_URL, max:1). Comportamento:
      - hoje via cálculo Brasília ('YYYY-MM' atual) — replique a lógica de hojeBrasilia inline (script standalone).
      - DRY-RUN por padrão: SELECT e imprime, por âncora, quantas/quais linhas seriam removidas
        (id, descricao, data, tipo, valor, status). Só executa o DELETE se rodado com `--apply`.
      - DELETE alvo (SÓ futuras): transacaoPaiId IS NOT NULL AND recorrencia != 'avulsa'
        AND to_char(data,'YYYY-MM') > <competência atual> AND status IN ('pendente','vencido').
        NUNCA remove: âncoras (transacaoPaiId IS NULL), competência atual e passado, e QUALQUER
        linha 'pago' (status). Envolva o DELETE em sql.begin() (rollback total se algo falhar).
      - Ao final imprime o resumo (total removido por série). Cabeçalho comentando: remove SÓ o
        futuro pré-gerado; a previsão continua batendo porque getPrevisaoReceitaPorMes/Caixa agora
        projetam a série; rodar 2× é seguro (2ª vez não acha nada).
    DADOS REAIS p/ conferência do dry-run (2026-07-21): "Assinatura Verificado Perfil Facebook"
    (âncora f192b81b, mensal, +11 futuras até 2027-07) e "Gerenciamento de anúncios online | JSR"
    (mensalidade=RECEITA; série semanal a6557385 tem 27 linhas até 2027-01). O dry-run deve listá-las.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <done>getPrevisaoReceitaPorMes e getPrevisaoCaixa projetam a série (mês atual real + futuro projetado, sem dupla contagem), sequenciais e com degradação graciosa; script de limpeza idempotente com dry-run gerado e NÃO aplicado. tsc limpo, suíte verde.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → toda a suíte verde (inclui o novo recorrencia.test.ts; sem regressão).
- Leitura estática: createTransacao não referencia mais gerarParcelasRecorrentes; a função sumiu.
- rolarRecorrentes é chamado em sync-meta/route.ts e em financeiro/page.tsx (grep).
- getPrevisaoReceitaPorMes/getPrevisaoCaixa contêm a projeção da série (ocorrenciasRecorrentesNoIntervalo).
- Migration 0041 e script de limpeza EXISTEM e NÃO foram aplicados (sem toque no banco pelo executor).
</verification>

<success_criteria>
- Nova transação recorrente insere só a âncora (competência atual); nenhuma linha futura pré-gerada.
- Rollover (cron + preguiçoso no /financeiro) materializa a competência atual de forma idempotente e sequencial, sem aumentar paralelismo nem engordar os Promise.all da página.
- Previsão por mês e Previsão de caixa 30d mostram os MESMOS números de antes (projeção da série), apesar da remoção das futuras.
- Script de limpeza remove SÓ futuras (competência > atual), nunca pagas/âncora/atual/passado, com dry-run — pronto para o orquestrador aplicar.
</success_criteria>

<orchestrator_followup>
Passos manuais do ORQUESTRADOR após o merge (nesta ordem — não são do executor):
1. Revisar o dry-run: `npx tsx --env-file=.env.local scripts/limpar-recorrentes-futuras.ts`
2. Aplicar a limpeza: `npx tsx --env-file=.env.local scripts/limpar-recorrentes-futuras.ts --apply`
3. Aplicar a migration 0041: `npx tsx --env-file=.env.local scripts/aplicar-migration-0041.ts`
   (limpeza ANTES da migration: reduz risco de duplicata (transacao_pai_id, data) travar o índice único).
4. Conferir na próxima abertura de /financeiro que o mês atual materializa e as previsões batem.
NÃO pushar/deployar automaticamente — testar local primeiro (convenção da casa).
</orchestrator_followup>

<output>
After completion, create `.planning/quick/260721-ogt-recorrencia-do-financeiro-rolar-mes-a-me/260721-ogt-SUMMARY.md`
(inclua a nota de ordem de aplicação: limpeza → migration 0041; e que ambas são do orquestrador).
</output>

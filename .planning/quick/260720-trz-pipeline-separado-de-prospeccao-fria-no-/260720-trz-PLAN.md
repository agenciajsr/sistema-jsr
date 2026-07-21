---
phase: quick-260720-trz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/crm/roteamento.ts
  - src/lib/crm/roteamento.test.ts
  - src/lib/crm/ingest.ts
  - scripts/seed-prospeccao-fria.ts
autonomous: true
requirements:
  - QUICK-260720-trz
must_haves:
  truths:
    - "Lead novo com fonte 'prospeccao_fria' nasce no pipeline 'Prospecção Fria' na etapa 'A Abordar'."
    - "Lead de qualquer outra fonte continua nascendo no pipeline padrão 'Vendas' na primeira etapa (fluxo inbound intacto)."
    - "Após o seed existe o pipeline 'Prospecção Fria' com 4 etapas: A Abordar → Abordado → Respondeu → Qualificado."
    - "Os 14 frios já existentes passam para 'Prospecção Fria' na etapa 'Abordado' com primeiro_contato_em preenchido."
    - "Rodar o script de seed/migração 2x não duplica pipeline/etapas nem re-move leads já migrados."
  artifacts:
    - path: "src/lib/crm/roteamento.ts"
      provides: "Decisão pura frio-vs-padrão por fonte + constantes de nome do pipeline/etapa frio"
      min_lines: 15
    - path: "src/lib/crm/roteamento.test.ts"
      provides: "Testes Vitest da decisão de roteamento (frio isola prospeccao_fria; todo o resto = padrão)"
    - path: "src/lib/crm/ingest.ts"
      provides: "processarLead roteando por fonte, mantendo queries sequenciais"
      contains: "roteamento"
    - path: "scripts/seed-prospeccao-fria.ts"
      provides: "Seed idempotente do pipeline Frio + migração idempotente dos 14 frios"
      contains: "Prospecção Fria"
  key_links:
    - from: "src/lib/crm/ingest.ts"
      to: "src/lib/crm/roteamento.ts"
      via: "import da decisão de roteamento"
      pattern: "from '@/lib/crm/roteamento'"
    - from: "src/lib/crm/ingest.ts"
      to: "crm_pipelines (nome 'Prospecção Fria') → crm_etapas 'A Abordar'"
      via: "SELECT sequencial do pipeline frio e sua 1ª etapa"
      pattern: "Prospecção Fria|prospeccao"
    - from: "scripts/seed-prospeccao-fria.ts"
      to: "crm_pipelines / crm_etapas / crm_oportunidades"
      via: "INSERT idempotente do pipeline+etapas e UPDATE dos frios para 'Abordado'"
      pattern: "INSERT INTO crm_etapas|UPDATE crm_oportunidades"
---

<objective>
Criar um pipeline separado "Prospecção Fria" no CRM para que os leads de disparo frio não poluam o funil de Vendas (inbound). Duas frentes: (1) rotear na ingestão — lead com fonte `prospeccao_fria` nasce no pipeline Frio na etapa "A Abordar", todo o resto continua em Vendas exatamente como hoje; (2) um script idempotente que semeia o pipeline Frio (4 etapas) e migra os 14 frios existentes de Vendas/"Novo Lead" para Frio/"Abordado".

Purpose: Board de Vendas limpo (só inbound de valor real) e um funil enxuto próprio para prospecção ativa, sem tocar no fluxo de leads existente nem na saúde dos números de outras telas.

Output: módulo puro testável `roteamento.ts`, `processarLead` roteando por fonte, e o script `scripts/seed-prospeccao-fria.ts` (aplicado à mão pelo ORQUESTRADOR — nunca pelo executor).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260720-trz-pipeline-separado-de-prospeccao-fria-no-/260720-trz-CONTEXT.md
@CLAUDE.md

<decisoes_travadas>
Do CONTEXT.md (NÃO revisitar):
- Etapas do Frio (ENXUTAS, nesta ordem): **A Abordar (5%) → Abordado (10%) → Respondeu (25%) → Qualificado (40%)**. NÃO criar coluna "Sem resposta" — quem não responde vira Perdido (mecanismo de perda já existente).
- Roteamento: SÓ fonte `prospeccao_fria` vai pro Frio (etapa "A Abordar"). Todo o resto continua no pipeline padrão "Vendas" (primeira etapa), comportamento atual intocado.
- Lead frio NOVO nasce em "A Abordar" com `primeiro_contato_em` VAZIO (você/ferramenta ainda vai abordar; o sistema não dispara nada sozinho).
- Os 14 frios de HOJE (já em "Novo Lead" do Vendas, disparo externo já saiu) → migram para Frio na etapa **"Abordado"** COM `primeiro_contato_em` preenchido (registra que o contato saiu).
- Pipeline/etapas são DADOS: criar via SCRIPT idempotente aplicado à mão (padrão scripts/aplicar-migration-*.ts). SEM migration de schema, SEM drizzle-kit.
- Graduação frio→Vendas: MANUAL no v1. Se a board não permitir mover card entre pipelines, NÃO implementar do zero — sinalizar como deferred (ver <graduacao_deferred>).
- QUERIES SEQUENCIAIS (pool max=5, max_pipeline=1): nada de Promise.all dentro de processarLead.
- pt-BR com acentos.
</decisoes_travadas>

<interfaces>
<!-- Contratos já existentes no código — usar direto, sem explorar o codebase. -->

Ingestão (src/lib/crm/ingest.ts, processarLead):
- Hoje seleciona o pipeline padrão via `crmPipelines.padrao = true` e a 1ª etapa via `orderBy(asc(crmEtapas.ordem)).limit(1)` (linhas ~129-145).
- `crmOportunidades` grava `pipelineId`, `etapaId`, `origem: lead.fonte`, `ordemNaEtapa`.
- `LeadEntrada.fonte` é um enum de FONTES_LEAD (inclui 'prospeccao_fria').

Fontes válidas (src/lib/validations/crm.ts): 'prospeccao_fria' já é valor de FONTES_LEAD e ORIGENS_LEAD.

Schema (src/lib/db/schema.ts):
- crm_pipelines: { id, workspace_id, nome, ordem (int, default 0), padrao (bool, default false), created_at }
- crm_etapas: { id, pipeline_id, nome, ordem (int, NOT NULL), cor, probabilidade (int 0-100), created_at }
- crm_oportunidades: inclui pipeline_id, etapa_id, origem, status ('aberta'|'ganha'|'perdida'), primeiro_contato_em (timestamptz), ordem_na_etapa (int)

Ação moverOportunidade (src/actions/crm.ts:489) — apenas p/ contexto do deferred:
- `moverOportunidade(id, etapaId)` JÁ deriva `pipelineId` da etapa alvo e grava em crm_oportunidades. Ou seja, mover ENTRE pipelines FUNCIONA na camada de dados; falta só uma UI para escolher uma etapa de OUTRO pipeline (ver <graduacao_deferred>).

Padrão de script idempotente (scripts/aplicar-migration-0037.ts / 0039.ts):
- Lê `process.env.DIRECT_URL`, `postgres(url, { max: 1 })`, roda em `sql.begin(...)` (transação), confere estado REAL do banco antes (information_schema / SELECT guard), pula quando já aplicado, `finally { await sql.end() }`.
- Workspace alvo: `workspaces.slug = 'jsr'`.
- Executado por: `npx tsx --env-file=.env.local scripts/<arquivo>.ts` (o ORQUESTRADOR roda; o executor NÃO).
</interfaces>

<graduacao_deferred>
VERIFICADO no planejamento (não reinvestigar): a board `/crm` (kanban-crm.tsx / crm-view.tsx) renderiza UM pipeline por vez; o drag só tem drop targets nas etapas do pipeline visível + colunas virtuais Ganho/Perdido. A ficha do lead ("Pipeline Completa") filtra as etapas para o pipeline atual do negócio. NÃO existe hoje uma UI para mover um card para outro pipeline — embora a action `moverOportunidade` já suporte isso na camada de dados.
Conclusão: graduação manual frio→Vendas via UI é item À PARTE (net-new UI), FORA do escopo deste quick. NÃO implementar. O executor deve apenas REGISTRAR isto no SUMMARY como deferred (com o detalhe de que a action já suporta e falta só um seletor de pipeline/etapa de destino na UI).
</graduacao_deferred>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Roteamento por fonte em processarLead (módulo puro testável + wiring)</name>
  <files>src/lib/crm/roteamento.ts, src/lib/crm/roteamento.test.ts, src/lib/crm/ingest.ts</files>
  <behavior>
    Módulo puro `src/lib/crm/roteamento.ts` (ZERO import de db/auth/react — só constantes e lógica):
    - Exporta constantes: `NOME_PIPELINE_FRIO = 'Prospecção Fria'` e `ETAPA_INICIAL_FRIO = 'A Abordar'`.
    - Exporta `ehLeadFrio(fonte: string): boolean` → true SÓ para 'prospeccao_fria'.
    Testes Vitest (roteamento.test.ts):
    - Test 1: `ehLeadFrio('prospeccao_fria')` === true.
    - Test 2: para CADA outra fonte de FONTES_LEAD ('landing_page','meta_lead_ad','whatsapp','manual','instagram','evento','parceria','indicacao','outro') → false.
    - Test 3: fonte desconhecida/'' → false (nunca roteia para o Frio por engano).
  </behavior>
  <action>
    1. Criar `src/lib/crm/roteamento.ts` com as constantes acima e `ehLeadFrio`. Comentar em pt-BR por que só `prospeccao_fria` isola (disparo frio não deve poluir o funil inbound de Vendas).
    2. Criar `src/lib/crm/roteamento.test.ts` cobrindo os 3 casos acima (iterar sobre FONTES_LEAD importado de '@/lib/validations/crm' para o Test 2 — garante que uma fonte nova futura NÃO caia no Frio silenciosamente).
    3. Editar `processarLead` em `src/lib/crm/ingest.ts`, bloco de seleção de pipeline/etapa (hoje linhas ~129-145). Manter TODAS as queries SEQUENCIAIS (nada de Promise.all):
       - `import { ehLeadFrio, NOME_PIPELINE_FRIO } from '@/lib/crm/roteamento'`.
       - Se `ehLeadFrio(lead.fonte)`: SELECT do pipeline Frio por `and(eq(crmPipelines.workspaceId, workspaceId), eq(crmPipelines.nome, NOME_PIPELINE_FRIO))` limit 1; então a PRIMEIRA etapa desse pipeline via `orderBy(asc(crmEtapas.ordem)).limit(1)` ("A Abordar" nasce em ordem 0 no seed).
       - DEGRADAÇÃO GRACIOSA: se o pipeline Frio ainda NÃO existir (seed não aplicado), cair no pipeline padrão atual (o mesmo bloco de hoje) em vez de lançar erro — assim o roteamento passa a valer no instante em que o orquestrador aplicar o seed, sem quebrar ingestão nesse meio-tempo.
       - Qualquer outra fonte: comportamento ATUAL intocado (pipeline `padrao = true` + 1ª etapa).
       - NÃO setar `primeiro_contato_em` na ingestão: lead frio novo nasce em "A Abordar" sem carimbo de contato (decisão travada).
       - `origem: lead.fonte` e o INSERT da oportunidade permanecem como hoje (só mudam pipelineId/etapaId conforme a rota).
    4. Rodar `npx tsc --noEmit` para garantir que o wiring não quebrou tipos.
  </action>
  <verify>
    <automated>npx vitest run src/lib/crm/roteamento.test.ts</automated>
  </verify>
  <done>Testes de roteamento verdes; `ehLeadFrio` isola só 'prospeccao_fria'; processarLead roteia frio→pipeline "Prospecção Fria"/1ª etapa (com fallback gracioso ao padrão) e mantém todo o resto no pipeline padrão, queries sequenciais preservadas; `tsc --noEmit` sem erros.</done>
</task>

<task type="auto">
  <name>Task 2: Script idempotente — seed do pipeline Frio + migração dos 14 frios</name>
  <files>scripts/seed-prospeccao-fria.ts</files>
  <action>
    Criar `scripts/seed-prospeccao-fria.ts` seguindo EXATAMENTE o padrão de scripts/aplicar-migration-0037.ts (cabeçalho comentado com POR QUE não usar drizzle-kit + linha de uso `npx tsx --env-file=.env.local scripts/seed-prospeccao-fria.ts`; `postgres(process.env.DIRECT_URL!, { max: 1 })`; guarda de estado real via information_schema; `finally { await sql.end() }`). O script faz DUAS coisas idempotentes, nesta ordem:

    PARTE 1 — Seed do pipeline "Prospecção Fria" (workspace slug 'jsr'):
    - Guard: abortar se a tabela `crm_oportunidades` não existir (pré-requisito: 0019 aplicada).
    - Achar o workspace: `SELECT id FROM workspaces WHERE slug = 'jsr'`. Se ausente, logar aviso e pular (não lançar).
    - Idempotência: `SELECT id FROM crm_pipelines WHERE workspace_id = <ws> AND nome = 'Prospecção Fria'`. Se JÁ existe, logar "pipeline Frio já existe — seed pulado" e reusar o id.
    - Se não existe, dentro de `sql.begin`: inserir o pipeline com `ordem = (SELECT COALESCE(MAX(ordem),0)+1 ...)`, `padrao = false`; e inserir as 4 etapas com nome/ordem/probabilidade EXATOS:
        A Abordar (ordem 0, prob 5), Abordado (ordem 1, prob 10), Respondeu (ordem 2, prob 25), Qualificado (ordem 3, prob 40).
      Usar os nomes COM acento/pt-BR exatamente assim.

    PARTE 2 — Migração idempotente dos 14 frios:
    - Localizar: o pipeline padrão `padrao = true` do workspace jsr (pipeline "Vendas") e a etapa "Abordado" do pipeline Frio (por nome, no pipeline Frio semeado na Parte 1).
    - `UPDATE crm_oportunidades` movendo para o Frio/"Abordado":
        WHERE `workspace_id = <ws>` AND `pipeline_id = <Vendas padrão>` AND `origem = 'prospeccao_fria'` AND `status = 'aberta'`.
        SET `pipeline_id = <Frio>`, `etapa_id = <Abordado>`, `primeiro_contato_em = COALESCE(primeiro_contato_em, now())` (preserva o original se já houver), `ordem_na_etapa` sequencial (pode usar um contador simples ou row_number), `updated_at = now()`.
      Idempotência garantida pelo próprio WHERE: após mover, essas linhas saem do pipeline Vendas, então re-rodar não casa nada (0 linhas afetadas) e não re-carimba `primeiro_contato_em`.
    - Logar a CONTAGEM de linhas movidas (esperado ~14 na 1ª execução; 0 nas seguintes).

    IMPORTANTE: o executor NÃO roda este script (ele bate no banco de PROD via DIRECT_URL) — quem aplica é o ORQUESTRADOR. A verificação do executor é apenas de tipos/estrutura.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "seed-prospeccao-fria" || echo "sem erros de tipo no script"</automated>
  </verify>
  <done>scripts/seed-prospeccao-fria.ts existe, compila, segue o padrão idempotente (guards + sql.begin + information_schema + skip-se-existe + WHERE que impede re-move), cria o pipeline "Prospecção Fria" com as 4 etapas exatas e migra os frios de Vendas→Frio/"Abordado" carimbando primeiro_contato_em só quando nulo.</done>
</task>

</tasks>

<verification>
- `npx vitest run src/lib/crm/roteamento.test.ts` verde (roteamento puro).
- `npx tsc --noEmit` sem erros novos (wiring do ingest + script).
- Revisão manual: processarLead mantém as queries sequenciais (nenhum Promise.all introduzido) e todas as fontes ≠ 'prospeccao_fria' seguem o caminho do pipeline padrão inalterado.
- Script idempotente: leitura confirma que re-rodar não duplica pipeline/etapas nem re-move leads (skip-se-existe + WHERE por pipeline de origem).
</verification>

<success_criteria>
- Lead `prospeccao_fria` nasce em "Prospecção Fria"/"A Abordar"; qualquer outra fonte continua em "Vendas"/1ª etapa (inbound intacto).
- Pipeline "Prospecção Fria" com 4 etapas (A Abordar 5% → Abordado 10% → Respondeu 25% → Qualificado 40%) criado idempotentemente pelo script.
- 14 frios migram para "Prospecção Fria"/"Abordado" com primeiro_contato_em preenchido; re-rodar é no-op.
- Graduação frio→Vendas registrada como DEFERRED no SUMMARY (não implementada — net-new UI fora do escopo; action moverOportunidade já suporta na camada de dados).
- pt-BR com acentos em nomes de pipeline/etapas e comentários.
</success_criteria>

<output>
Ao concluir, criar `.planning/quick/260720-trz-pipeline-separado-de-prospeccao-fria-no-/260720-trz-SUMMARY.md`.
Incluir no SUMMARY:
- Que o script `scripts/seed-prospeccao-fria.ts` foi CRIADO mas NÃO aplicado — o ORQUESTRADOR deve rodar `npx tsx --env-file=.env.local scripts/seed-prospeccao-fria.ts` (banco de prod via DIRECT_URL) e conferir a contagem de frios movidos (~14).
- Item DEFERRED: graduação manual frio→Vendas via UI (a action já suporta mover entre pipelines; falta um seletor de pipeline/etapa de destino no card/ficha — escopo próprio).
</output>

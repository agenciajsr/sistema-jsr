---
phase: quick-260720-urt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/crm/followup.ts
  - src/lib/crm/followup.test.ts
  - src/lib/crm/roteamento.ts
  - src/lib/crm/roteamento.test.ts
  - src/lib/alertas/avaliar-operacional.ts
  - src/lib/alertas/avaliar-operacional.test.ts
  - src/actions/crm.ts
  - src/lib/crm/dados.ts
  - src/lib/alertas/calcular.ts
  - src/components/crm/kanban-followup.tsx
  - src/components/crm/crm-view.tsx
autonomous: true
requirements: [D-01, D-02, D-03, D-04, D-05]
user_setup: []

must_haves:
  truths:
    - "Um card do pipeline 'Prospecção Fria' movido para 'Qualificado' some do board frio e reaparece no pipeline 'Vendas' na etapa 'Qualificado', preservando contato/empresa/valor, com atividade de graduação na timeline"
    - "Um card frio parado em 'Abordado' com followup_nivel null mostra a pendência de follow-up 24h após a base (primeiro_contato_em, fallback createdAt) — mesma família visual do Vendas"
    - "A cadência D1-D6 (48h/72h/5d/7d/14d, esgotado em D6+14d) roda no MESMO card em 'Abordado' do frio, sem exigir uma etapa 'Follow-up' separada"
    - "Cards do pipeline 'Prospecção Fria' NUNCA ficam vermelhos 'aguardando 1º contato' nem geram alerta sla_primeiro_contato"
    - "Ao mover um card para 'Abordado' no frio, primeiro_contato_em é carimbado se estava nulo"
    - "O follow-up e o SLA do pipeline 'Vendas' continuam idênticos (regressão zero — todos os testes de followup.test.ts/avaliar-operacional.test.ts seguem verdes)"
  artifacts:
    - path: "src/lib/crm/followup.ts"
      provides: "ehEtapaAbordado, ehEtapaQualificado e pendenciaFollowup com ciência do frio (param pipelineFrio)"
      contains: "ehEtapaAbordado"
    - path: "src/lib/crm/roteamento.ts"
      provides: "ehPipelineFrio(nomePipeline) — detecção do funil frio por NOME"
      contains: "ehPipelineFrio"
    - path: "src/actions/crm.ts"
      provides: "graduação automática frio Qualificado→Vendas em moverOportunidade + avancarFollowup aceitando 'Abordado' do frio"
      contains: "ehEtapaQualificado"
    - path: "src/lib/crm/dados.ts"
      provides: "pendenciaFollowup do frio por card + supressão do SLA de 1h no frio"
      contains: "ehPipelineFrio"
    - path: "src/lib/alertas/calcular.ts"
      provides: "SLA de 1º contato ignora o pipeline frio"
      contains: "pipelineNome"
  key_links:
    - from: "src/lib/crm/dados.ts (montarCard)"
      to: "src/lib/crm/followup.ts (pendenciaFollowup)"
      via: "passa pipelineFrio derivado de ehPipelineFrio(pipeline.nome)"
      pattern: "pendenciaFollowup\\("
    - from: "src/actions/crm.ts (moverOportunidade)"
      to: "pipeline 'Vendas' etapa 'Qualificado'"
      via: "re-update do card quando destino é frio Qualificado"
      pattern: "ehEtapaQualificado"
    - from: "src/lib/alertas/calcular.ts"
      to: "src/lib/alertas/avaliar-operacional.ts (avaliarSlaPrimeiroContato)"
      via: "slaInputs carregam pipelineNome; avaliar pula ehPipelineFrio"
      pattern: "pipelineNome"
---

<objective>
Estender o CRM para (1) fazer a graduação AUTOMÁTICA de um lead frio para o funil de Vendas quando ele chega em "Qualificado", e (2) rodar a MESMA cadência de follow-up D1-D6 do Vendas dentro da etapa "Abordado" do funil "Prospecção Fria", SEM o SLA de 1h de 1º contato (que é para lead quente).

Purpose: Fechar o ciclo do funil frio criado no quick 260720-trz — o frio ganha lembretes de follow-up (a cadência que faz a prospecção ativa funcionar) e "promove" sozinho o lead que respondeu bem, sem UI de arrastar entre pipelines.

Output: módulos PUROS estendidos sob TDD (followup.ts, roteamento.ts, avaliar-operacional.ts), wiring nas actions/dados (moverOportunidade, avancarFollowup, dados.ts, calcular.ts) e ajuste mínimo da aba Follow-up para o card frio em "Abordado".
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Módulos PUROS a estender (zero import de db/react/next):
@src/lib/crm/followup.ts
@src/lib/crm/followup.test.ts
@src/lib/crm/roteamento.ts
@src/lib/crm/sla-contato.ts
@src/lib/alertas/avaliar-operacional.ts

# Wiring (server actions + camada de dados):
@src/actions/crm.ts
@src/lib/crm/dados.ts
@src/lib/alertas/calcular.ts

# UI mínima (aba Follow-up):
@src/components/crm/kanban-followup.tsx
@src/components/crm/crm-view.tsx

<interfaces>
<!-- Contratos que o executor usará DIRETO (extraídos do código) — sem exploração. -->

Já existentes em src/lib/crm/roteamento.ts:
```typescript
export const NOME_PIPELINE_FRIO = 'Prospecção Fria'
export const ETAPA_INICIAL_FRIO = 'A Abordar'          // etapas do frio: A Abordar → Abordado → Respondeu → Qualificado
export function ehLeadFrio(fonte: string): boolean
```

Já existentes em src/lib/crm/followup.ts (padrão a seguir — normalizar() remove acento/caixa/espaços):
```typescript
export const PRAZOS_FOLLOWUP_HORAS: Record<number, number> // {1:48,2:72,3:120,4:168,5:336,6:336}
export function ehEtapaFollowup(nome: string): boolean
export function ehEtapaContatoFeito(nome: string): boolean
export type PendenciaFollowup = { tipo: 'pendente' | 'esgotado'; texto: string } | null
export function pendenciaFollowup(p: {
  status: string; etapaNome: string | null; followupNivel: number | null
  ultimoFollowupEm: Date | string | null; baseContatoFeito: Date | string | null
}, agora?: Date): PendenciaFollowup
```

Já existente em src/lib/alertas/avaliar-operacional.ts:
```typescript
export type OportunidadeSlaInput = {
  id: string; titulo: string; contatoNome: string | null
  status: string; criadaEm: Date; primeiroContatoEm: Date | null
}
export function avaliarSlaPrimeiroContato(oportunidades: OportunidadeSlaInput[], agora?: Date): Alerta[]
```

Já existente em src/actions/crm.ts (ponto da graduação — moverOportunidade, ~L489-579):
- deriva `etapaPara.pipelineId` da etapa destino e faz o update do card (etapaId/pipelineId/ordemNaEtapa)
- chama `carimbarPrimeiroContato(id)` em TODO mover (idempotente, só se null) → decisão D-05 já é atendida ao entrar em "Abordado"
- `avancarFollowup(id)` exige hoje `ehEtapaFollowup(etapa.nome)` e nivel != null
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Módulos PUROS cientes do frio (followup.ts + roteamento.ts + avaliar-operacional.ts) sob TDD</name>
  <files>src/lib/crm/followup.ts, src/lib/crm/followup.test.ts, src/lib/crm/roteamento.ts, src/lib/crm/roteamento.test.ts, src/lib/alertas/avaliar-operacional.ts, src/lib/alertas/avaliar-operacional.test.ts</files>
  <behavior>
    RED antes de GREEN — escrever os testes primeiro, ver falhar, depois implementar. Seguir o estilo de followup.test.ts.

    followup.ts / followup.test.ts:
    - `ehEtapaAbordado(nome)`: true só para "Abordado" (tolerante a acento/caixa/espaços via normalizar); false para "A Abordar", "Contato Feito", "Follow-up", "Qualificado".
    - `ehEtapaQualificado(nome)`: true só para "Qualificado" (tolerante); false para "Qualificacao"/"Desqualificado"/etc.
    - `pendenciaFollowup` ganha param `pipelineFrio?: boolean` (default false). Semântica NO FRIO (pipelineFrio=true) com etapa "Abordado":
        · nivel null → pendente após 24h (PRAZO_ENTRADA_HORAS) desde baseContatoFeito;
        · nivel 1-5 → pendente após PRAZOS_FOLLOWUP_HORAS[nivel] desde ultimoFollowupEm;
        · nivel 6 → 'esgotado' após 336h (14d).
      Ou seja, "Abordado" no frio cumpre OS DOIS papéis que "Contato Feito" (entrada) e "Follow-up" (cadência) cumprem no Vendas.
    - REGRESSÃO ZERO: com pipelineFrio false/ausente o comportamento é BYTE-IDÊNTICO ao atual (todos os testes existentes de followup.test.ts seguem verdes). No frio, "Contato Feito"/"Follow-up" NÃO são a cadência (só "Abordado" é); no Vendas, "Abordado" NÃO dispara nada.
      Novos casos frio: Abordado nivel null 23h→null / 24h→pendente; Abordado nivel 1 47h→null / 48h→pendente; Abordado nivel 6 336h→esgotado; status ganha/perdida→null; etapa "A Abordar" (frio) nivel null→null (a entrada é SÓ "Abordado", não "A Abordar").

    roteamento.ts / roteamento.test.ts:
    - `ehPipelineFrio(nomePipeline: string | null): boolean`: true quando o nome normalizado == normalizar(NOME_PIPELINE_FRIO) ('prospeccao fria'); tolerante a acento/caixa/espaços; false para null/'Vendas'/'Prospecção'/outros. (Detecção por NOME porque a camada de dados/alertas tem o nome do pipeline, não a fonte do lead.) Reusar/definir um `normalizar` local no padrão de followup.ts — NÃO importar de followup.ts (roteamento é usado na ingestão e deve ficar autossuficiente).

    avaliar-operacional.ts / avaliar-operacional.test.ts:
    - `OportunidadeSlaInput` ganha `pipelineNome: string | null`.
    - `avaliarSlaPrimeiroContato`: pular (continue) quando `ehPipelineFrio(o.pipelineNome)` — lead frio nunca vira alerta sla_primeiro_contato. Importar ehPipelineFrio de '@/lib/crm/roteamento'.
    - Ajustar os testes existentes (helper `oportunidade({})`) para incluir `pipelineNome` default (ex.: 'Vendas' ou null) e adicionar 1 caso: pipelineNome 'Prospecção Fria' estourado → 0 alertas.
  </behavior>
  <action>
    Implementar exatamente o descrito em <behavior>, RED→GREEN. Detecção sempre por NOME normalizado (NFD + faixa de combinantes + trim + toLowerCase), padrão já usado em followup.ts/reuniao.ts. Não tocar em PRAZOS_FOLLOWUP_HORAS nem na assinatura pública existente além do param OPCIONAL pipelineFrio (posicional, no fim) e do campo pipelineNome no input do SLA. Manter comentários pt-BR com acentos explicando o "porquê" das regras do frio (mesma cadência do Vendas; "Abordado" acumula os dois papéis).
  </action>
  <verify>
    <automated>npx vitest run src/lib/crm/followup.test.ts src/lib/crm/roteamento.test.ts src/lib/alertas/avaliar-operacional.test.ts</automated>
  </verify>
  <done>Novos helpers/params implementados e testados; todos os testes desses 3 arquivos verdes, incluindo os PRÉ-EXISTENTES de Vendas (regressão zero).</done>
</task>

<task type="auto">
  <name>Task 2: Wiring — graduação frio→Vendas, follow-up do frio na cadência e supressão do SLA de 1h</name>
  <files>src/actions/crm.ts, src/lib/crm/dados.ts, src/lib/alertas/calcular.ts</files>
  <action>
    (A) src/actions/crm.ts — GRADUAÇÃO AUTOMÁTICA em `moverOportunidade` (D-01): DEPOIS do update principal do card e do `carimbarPrimeiroContato(id)`, adicionar um bloco em try/catch próprio (degradação graciosa) que:
      1. Carrega o NOME do pipeline de destino (query sequencial por etapaPara.pipelineId em crmPipelines — nada de Promise.all).
      2. Só age quando `ehPipelineFrio(nomePipelineDestino) && ehEtapaQualificado(etapaPara.nome)` — garante que só dispara na transição para "Qualificado" DO FRIO (nunca no Vendas, nunca em outra etapa).
      3. Encontra o pipeline "Vendas" = o pipeline `padrao` do workspace (crmPipelines where workspaceId=workspace.id and padrao=true). Se não achar, aborta a graduação silenciosamente (card fica no frio; não quebra o mover).
      4. Encontra a etapa "Qualificado" DESSE pipeline padrão via `ehEtapaQualificado(nome)` sobre as etapas do pipeline (carregar etapas do padrão e achar a primeira que casa). Se não existir, aborta silenciosamente.
      5. Calcula `ordemNaEtapa` no destino = count de abertas na etapa Vendas/Qualificado (sequencial, mesmo padrão do próprio moverOportunidade).
      6. Faz UM update do card: `{ pipelineId: vendasId, etapaId: qualificadoVendasId, ordemNaEtapa, updatedAt: new Date() }`. Contato/empresa/valor ficam na mesma linha — preservados sem tocar.
      7. `registrarAtividadeCrm(workspace.id, currentUser, { tipo:'mudanca_etapa', oportunidadeId:id, campo:'pipeline', de: NOME_PIPELINE_FRIO, para: 'Vendas · Qualificado' })` (atividade de graduação legível na timeline).
      Idempotente/seguro: se o card já estava no padrão, ehPipelineFrio(destino) é false e nada acontece. Importar `ehPipelineFrio, NOME_PIPELINE_FRIO` de '@/lib/crm/roteamento' e `ehEtapaQualificado` de '@/lib/crm/followup'.
      NÃO construir UI de arrastar entre pipelines (D-01 dispensa).

    (B) src/actions/crm.ts — `avancarFollowup` aceita o card frio em "Abordado" (D-02): hoje exige `ehEtapaFollowup(etapa.nome)`. Passar a aceitar QUANDO `ehEtapaFollowup(nome)` OU (`ehEtapaAbordado(nome)` E o pipeline do card é frio). Para saber o pipeline: no select da oportunidade já há etapaId; carregar o nome do pipeline (query sequencial por etapa→pipeline) e testar ehPipelineFrio. Tratamento do nivel null NO FRIO: quando `ehEtapaAbordado` e `followupNivel == null`, o primeiro avanço INICIA a cadência (set nivel=1, ultimo_followup_em=now) em vez de recusar com "ainda não entrou no fluxo" — no Vendas o null→1 acontece ao mover para a etapa "Follow-up"; no frio não há esse move, então o null→1 acontece aqui. Demais níveis 1→…→6 seguem a regra atual (recusa acima de 6). Importar `ehEtapaAbordado`.

    (C) src/lib/crm/dados.ts — pendência de follow-up do frio POR CARD + supressão do SLA de 1h (D-02, D-04):
      - Em `getCrmVisaoGeral`, derivar `const pipelineFrio = ehPipelineFrio(pipeline.nome)` (importar de '@/lib/crm/roteamento').
      - Passar `pipelineFrio` para `montarCard` (adicionar ao objeto InsumosCard ou como parâmetro) e, dentro dele, na chamada `pendenciaFollowup({...}, agora?)` passar o novo arg `pipelineFrio` — assim "Abordado" no frio calcula a pendência.
      - SUPRIMIR o SLA de 1h no frio: quando `pipelineFrio`, o card deve nascer com `aguardando1oContato=false` e `horasAguardando1oContato=null` (não mostrar o vermelho "aguardando 1º contato"). Fazer isso no montarCard condicionando ao pipelineFrio (o Set semPrimeiroContato pode continuar populado, mas o campo do card ignora quando frio). NÃO alterar a matemática de sla-contato.ts.
      - Base dos 24h no frio continua `fup ? (fup.primeiroContatoEm ?? criada) : null` (já é o esperado — carimbado ao entrar em "Abordado").

    (D) src/lib/alertas/calcular.ts — alerta sla_primeiro_contato ignora o frio (D-04): na query `slaRows` (dentro do try/catch existente), fazer leftJoin de `crmPipelines` por `crmOportunidades.pipelineId` e selecionar `pipelineNome: crmPipelines.nome`. Preencher `pipelineNome` em `slaInputs`. `avaliarSlaPrimeiroContato` (Task 1) já pula o frio. Preservar o try/catch de degradação graciosa (coluna primeiro_contato_em / migration 0034).

    Em TODO o wiring: QUERIES SEQUENCIAIS (pool max=3/5, nada de Promise.all novo), comentários pt-BR com acentos, degradação graciosa mantida.
  </action>
  <verify>
    <automated>npx vitest run src/lib/crm src/lib/alertas && npx tsc --noEmit</automated>
  </verify>
  <done>moverOportunidade gradua frio Qualificado→Vendas Qualificado (idempotente, só nessa transição, com atividade); avancarFollowup avança card frio em "Abordado" (null→1 no 1º avanço); dados.ts mostra a pendência de follow-up no card frio e não marca SLA de 1h; calcular.ts não gera sla_primeiro_contato para o frio; tsc verde; recorte crm+alertas verde (regressão zero no Vendas).</done>
</task>

<task type="auto">
  <name>Task 3: Aba Follow-up enxerga o card frio em "Abordado" (UI mínima)</name>
  <files>src/components/crm/kanban-followup.tsx, src/components/crm/crm-view.tsx</files>
  <action>
    Fazer a aba Follow-up (KanbanFollowup) funcionar também para o pipeline frio, onde a cadência corre em "Abordado" (não há etapa "Follow-up"):
    - crm-view.tsx: passar `pipelineNome={dados.pipelineNome}` para `<KanbanFollowup ... />` (a aba já existe e é compartilhada entre pipelines).
    - kanban-followup.tsx: aceitar prop `pipelineNome?: string | null`. Trocar a detecção da coluna de cadência de `colunas.find((c) => ehEtapaFollowup(c.etapa.nome))` para: se `ehPipelineFrio(pipelineNome)` usar `colunas.find((c) => ehEtapaAbordado(c.etapa.nome))`, senão manter `ehEtapaFollowup`. Importar `ehEtapaAbordado` de '@/lib/crm/followup' e `ehPipelineFrio` de '@/lib/crm/roteamento'.
    - Ajustar a copy do estado vazio para o caso frio (ex.: "Nenhum lead na etapa Abordado" / "Arraste um card para 'Abordado' no funil frio para iniciar a cadência" — mantendo o texto atual do Vendas quando não for frio).
    - A regra de arrasto D(n)→D(n+1) → avancarFollowup permanece; para o frio, o card null aparece em D1 (o `?? 1` atual) e o 1º avanço inicia a cadência (tratado na Task 2B). NÃO duplicar cards, NÃO criar novo endpoint.
    Escopo mínimo: nada além de trocar a fonte da coluna e a copy. Se algo do Vendas exigir mudança maior, é sinal de que saiu do escopo — parar e reavaliar.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx next build 2>&1 | tail -5</automated>
  </verify>
  <done>Com o pipeline "Prospecção Fria" selecionado, a aba Follow-up lista os cards de "Abordado" nas colunas D1-D6 e o arrasto D(n)→D(n+1) avança a cadência; com "Vendas" selecionado, a aba segue idêntica (coluna "Follow-up"). tsc e build verdes.</done>
</task>

</tasks>

<verification>
- `npm test` (vitest run) inteiro verde — nenhum teste pré-existente quebrado (regressão zero no follow-up/SLA do Vendas).
- `npx tsc --noEmit` sem erros.
- Manual (após aplicar o seed do frio do quick 260720-trz, se ainda não aplicado): abrir /crm no pipeline "Prospecção Fria", mover um card para "Qualificado" → ele some do frio e aparece em Vendas/Qualificado com a atividade de graduação; um card parado em "Abordado" há +24h mostra "⏰ Follow-up pendente" e NÃO mostra "aguardando 1º contato"; a aba Follow-up do frio lista os cards de "Abordado" em D1-D6.
</verification>

<success_criteria>
- D-01: graduação automática frio "Qualificado" → Vendas "Qualificado" (idempotente, só nessa transição, atividade na timeline, sem UI de arrastar entre pipelines).
- D-02: follow-up do frio reusa PRAZOS_FOLLOWUP_HORAS e roda a cadência D1-D6 dentro de "Abordado"; entrada 24h com nivel null; esgotado em D6+14d; perder é manual.
- D-03: sem etapa "Sem resposta" — esgotou vira Perdido manual (nenhum auto-perde).
- D-04: SLA de 1h de 1º contato suprimido para o frio (card sem vermelho + sem alerta sla_primeiro_contato).
- D-05: primeiro_contato_em carimbado ao entrar em "Abordado" se nulo (via carimbarPrimeiroContato já existente).
- Regressão zero no Vendas; sem migration nova (colunas já existem); queries sequenciais preservadas.
</success_criteria>

<output>
After completion, create `.planning/quick/260720-urt-follow-up-do-funil-frio-graduacao-automa/260720-urt-SUMMARY.md`
</output>
</content>
</invoke>

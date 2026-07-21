---
phase: quick-260720-urt
plan: 01
subsystem: crm
tags: [crm, follow-up, prospeccao-fria, graduacao, sla, alertas]
requires:
  - quick-260720-trz (funil "Prospecção Fria" com etapas A Abordar → Abordado → Respondeu → Qualificado)
  - migrations 0034 (primeiro_contato_em) e 0037 (followup_nivel/ultimo_followup_em) aplicadas
provides:
  - "Graduação AUTOMÁTICA frio 'Qualificado' → Vendas 'Qualificado' (sem UI de arrastar entre pipelines)"
  - "Cadência de follow-up D1-D6 do frio rodando na etapa 'Abordado'"
  - "Supressão do SLA de 1h de 1º contato para o funil frio (card + alerta)"
affects:
  - src/actions/crm.ts (moverOportunidade, avancarFollowup)
  - src/lib/crm/dados.ts (montarCard)
  - src/lib/alertas/calcular.ts (SLA de 1º contato)
tech-stack:
  added: []
  patterns:
    - "Detecção do funil por NOME normalizado (ehPipelineFrio) na camada de dados/alertas"
    - "Módulo puro estendido com param opcional (pipelineFrio) — regressão zero no Vendas"
    - "Graduação em try/catch próprio: degradação graciosa (card fica no frio se faltar pipeline/etapa)"
key-files:
  created: []
  modified:
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
    - vitest.config.ts
decisions:
  - "No frio, 'Abordado' acumula OS DOIS papéis: entrada (24h com nível null) E cadência (D1-D6) — não há etapa 'Follow-up' separada"
  - "Graduação dispara SÓ na transição para 'Qualificado' DO frio; pipeline Vendas = o padrao=true do workspace"
  - "avancarFollowup no frio: nível null INICIA a cadência (null→1) no 1º avanço (no Vendas o null→1 vem do move para 'Follow-up')"
  - "SLA de 1º contato do frio suprimido no card (aguardando1oContato=false) E no alerta (avaliarSlaPrimeiroContato pula ehPipelineFrio)"
  - "Detecção por NOME (ehPipelineFrio) porque dados/alertas têm o pipeline do card, não a fonte do lead"
metrics:
  duration: ~1 sessão (retomada após corte de tokens)
  tasks: 3
  files: 12
  completed: 2026-07-20
---

# Quick Task 260720-urt: Follow-up do funil frio + graduação automática — Summary

Fecha o ciclo do funil "Prospecção Fria" (quick 260720-trz): o lead frio agora (1) **gradua sozinho** para o funil de Vendas quando chega em "Qualificado", e (2) roda a **mesma cadência D1-D6** de follow-up do Vendas dentro da etapa "Abordado" — **sem** o SLA de 1h de 1º contato (que é para lead quente). Regressão zero no Vendas.

## O que foi feito

### Task 1 — Módulos PUROS cientes do frio (TDD)
- **`followup.ts`**: `ehEtapaAbordado`/`ehEtapaQualificado` (detecção por nome normalizado) + param opcional `pipelineFrio` em `pendenciaFollowup`. No frio, "Abordado" com nível null usa a entrada de 24h; com nível ≥1, a cadência `PRAZOS_FOLLOWUP_HORAS`. Cadência e entrada extraídas em helpers (`pendenciaCadencia`/`pendenciaEntrada`) — com `pipelineFrio=false` o comportamento do Vendas é byte-idêntico.
- **`roteamento.ts`**: `ehPipelineFrio(nome)` — true quando o nome normalizado == `'prospeccao fria'` (tolerante a acento/caixa/espaços). `normalizar` local de propósito (roteamento não importa de followup.ts).
- **`avaliar-operacional.ts`**: `OportunidadeSlaInput.pipelineNome` + `avaliarSlaPrimeiroContato` pula `ehPipelineFrio(o.pipelineNome)`.
- Testes: novos casos de frio em followup.test.ts (entrada 23h/24h, cadência 47h/48h, esgotado em 336h, regressão sem pipelineFrio), ehPipelineFrio em roteamento.test.ts, e caso frio estourado → 0 alertas em avaliar-operacional.test.ts.
- **`vitest.config.ts`**: `exclude` de `**/.claude/worktrees/**` — worktrees órfãos de sessões anteriores duplicavam os arquivos de teste em estados divergentes e poluíam o run.

### Task 2 — Wiring (graduação, cadência, SLA)
- **`moverOportunidade`** (crm.ts): após o move, bloco em try/catch próprio faz a **graduação** — quando destino é frio E etapa "Qualificado", re-move o card para o pipeline padrão (Vendas) na etapa "Qualificado" dele (contato/empresa/valor preservados), com atividade `pipeline: Prospecção Fria → Vendas · Qualificado`. Aborta em silêncio se faltar pipeline padrão/etapa (card fica no frio; o mover não quebra). Queries sequenciais.
- **`avancarFollowup`** (crm.ts): carrega o pipeline do card; aceita `ehEtapaFollowup` OU (`frio && ehEtapaAbordado`). No frio com nível null, o 1º avanço **inicia** a cadência (null→1, carimba ultimo_followup_em) em vez de recusar.
- **`dados.ts`**: `pipelineFrio` derivado de `ehPipelineFrio(pipeline.nome)` e propagado ao `montarCard` — a `pendenciaFollowup` recebe o flag e o `aguardando1oContato`/`horasAguardando1oContato` nascem `false`/`null` no frio (supressão do vermelho de 1º contato).
- **`calcular.ts`**: `slaRows` ganha `leftJoin(crmPipelines)` e `pipelineNome`; o avaliador (Task 1) já pula o frio. Preservado o try/catch de degradação graciosa (migration 0034).

### Task 3 — Aba Follow-up enxerga o card frio em "Abordado"
- **`crm-view.tsx`**: passa `pipelineNome={dados.pipelineNome}` para `<KanbanFollowup />`.
- **`kanban-followup.tsx`**: prop `pipelineNome`; no funil frio a coluna-fonte da cadência D1-D6 é "Abordado" (não "Follow-up"); copy do estado vazio adaptada ao caso frio. Nada mais mudou (arrasto D(n)→D(n+1) e coluna Perdido idênticos).

## Verificação
- `npx vitest run` (suíte inteira) — **630/630 verdes** (regressão zero; follow-up/SLA do Vendas intactos).
- `npx tsc --noEmit` — exit 0.
- `npx next build` — 0 erros, 0 warnings.

## Deviations from Plan
- **vitest.config.ts** foi adicionado à Task 1 (não estava em `files_modified`): worktrees órfãos de sessões anteriores estavam sendo varridos pelo vitest e faziam os testes falharem com cópias divergentes. O `exclude` de `.claude/worktrees/**` é a correção limpa e permanente. Nada mais divergiu do plano.

## Ação do orquestrador / pré-requisitos
- Teste manual depende do **seed do funil frio (quick 260720-trz) já aplicado** (`npx tsx --env-file=.env.local scripts/seed-prospeccao-fria.ts`) e das migrations 0034/0037. O código degrada graciosamente se algo faltar (card fica no frio / sem pendência), mas a graduação e a cadência só ficam visíveis com o funil frio populado.
- **Worktrees órfãos** em `.claude/worktrees/` (agent-a275…, a4536…, a4c2cc…, ab3f5a…): restos de sessões anteriores — o `ab3f5a91e28596436` contém a tentativa incompleta/não-commitada deste mesmo urt. Não foram removidos (removê-los descarta trabalho não commitado — decisão do usuário). O repo principal é a fonte da verdade; o vitest já os ignora.

## Known Stubs
Nenhum. Todo o dado é real; a "degradação graciosa" cai em comportamento válido (card segue no frio / sem pendência), não em placeholder.

## Self-Check: PASSED
SUMMARY em disco; 3 commits de tarefa no histórico (9d61d20, 7b8ba90, feeb97a).

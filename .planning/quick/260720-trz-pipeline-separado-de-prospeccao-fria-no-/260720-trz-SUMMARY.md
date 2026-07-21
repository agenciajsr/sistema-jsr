---
phase: quick-260720-trz
plan: 01
subsystem: crm
tags: [crm, ingestao, roteamento, pipeline, prospeccao-fria, seed, idempotente]
requires:
  - crm_pipelines / crm_etapas / crm_oportunidades (0019 aplicada)
  - workspace slug 'jsr'
provides:
  - "Funil separado 'Prospecção Fria' com roteamento por fonte na ingestão"
  - "Módulo puro ehLeadFrio + constantes de nome do pipeline/etapa frio"
  - "Script idempotente de seed do funil Frio + migração dos frios existentes"
affects:
  - src/lib/crm/ingest.ts (processarLead)
tech-stack:
  added: []
  patterns:
    - "Roteamento por fonte isolado em módulo puro testável (zero db/auth/react)"
    - "Degradação graciosa: cai no padrão enquanto o seed não foi aplicado"
    - "Seed/migração como DADO via script idempotente aplicado à mão (não drizzle-kit)"
key-files:
  created:
    - src/lib/crm/roteamento.ts
    - src/lib/crm/roteamento.test.ts
    - scripts/seed-prospeccao-fria.ts
  modified:
    - src/lib/crm/ingest.ts
decisions:
  - "ehLeadFrio compara estrita: só 'prospeccao_fria' isola; toda outra fonte (inclusive nova) segue no padrão 'Vendas'"
  - "Lead frio NOVO nasce em 'A Abordar' SEM primeiro_contato_em (o sistema não dispara nada sozinho)"
  - "Frios EXISTENTES migram para 'Abordado' COM primeiro_contato_em (disparo externo já saiu)"
  - "Idempotência da migração garantida pelo WHERE por pipeline de origem, não por flag"
metrics:
  duration: ~10min
  tasks: 2
  files: 4
  completed: 2026-07-20
---

# Quick Task 260720-trz: Pipeline separado de Prospecção Fria no CRM — Summary

Roteamento por fonte na ingestão do CRM: leads `prospeccao_fria` nascem no funil separado "Prospecção Fria" (etapa "A Abordar") enquanto todo o inbound segue intocado em "Vendas" — com um script idempotente que semeia o funil Frio (4 etapas) e migra os 14 frios existentes de Vendas para Frio/"Abordado".

## O que foi feito

### Task 1 — Roteamento por fonte (TDD)
- **`src/lib/crm/roteamento.ts`** (módulo puro, zero import de db/auth/react): constantes `NOME_PIPELINE_FRIO = 'Prospecção Fria'` e `ETAPA_INICIAL_FRIO = 'A Abordar'`, e `ehLeadFrio(fonte)` que retorna `true` SÓ para `'prospeccao_fria'`.
- **`src/lib/crm/roteamento.test.ts`** (4 testes, verdes): `prospeccao_fria` → true; itera `FONTES_LEAD` e confirma que toda outra fonte → false (uma fonte NOVA futura quebra o teste em vez de cair no Frio silenciosamente); fonte desconhecida/vazia/caixa-diferente → false.
- **`src/lib/crm/ingest.ts`** (`processarLead`): bloco de seleção de pipeline agora roteia por fonte. Se `ehLeadFrio(lead.fonte)`, seleciona o pipeline "Prospecção Fria" do workspace e sua 1ª etapa; qualquer outra fonte mantém o `padrao = true` de hoje. **Degradação graciosa**: se o pipeline Frio ainda não existir (seed não aplicado), cai no padrão em vez de lançar erro — o roteamento passa a valer no instante em que o orquestrador rodar o seed. Queries **sequenciais** preservadas (nenhum `Promise.all` introduzido). Lead frio novo **não** recebe `primeiro_contato_em`.

### Task 2 — Script idempotente
- **`scripts/seed-prospeccao-fria.ts`** (padrão da casa: `DIRECT_URL`, `postgres(url, { max: 1 })`, guard por `information_schema`, `sql.begin`, `finally { sql.end() }`):
  - **Parte 1**: cria o pipeline "Prospecção Fria" (workspace `jsr`, `padrao = false`, `ordem = MAX+1`) com as 4 etapas exatas — A Abordar (0, 5%) → Abordado (1, 10%) → Respondeu (2, 25%) → Qualificado (3, 40%). Pula se o pipeline já existir.
  - **Parte 2**: migra os frios abertos (`origem = 'prospeccao_fria'`, `status = 'aberta'`) que ainda estão no funil Vendas padrão para Frio/"Abordado", carimbando `primeiro_contato_em = COALESCE(primeiro_contato_em, now())` (preserva o original) e `ordem_na_etapa` sequencial via `ROW_NUMBER`. Idempotente pelo próprio WHERE (após mover, saem do Vendas; re-rodar afeta 0 linhas). Loga a contagem movida.

## Verificação
- `npx vitest run src/lib/crm/roteamento.test.ts` — 4/4 verdes.
- `npx tsc --noEmit` — exit 0 (wiring do ingest + script sem erros de tipo).
- Revisão manual: nenhum `Promise.all` em `ingest.ts` (única ocorrência é o comentário reforçando a regra); fontes ≠ `prospeccao_fria` seguem o caminho do padrão inalterado.

## Deviations from Plan
None - plano executado exatamente como escrito.

## AÇÃO DO ORQUESTRADOR (script NÃO aplicado pelo executor)
`scripts/seed-prospeccao-fria.ts` foi **CRIADO mas NÃO executado** — ele bate no banco de PROD via `DIRECT_URL`. O orquestrador deve rodar:

```
npx tsx --env-file=.env.local scripts/seed-prospeccao-fria.ts
```

e conferir a contagem de frios movidos (esperado **~14** na 1ª execução; **0** nas seguintes). Rodar 2x é seguro: não duplica pipeline/etapas nem re-move leads.

## Deferred
- **Graduação manual frio → Vendas via UI**: FORA do escopo deste quick (net-new UI). A action `moverOportunidade` (src/actions/crm.ts:489) **já suporta** mover entre pipelines na camada de dados (deriva `pipelineId` da etapa alvo). Falta apenas uma UI: a board `/crm` renderiza um pipeline por vez e o drag só tem drop targets nas etapas do pipeline visível + colunas virtuais Ganho/Perdido; a ficha do lead filtra as etapas para o pipeline atual. Escopo próprio = um seletor de pipeline/etapa de destino no card/ficha.

## Known Stubs
Nenhum. Todo o dado consumido é real; a "degradação graciosa" cai no comportamento atual válido (pipeline padrão), não em placeholder.

## Self-Check: PASSED

Todos os arquivos criados existem em disco e os 3 commits de tarefa (f8756f9, 6cd6ee5, a6b4b92) estão no histórico.

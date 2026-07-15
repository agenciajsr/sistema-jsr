---
phase: quick-260715-0zf
plan: 01
subsystem: crm
tags: [crm, pipeline, kanban, leads, api-publica, drizzle, server-actions]
dependency_graph:
  requires: [clientes, profiles, auth/session, db/index (pool max=3)]
  provides:
    [
      10 tabelas CRM (workspaces..crm_lead_inbox),
      processarLead compartilhado,
      POST /api/crm/leads,
      /crm kanban do pipeline padrao,
    ]
  affects: [/funil (vira redirect), app-sidebar (item CRM), lib/mock/extra (funilMock removido)]
tech_stack:
  added: []
  patterns:
    - "Padrao Pipedrive: ganho/perdido sao STATUS da oportunidade, nunca etapas"
    - "text (nao pgEnum) para status/tipos/papeis/origens evolutivos"
    - "registrarAtividadeCrm em lib/ (nao 'use server') — helper nao vira endpoint"
    - "Dedup em 2 niveis: inbox por sha256(fonte|identidade|dia) + contato por email/telefone"
key_files:
  created:
    - src/lib/crm/lead.ts
    - src/lib/crm/lead.test.ts
    - src/lib/crm/workspace.ts
    - src/lib/crm/atividades.ts
    - src/lib/crm/ingest.ts
    - src/lib/crm/dados.ts
    - src/lib/validations/crm.ts
    - src/actions/crm.ts
    - src/actions/crm-cadastros.ts
    - src/app/api/crm/leads/route.ts
    - src/app/(app)/crm/page.tsx
    - src/components/crm/kanban-crm.tsx
    - src/components/crm/card-oportunidade.tsx
    - src/components/crm/nova-oportunidade-dialog.tsx
    - drizzle/0019_jittery_maestro.sql
  modified:
    - src/lib/db/schema.ts
    - src/app/(app)/funil/page.tsx
    - src/components/app-sidebar.tsx
    - src/lib/mock/extra.ts
decisions:
  - "registrarAtividadeCrm movido para src/lib/crm/atividades.ts (modulo server comum) em vez de exportado de arquivo 'use server' — exporta-lo de la o transformaria em action chamavel de fora (endpoint nao autenticado)"
  - "getWorkspaceAtual engole erro de 'relation does not exist' e retorna null — e o que permite /crm degradar gracioso antes da 0019 ser aplicada"
  - "criarOportunidade resolve pipeline a partir da ETAPA (a etapa manda) — evita par etapa/pipeline inconsistente vindo do client"
  - "ganharOportunidade com empresa que JA tem clienteId: vincula o id existente na oportunidade em vez de criar cliente duplicado"
metrics:
  duration: ~15min
  completed: 2026-07-15
  tasks: 3
  files: 19
---

# Quick 260715-0zf: Backend completo do CRM comercial — Summary

**One-liner:** CRM comercial completo (10 tabelas com workspace single-tenant, actions com regras Pipedrive de ganho/perda, API publica de leads com dedup idempotente por dia) + primeira tela /crm com kanban funcional substituindo o /funil mock.

## O que foi feito

### Task 1 — Schema, migration 0019, validacoes e modulo puro (TDD)

- **Modulo puro `src/lib/crm/lead.ts`** (TDD: RED `0bff8c6` → GREEN `e657f57`): `normalizarTelefone` (so digitos, vazio→null) e `dedupHash` (sha256 hex 64 chars de `fonte|email-minusculo-ou-telefone|dia`). 9 testes, zero import de db/auth/react.
- **10 tabelas novas** em `src/lib/db/schema.ts` (secao `// --- CRM comercial ---`): `workspaces`, `workspace_membros`, `crm_empresas`, `crm_contatos`, `crm_pipelines`, `crm_etapas`, `crm_oportunidades`, `crm_tarefas`, `crm_atividades`, `crm_lead_inbox` + relations. Convencoes do repo: uuid PK defaultRandom, numeric(12,2) p/ dinheiro, text em vez de pgEnum p/ valores evolutivos, autorNome denormalizado, FKs restrict em pipeline/etapa de oportunidade.
- **Migration `drizzle/0019_jittery_maestro.sql` GERADA e NAO aplicada**, aditiva, com seed idempotente appendado: workspace JSR, membros a partir de profiles (admin→admin, resto→vendedor), pipeline Vendas (padrao) e 6 etapas (Novo Lead 10% → Negociação 90%).
- **`src/lib/validations/crm.ts`**: empresaSchema, contatoSchema, pipelineSchema, etapaSchema (0-100), oportunidadeSchema (valor coerce nonnegative, tipoReceita mensalidade|projeto), atualizarOportunidadeSchema, crmTarefaSchema e `leadEntradaSchema` (refine exigindo email OU telefone).
- **`src/lib/crm/workspace.ts`**: `getWorkspaceAtual()` cache()d, SELECT limit 1 (v1 single-tenant); erro de tabela inexistente → null (degradacao graciosa pre-0019).

### Task 2 — Actions, ingest compartilhado e API publica (`7dec968`)

- **`src/actions/crm.ts`**: pipelines (criar/renomear/reordenar/definirPadrao com invariante de exatamente 1 padrao/excluir recusando com oportunidades), etapas (criar/atualizar/reordenar/excluir contando oportunidades antes), oportunidades: `criarOportunidade` (cria contato/empresa minimos de nomes livres do dialog), `moverOportunidade` (atividade 'mudanca_etapa' com NOMES de/para), `ganharOportunidade` (conversao opcional em `clientes` com status `aguardando_inicio` + vinculo de clienteId na empresa E na oportunidade), `perderOportunidade` (motivo trim obrigatorio), `reabrirOportunidade`, `getAtividadesDaOportunidade`.
- **`src/actions/crm-cadastros.ts`**: empresas, contatos (telefoneNormalizado no create/update; deletar exige admin) e tarefas comerciais (concluir seta concluidaEm; atividades quando ha oportunidade).
- **`src/lib/crm/ingest.ts`**: `processarLead` compartilhado — inbox com `onConflictDoNothing(dedupHash)` (sem linha = `{ duplicado: true }`), dedup de contato por email lower() OU telefone, empresa achada/criada por nome, oportunidade na 1a etapa do pipeline padrao, atividades 'lead_recebido'+'criacao' (autor 'Sistema'), inbox → processado; qualquer erro pos-inbox grava status 'erro' + re-throw.
- **`src/app/api/crm/leads/route.ts`**: POST com header `x-crm-token` vs `CRM_LEADS_TOKEN` — **SEM modo desprotegido** (env ausente = 401 sempre); 400 body invalido (1a msg do Zod), 503 sem workspace, 200 `{ duplicado: true }`, 200 `{ ok, contatoId, oportunidadeId }`, 500 com trilha no inbox.

### Task 3 — /crm kanban, /funil redirect, sidebar (`f66ed2b`)

- **`src/lib/crm/dados.ts`** `getKanban()`: 4 queries agregadas sequenciais (workspace → pipeline padrao → etapas → TODAS as abertas com leftJoin contato/empresa) + merge em memoria com total e somaValor por coluna; `configurado: false` degrada com aviso "Aplique a migration 0019".
- **`/crm`**: header + Nova oportunidade (RHF+Zod, padrao ContratoForm com useState) + colunas com badge de contagem e soma em R$; card com Select de etapa (moverOportunidade), Ganhar (confirm p/ criar cliente) e Perder (prompt de motivo). Sem drag-and-drop no v1 (visual definitivo vira do mockup depois).
- **`/funil`** agora e so `redirect('/crm')`; `funilMock`/`FunilEtapaMock` removidos de `src/lib/mock/extra.ts` (zero usos restantes).
- **Sidebar**: item `CRM` (icone Target) logo apos Clientes.

## Verificacao

- `npm test`: **199 testes passando** (190 existentes + 9 novos de lead.ts).
- `npm run build`: compila sem erros; rotas `/crm` e `/api/crm/leads` registradas.
- `npx tsc --noEmit`: limpo.
- Greps de sanidade: `processarLead` na route, `getWorkspaceAtual` nas 2 actions, `redirect('/crm')` no funil, item CRM na sidebar, 0 usos de funilMock.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Seguranca] registrarAtividadeCrm movido para modulo lib em vez de exportado do arquivo de actions**
- **Found during:** Task 2
- **Issue:** o plano descrevia o helper "interno" dentro de crm-cadastros.ts, mas todo export de arquivo `'use server'` vira Server Action chamavel de fora — seria um endpoint de escrita nao autenticado em crm_atividades.
- **Fix:** helper criado em `src/lib/crm/atividades.ts` (modulo server comum, sem 'use server') e importado pelas 2 actions e pelo ingest.
- **Files modified:** src/lib/crm/atividades.ts, src/actions/crm.ts, src/actions/crm-cadastros.ts
- **Commit:** 7dec968

Nenhum outro desvio — plano executado como escrito.

## Pendencias para o usuario (setup)

1. **Aplicar as migrations pendentes EM ORDEM: 0015 → 0016 → 0017 → 0018 → 0019.** A 0019 cria as 10 tabelas do CRM e ja roda o seed idempotente (workspace JSR + membros + pipeline Vendas + 6 etapas) — sem passo manual extra. Ate la, /crm mostra o aviso amarelo "CRM ainda nao ativado" (sem quebrar).
2. **Criar a env `CRM_LEADS_TOKEN`** no `.env.local` E na Vercel (Settings → Environment Variables). Gerar valor aleatorio, ex.: `openssl rand -hex 32`. Sem ela a API de leads responde 401 para tudo (proposital — endpoint publico sem modo desprotegido).
3. Teste pos-deploy: `curl -X POST https://<app>/api/crm/leads -H "x-crm-token: <token>" -H "Content-Type: application/json" -d '{"fonte":"landing_page","nome":"Teste","email":"teste@ex.com"}'` → 200 ok e lead na coluna Novo Lead; repetir no mesmo dia → `{ "duplicado": true }`.

## Known Stubs

- Nao ha stubs que impecam o objetivo do plano. Observacoes de escopo v1 (intencionais, definidas no plano): sem drag-and-drop no kanban (mover via Select), sem telas dedicadas de empresas/contatos/tarefas comerciais (actions prontas, UI em plano futuro), visual definitivo do kanban vira do mockup do usuario.

## Commits

| Hash | Descricao |
|------|-----------|
| 0bff8c6 | test: testes falhando de normalizarTelefone + dedupHash (RED) |
| e657f57 | feat: implementar normalizarTelefone + dedupHash (GREEN, 9 testes) |
| 45de240 | feat: schema CRM (10 tabelas) + migration 0019 com seed + validacoes + getWorkspaceAtual |
| 7dec968 | feat: Server Actions do CRM + ingest compartilhado + API publica POST /api/crm/leads |
| f66ed2b | feat: pagina /crm com kanban basico, /funil vira redirect, item CRM na sidebar |

## Self-Check: PASSED

- 15/15 arquivos criados confirmados no disco
- 5/5 commits confirmados no historico do git
- 199 testes passando, build e tsc limpos

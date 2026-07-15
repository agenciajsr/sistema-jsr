---
phase: quick-260715-e8w
plan: 01
subsystem: crm
tags: [crm, lead-first, dedup, dnd-kit, drag-and-drop, kanban, zod, drizzle]

requires:
  - phase: quick-260715-0zf
    provides: schema CRM (workspaces/contatos/oportunidades/etapas/atividades), actions de oportunidade, ingest compartilhado, normalizarTelefone
  - phase: quick-260715-1rq
    provides: /crm no visual do mockup (kanban, KPIs, barra de origem), min-w-0 no SidebarInset
provides:
  - Fluxo LEAD-FIRST: "Novo Lead" (nome/empresa/email/telefone/documento/origem/servico/valor/receita/etapa) substitui "Nova oportunidade" de titulo livre
  - Dedup de contato por email OU telefone normalizado: lead repetido reusa o cadastro e abre um NOVO negocio (1 lead -> N negocios)
  - Board com drag-and-drop (@dnd-kit/core), movimento otimista e rollback+toast em erro
  - Colunas VIRTUAIS Ganho/Perdido derivadas do status (zero linha nova em crm_etapas)
  - Ficha do lead (Sheet) com Perfil editavel, Negocios e Historico
  - Migration 0020 GERADA (9 ADD COLUMN) e NAO aplicada
affects: [crm, campanhas, clientes, financeiro]

tech-stack:
  added: ["@dnd-kit/core@6.3.1"]
  patterns:
    - "Lista fechada em constante (SERVICOS_JSR) em vez de tabela quando o dominio muda raramente"
    - "Colunas de board VIRTUAIS derivadas do status (padrao Pipedrive), nunca linhas de etapa"
    - "Ressync de estado otimista por ajuste DURANTE O RENDER (padrao oficial do React), nao setState em useEffect"
    - "Merge conservador no dedup: so preenche campo null, nunca sobrescreve dado ja curado"

key-files:
  created:
    - src/lib/crm/servicos.ts
    - src/lib/crm/mascaras.ts
    - src/lib/crm/mascaras.test.ts
    - src/lib/validations/crm.test.ts
    - src/actions/crm-lead.ts
    - src/components/crm/novo-lead-dialog.tsx
    - src/components/crm/ficha-lead.tsx
    - drizzle/0020_blue_whistler.sql
  modified:
    - src/lib/db/schema.ts
    - src/lib/validations/crm.ts
    - src/lib/crm/dados.ts
    - src/actions/crm.ts
    - src/components/crm/kanban-crm.tsx
    - src/components/crm/card-oportunidade.tsx
    - src/components/crm/crm-view.tsx
    - src/components/crm/kpis-crm.tsx
    - package.json
  deleted:
    - src/components/crm/nova-oportunidade-dialog.tsx

key-decisions:
  - "titulo (NOT NULL, sem campo no form) e DERIVADO na action: `${SERVICOS_JSR[servico]} — ${nome}`. O titulo livre foi explicitamente rejeitado pelo usuario, mas a coluna nao pode ser dropada sem migration destrutiva sobre dados reais."
  - "Dedup faz merge CONSERVADOR: preenche so os campos hoje null (email/telefone/documento/empresa) e nunca sobrescreve dado ja preenchido nem o nome — o cadastro antigo tende a ser o mais curado."
  - "Colunas fechadas tem teto de 50 linhas cada (as mais recentes): Ganho/Perdido so crescem com o tempo. O header mostra o total REAL (do porStatus), entao o numero exibido nunca mente."
  - "Instalado SO @dnd-kit/core, sem @dnd-kit/sortable: reordenar DENTRO da coluna nao e requisito (moverOportunidade ja calcula a ordem no destino) — sortable seria dependencia morta."
  - "KpiCompacto e LOCAL do kpis-crm.tsx: o StatCard compartilhado nao foi alterado porque o dashboard depende dele e ninguem pediu para muda-lo."
  - "Ressync do quadro por ajuste durante o render em vez de useEffect: o lint do repo (corretamente) recusa setState sincrono em efeito por causar render em cascata."
  - "semContato entra como false nas colunas fechadas: e heuristica de negocio ABERTO ('aguardando contato ha +7d') — negocio fechado nao aguarda nada."

patterns-established:
  - "Mascaras BR progressivas puras (mascararTelefone/mascararDocumento): so apresentacao — o dedup usa sempre o telefone normalizado"
  - "Um lead tem N negocios: cada negocio carrega seu proprio servico/valor/etapa/desfecho"
  - "Card do board nao chama action: quem despacha e o board no onDragEnd (fonte unica do movimento)"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08]

duration: 62min
completed: 2026-07-15
---

# Quick 260715-e8w: CRM Lead-First Summary

**O CRM deixou de ser "negocio primeiro": a porta de entrada virou o LEAD (com dedup por email/telefone que reusa o cadastro e abre um novo negocio), Ganho/Perdido viraram colunas virtuais do board, o card anda por drag-and-drop e o clique abre a ficha do lead.**

## Performance

- **Duration:** ~62 min
- **Tasks:** 4/4
- **Files modified:** 17 (8 criados, 8 modificados, 1 deletado)
- **Testes:** 223 passando (17 novos), tsc limpo, build limpo

## Accomplishments

### Task 1 — Fundacao de dados (commit 9801198)

- `SERVICOS_JSR`: lista FECHADA dos 4 servicos da JSR (D-06 — sem tabela, sem seed, sem CRUD).
- `mascararTelefone` / `mascararDocumento`: mascaras BR progressivas, puras, sob **TDD** (10 testes escritos antes da implementacao — vermelho confirmado).
- `leadSchema` (7 testes, TDD): campos do LEAD + `.refine` exigindo email OU telefone (sem identidade nao ha dedup). `leadPerfilSchema` + `ORIGENS_LEAD` (as 6 chaves de `ORIGEM_META`, para o badge do card nao cair no fallback).
- Schema: 8 colunas ADITIVAS nullable em `crm_contatos` + `crm_oportunidades.servico`.
- **Migration 0020 GERADA e NAO aplicada** (9 `ADD COLUMN`, nada destrutivo).

### Task 2 — Backend lead-first (commit 543e600)

- `criarLead`: dedup por email (case-insensitive) → telefone normalizado, reusando os mesmos indices do `processarLead`. Lead existente = merge conservador + **negocio novo mesmo assim**; retorna `leadExistente` para a UI explicar.
- `verificarLeadExistente` (previa leve), `getFichaLead` (perfil + negocios + historico, 3 queries sequenciais), `atualizarLead`.
- `moverParaGanho` / `moverParaPerdido`: wrappers finos sobre a regra existente (nao reimplementam ganho/perda).
- `dados.ts`: `colunasFechadas` + `servico`/`donoNome`/`contatoId`/`qtdAtividades`/`qtdTarefasAbertas`. Contagens por **GROUP BY** (nunca N+1 por card); teto de queries CONSTANTE (12), zero `Promise.all`.

### Task 3 — Novo Lead, ficha e KPIs (commit bc6103a)

- `novo-lead-dialog`: campos do lead, mascaras controladas, aviso inline nao bloqueante quando o lead ja existe.
- `nova-oportunidade-dialog` **DELETADO** — sem referencias orfas em `src/`.
- `ficha-lead`: Sheet com Perfil (editavel), Negocios (todos daquele lead) e Historico.
- `kpis-crm`: `KpiCompacto` local; `StatCard` compartilhado intocado.

### Task 4 — Board (commit e25cd88)

- `@dnd-kit/core` (unica dep nova). 6 etapas + Ganho/Perdido virtuais.
- Movimento otimista com rollback + toast; motivo obrigatorio ao perder (perguntado ANTES de mover — cancelar nao move nem chama action); Ganho/Perdido → etapa reabre (reabrir + mover, SEQUENCIAL).
- Card: nome do lead em destaque, servico, origem, valor, atendente/`Sem atendente`, tempo, atividades. Sem Select, sem Ganhar/Perder. Clique abre a ficha (`activationConstraint: distance 8` separa clique de arrasto).

## Deviations from Plan

### 1. [Rule 3 - Blocking] Worktree estava desatualizado (sem o CRM)

- **Found during:** setup, antes da Task 1
- **Issue:** O worktree isolado deste agente apontava para um commit ANTERIOR a todo o CRM (`src/lib/crm/` inexistente), enquanto o plano referencia esse codigo. O harness impede editar o repo principal.
- **Fix:** `git merge --ff-only master` no worktree (branch sem commits proprios, ancestral limpa de master — zero risco de perda; e o procedimento que a propria memoria do projeto recomenda). Instalado `node_modules` (`npm ci`) e copiado `.env.local` (gitignored) para o build rodar como no repo principal.
- **Impacto:** nenhum no codigo entregue.

### 2. [Rule 3 - Blocking] Task 3 e Task 4 sao acopladas — verify do plano era impossivel de satisfazer como escrito

- **Found during:** Task 3
- **Issue:** A Task 3 manda passar `colunasFechadas` ao `KanbanCrm` ("a prop e criada na Task 4") e remover `etapas`, mas o `verify` da propria Task 3 exige `tsc --noEmit` limpo. Como o card so deixa de precisar de `etapas` na Task 4, os dois requisitos se contradizem.
- **Fix:** a troca da prop foi feita na Task 4 (junto com a reescrita do card/kanban que a torna valida). A Task 3 seguiu passando `etapas`, mantendo **todo commit verde e bissectavel**. O estado final e exatamente o que o plano descreve.

### 3. [Rule 1 - Bug] `setState` sincrono em `useEffect` no board (erro de lint introduzido)

- **Found during:** Task 4
- **Issue:** O plano pede ressincronizar o estado otimista "via `useEffect` quando as props mudarem". Implementado assim, o lint do repo acusou **error**: `Calling setState synchronously within an effect can trigger cascading renders`.
- **Fix:** trocado pelo padrao oficial do React de ajuste de estado **durante o render** (comparando as props anteriores). Mesmo efeito (o `router.refresh()` traz a verdade do server), sem render em cascata e sem pintar o quadro velho.
- **Files:** `src/components/crm/kanban-crm.tsx` — **Commit:** e25cd88

### 4. [Ajuste] Comentario reescrito para nao disparar falso positivo do verify

- O `verify` da Task 3 roda `! grep -q "text-4xl" kpis-crm.tsx`. Um **comentario** que explicava a decisao citava a classe literalmente e reprovava o gate sem nenhum KPI usar esse tamanho. O comentario foi reescrito sem a string literal; o `StatCard` compartilhado segue intocado.

## Campos adicionados ao contrato (alem do listado no plano)

`OportunidadeCard` ganhou tambem `contatoId` e `motivoPerda` — o plano nao os lista na Task 2, mas a Task 4 os exige (`onAbrirFicha(contatoId)` e "mostrar o motivoPerda quando status === 'perdida'"). Sem eles os key_links do proprio plano nao fechariam.

## Known Stubs

Nenhum stub novo. O escopo fechado do plano segue como placeholder HONESTO e inalterado (`title="Em breve"`): visao Lista, Calendario, filtros avancados, seletor de periodo, engrenagem de pipeline, produtos/SKU, ticket medio, anexos. O botao "Adicionar negocio" no rodape das colunas continua inerte (`onAdicionar` opcional, nao passado) — comportamento identico ao de antes desta entrega.

## ⚠️ ACAO NECESSARIA DO ORQUESTRADOR — migration 0020 NAO aplicada

`drizzle/0020_blue_whistler.sql` foi **apenas GERADA**. `drizzle-kit migrate` **nunca** foi executado: a tabela `drizzle.__drizzle_migrations` esta VAZIA e o comando faria replay desde a 0000 sobre os dados reais dos clientes.

**Ate a migration ser aplicada, a /crm QUEBRA** ao ler `crm_oportunidades.servico` (a funcao degrada para `VISAO_VAZIA` via try/catch, entao a pagina mostra o aviso de "nao configurado" em vez de estourar — mas o CRM nao funciona).

Aplicar na mao (script Node pontual, `DIRECT_URL`, dentro de `sql.begin()`), conferindo antes o estado real do banco:

```sql
ALTER TABLE "crm_contatos" ADD COLUMN "documento" text;
ALTER TABLE "crm_contatos" ADD COLUMN "site" text;
ALTER TABLE "crm_contatos" ADD COLUMN "data_nascimento" date;
ALTER TABLE "crm_contatos" ADD COLUMN "cep" text;
ALTER TABLE "crm_contatos" ADD COLUMN "endereco" text;
ALTER TABLE "crm_contatos" ADD COLUMN "cidade" text;
ALTER TABLE "crm_contatos" ADD COLUMN "estado" text;
ALTER TABLE "crm_contatos" ADD COLUMN "notas" text;
ALTER TABLE "crm_oportunidades" ADD COLUMN "servico" text;
```

Migrations 0014/0015/0016/0018 tambem seguem pendentes segundo o STATE.md — conferir a ordem antes de aplicar.

## Verification

| # | Checagem | Resultado |
|---|----------|-----------|
| 1 | `npx tsc --noEmit` | limpo |
| 2 | `npm test` | 223 passando (15 arquivos) |
| 3 | `npm run build` | passa (/crm compila) |
| 4 | sem `NovaOportunidadeDialog`/`nova-oportunidade-dialog` em `src/` | OK |
| 5 | sem `Promise.all` em `crm-lead.ts`/`dados.ts` | OK |
| 6 | `0020_*.sql`: 9 `ADD COLUMN`, sem `DROP`/`ALTER COLUMN`/`DELETE FROM` | OK |
| 7 | sem `crmEtapas` no `kanban-crm.tsx` (colunas virtuais) | OK |
| 8 | Manual (cadastrar Joao 2x, arrastar, ficha) | **PENDENTE** — depende da migration 0020 aplicada |

Lint dos arquivos do CRM: **0 errors**. Restam 2 warnings de `watch()` do react-hook-form — mesmo padrao ja estabelecido no repo (`transacao-form.tsx`, `cliente-form.tsx`). Os 10 lint errors do `src/` sao PRE-EXISTENTES e fora do escopo (chat-ia, theme-toggle, ui/sidebar, use-mobile, kpis-financeiros).

## Self-Check: PASSED

Arquivos criados conferidos em disco e commits conferidos no git (ver secao abaixo).

## Commits

| Task | Commit | Descricao |
|------|--------|-----------|
| 1 | `9801198` | fundacao lead-first — servicos, mascaras, leadSchema, migration 0020 |
| 2 | `543e600` | backend lead-first — criarLead com dedup, wrappers, dados enriquecidos |
| 3 | `bc6103a` | Novo Lead com dedup, ficha do lead e KPIs compactos |
| 4 | `e25cd88` | board com drag-and-drop, colunas virtuais e card do lead |

**Branch:** `worktree-agent-ac75aec9f2a1871df` (fast-forward de `master` em 8724cd5). O orquestrador precisa integrar em `master` — os 4 commits aplicam limpo por `--ff-only` se `master` nao tiver andado.

---
quick_id: 260714-qsy
subsystem: tarefas
tags: [tarefas, recorrencia, clickup, checklist, materializacao-preguicosa, tdd]
requires:
  - src/lib/date-br.ts (hojeBrasilia)
  - src/lib/auth/session.ts (getCurrentUser)
  - src/actions/clientes.ts (getProfiles)
provides:
  - tabelas tarefas + tarefa_checklist_items (migration 0015, NAO aplicada)
  - engine de recorrencia pura e testada (src/lib/tarefas/recorrencia.ts)
  - getTarefasDoDia() com materializacao preguiçosa e idempotente
  - 8 Server Actions de tarefa/checklist
  - tela /tarefas real
affects:
  - src/components/app-sidebar.tsx (item "Checklists" removido)
  - src/app/(app)/checklist/ (rota DELETADA)
tech-stack:
  added: []
  patterns:
    - modulo puro testavel (espelha src/lib/clientes/agregar.ts)
    - queries sequenciais agregadas (espelha src/lib/clientes/lista.ts)
    - Server Actions { data } | { error } (espelha src/actions/checklist.ts)
key-files:
  created:
    - src/lib/tarefas/recorrencia.ts
    - src/lib/tarefas/recorrencia.test.ts
    - src/lib/tarefas/dados.ts
    - src/lib/validations/tarefa.ts
    - src/actions/tarefas.ts
    - src/app/(app)/tarefas/tarefas-lista.tsx
    - src/app/(app)/tarefas/tarefa-sheet.tsx
    - drizzle/0015_workable_hulk.sql
  modified:
    - src/lib/db/schema.ts
    - src/app/(app)/tarefas/page.tsx
    - src/components/app-sidebar.tsx
  deleted:
    - src/app/(app)/checklist/page.tsx
metrics:
  duration: ~25min
  tasks: 3
  commits: 5
  files: 14
  tests: 137 passed (26 novos)
  completed: 2026-07-14
---

# Quick 260714-qsy: Módulo Tarefas (estilo ClickUp) Summary

Módulo Tarefas completo em `/tarefas` — molde recorrente + ocorrências materializadas preguiçosamente (sem cron novo), engine de recorrência pura sob TDD, checklist interno por tarefa; rota `/checklist` eliminada.

## ⚠️ Migration 0015 GERADA e NÃO APLICADA

`drizzle/0015_workable_hulk.sql` foi **gerada** (`npx drizzle-kit generate`) e **não aplicada** — nenhum `drizzle-kit push`/`migrate` rodou. O orquestrador aplica de forma controlada.

Conteúdo (100% aditivo, verificado):
- `CREATE TYPE`: `tarefa_status`, `tarefa_prioridade`, `tarefa_recorrencia`
- `CREATE TABLE`: `tarefas`, `tarefa_checklist_items`
- `ALTER TABLE ... ADD CONSTRAINT`: só FKs das tabelas **novas**
- `CREATE INDEX`: `tarefas_data_status_idx`, `tarefa_checklist_tarefa_id_idx`, e o **UNIQUE** `tarefas_mae_data_idx`

Zero `DROP`. A tabela `checklist_items` (checklist da ficha do cliente) **não é tocada** — só aparece a tabela nova `tarefa_checklist_items`, que é outra coisa.

## O que foi construído

**Task 1 — Schema + engine pura (TDD)**
- 2 tabelas, 3 enums. Modelo MOLDE (`eh_molde=true`, nunca aparece na lista) + ocorrências via `tarefa_mae_id` (D-04).
- `src/lib/tarefas/recorrencia.ts`: `ocorreEm`, `datasDaRegra`, `ocorrenciasFaltantes`, `janelaMaterializacao` + tipos e rótulos pt-BR. **Zero import de db/auth/react/next** (verificado por grep).
- RED→GREEN em 2 commits. **26 testes** (plano pedia 15+), incluindo os casos que mais quebram na prática:
  - `mensal` do dia 31 grampeia em 28/fev e **nunca vaza para 03/03**; volta ao 31 em março.
  - `anual` de 29/fev grampeia em 28/fev em ano comum.
  - `dia_sim_dia_nao` por diferença contra o molde (testado atravessando a virada de mês, onde a lógica por dia-do-mês erraria).
  - Idempotência: chamar 2× somando o resultado da 1ª devolve `[]`.
- Toda aritmética ancorada em **meio-dia UTC** (mesmo truque de `dataMenosDias`) — imune a DST.

**Task 2 — Dados + Actions**
- `getTarefasDoDia()`: **10 queries estritamente sequenciais**, todas agregadas (nenhuma cresce com o nº de tarefas; progresso do checklist em 1 query com `count(*) filter`, não N+1). Zero `Promise.all`.
- Materialização preguiçosa ao abrir `/tarefas`, com **dupla trava de idempotência**: a engine pura filtra o que já existe, e o índice único `(tarefa_mae_id, data)` + `onConflictDoNothing()` derruba a duplicata se dois requests correrem juntos. O `.returning()` devolve só o que realmente nasceu — é ele que decide quais checklists copiar.
- Varredura D-03: ocorrência aberta de dia passado vira `nao_realizada`. **Só ocorrências** (`tarefa_mae_id IS NOT NULL`) — tarefas avulsas atrasadas seguem abertas de propósito e alimentam o bloco "Atrasadas".
- `try/catch` global que loga `[getTarefasDoDia]` e degrada para blocos vazios: a página nunca quebra.
- 8 actions no padrão `{ data } | { error }`, todas com `getCurrentUser()` + Zod + `revalidatePath('/tarefas')`.

**Task 3 — Tela + remoção**
- `/tarefas`: seletor de dia (Hoje/Ontem/Amanhã, senão `dd de MMMM`), blocos Atrasadas/Dia/Concluídas, estado vazio "Nada para hoje 🎉".
- Sheet único cria e edita (nunca `Dialog` — não instalado). Checklist interno, recorrência com os 7 checkboxes na opção personalizada, aviso "afeta toda a série" + "Encerrar recorrência".
- "Atrasadas" só aparece quando o dia selecionado é hoje.
- D-06: rota `/checklist` deletada, item fora do menu, import `CheckSquare` removido.

## Decisões

- **Materialização preguiçosa, não cron** — os 2 slots de cron do plano Hobby da Vercel já estão ocupados (`sync-meta` + `relatorios-semanais`). Abrir `/tarefas` é o **único** caminho de materialização (uma fonte de verdade). Se o plano virar Pro, um cron diário pode assumir sem reescrever nada: `getTarefasDoDia` continua idempotente graças ao índice único.
- **Checklist do sheet carregado sob demanda** (action `getChecklistDaTarefa`, só quando o sheet abre) em vez de trazer os itens de todas as tarefas na query da página. O plano deixava a escolha aberta; esta mantém a listagem barata (a página já traz só o progresso agregado `3/5`).
- **Ocorrência não carrega a regra** (`recorrencia: 'nenhuma'`, regra só no molde) — editar a recorrência de uma ocorrência resolve o alvo para `tarefaMaeId ?? id`.
- **`atualizarRecorrencia` promove a molde**: uma avulsa que vira recorrente recebe `ehMolde: true`, senão nunca materializaria (a query só olha `eh_molde = true`).

## Desvios do plano

**1. [Regra 3 — Bloqueio] Worktree sem `node_modules`**
- Junction para o `node_modules` do repo principal (`mklink /J`) — necessário para rodar build/tsc/vitest. Não versionado (`/node_modules` no .gitignore).

**2. [Regra 1 — Bug] Narrowing do union em `tarefa-sheet.tsx`**
- `'data' in r` não estreitava (TS infere `data?: undefined` no ramo de erro) → TS18048. Resolvido com `const carregados = 'data' in r ? r.data : undefined`.

**3. [Regra 3 — Bloqueio] Falso positivo no gate `! grep "Promise.all"`**
- Meu comentário de aviso continha a literal `Promise.all`, o que reprovaria a própria verificação da Task 2. Reescrito no fraseado de `lista.ts` ("nada de paralelizar com Promise"). Zero ocorrências reais.

**4. Contradição entre dois gates do plano (resolvida a favor do específico)**
- O `<verify>` da Task 2 pede `! grep -n "new Date()" src/lib/tarefas/dados.ts`, mas o item 6 da `<verification>` final diz explicitamente: *"só em `updatedAt`/`concluidaEm` (timestamps), nunca para derivar 'hoje'"*. Mantido **1 uso**, em `updatedAt` da varredura — que é um timestamp, não derivação de data, e segue o padrão do repo (`actions/checklist.ts`). "Hoje" vem sempre de `hojeBrasilia()`.

**5. `checklistMock` NÃO removido (não está órfão)**
- O plano previa que ficaria órfão ao deletar `/checklist`, mas `src/lib/mock/ficha-cliente.ts` ainda o importa. Removê-lo quebraria o build. Mantido.

## V2 — fora do escopo desta entrega (D-08)

- Anexos de arquivo
- Etiquetas
- Quadro Kanban
- Vínculo com o histórico do cliente
- Migração do `checklist_items` da ficha do cliente para o módulo Tarefas
- "Alerta → Tarefa"

## Limite conhecido

Janela de materialização = `hoje-30 .. hoje+60`. Navegar muito para o futuro **não** gera ocorrências além de 60 dias — proposital, evita explosão de linhas se alguém navegar para 2030 (coberto pelo Test 15).

## Verificação

| Item | Resultado |
|------|-----------|
| `npx vitest run` | ✅ 137 testes, 10 arquivos (26 novos) |
| `npx tsc --noEmit` | ✅ zero erros |
| `npm run build` | ✅ limpo; `/tarefas` dinâmica (ƒ), `/checklist` fora do route list |
| Migration 0015 gerada e NÃO aplicada | ✅ |
| `Promise.all` em `src/lib/tarefas/` e `actions/tarefas.ts` | ✅ zero |
| `new Date()` em `dados.ts` | ✅ só `updatedAt` (timestamp) |
| `src/app/(app)/checklist/` | ✅ não existe; menu sem "Checklists" |
| Pureza de `recorrencia.ts` | ✅ zero import de db/auth/react/next |
| `actions/checklist.ts` + `checklist_items` | ✅ intocados (ficha do cliente) |

## Commits

| Hash | Descrição |
|------|-----------|
| 8ed7bcf | test: testes da engine de recorrência (RED) |
| cb1eaa8 | feat: engine de recorrência pura (GREEN, 26 testes) |
| d3d97fe | feat: schema tarefas + tarefa_checklist_items (migration 0015 GERADA) |
| 2090b81 | feat: getTarefasDoDia com materialização preguiçosa + Server Actions |
| 88892a3 | feat: tela /tarefas real e remoção do /checklist |

## Self-Check: PASSED

Todos os 8 arquivos declarados existem em disco, `src/app/(app)/checklist/page.tsx` foi de fato removido, e os 5 commits existem no histórico.

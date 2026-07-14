---
quick_id: 260714-qsy
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - src/lib/db/schema.ts
  - drizzle/0015_*.sql
  - src/lib/tarefas/recorrencia.ts
  - src/lib/tarefas/recorrencia.test.ts
  - src/lib/tarefas/dados.ts
  - src/actions/tarefas.ts
  - src/app/(app)/tarefas/page.tsx
  - src/app/(app)/tarefas/tarefas-lista.tsx
  - src/app/(app)/tarefas/tarefa-sheet.tsx
  - src/components/app-sidebar.tsx
  - src/app/(app)/checklist/page.tsx (REMOVIDO)

must_haves:
  truths:
    - "Em /tarefas o usuário vê as tarefas do dia em blocos: Atrasadas, o dia selecionado, e Concluídas"
    - "O usuário navega entre dias (Hoje por padrão) e vê as tarefas daquele dia"
    - "O usuário cria uma tarefa com título, notas, cliente, responsável, prioridade, data, recorrência e itens de checklist"
    - "O usuário abre uma tarefa e adiciona/marca/remove itens do checklist interno"
    - "O usuário conclui uma tarefa e ela sai do bloco do dia e entra em Concluídas"
    - "Uma tarefa recorrente de dias úteis aparece na segunda mesmo com a de sexta em aberto — e a de sexta fica registrada como Não realizada"
    - "Abrir /tarefas duas vezes seguidas NÃO duplica ocorrências"
    - "O menu lateral não tem mais 'Checklists' e /checklist não existe mais"
  artifacts:
    - path: "src/lib/tarefas/recorrencia.ts"
      provides: "Engine de recorrência PURA (zero import de db/auth/react)"
      exports: ["ocorreEm", "datasDaRegra", "ocorrenciasFaltantes", "janelaMaterializacao"]
    - path: "src/lib/tarefas/recorrencia.test.ts"
      provides: "Testes vitest da engine (dias úteis, dia sim/dia não, personalizada, mensal virando o mês, idempotência)"
    - path: "src/lib/tarefas/dados.ts"
      provides: "getTarefasDoDia() — materialização preguiçosa + leitura, queries SEQUENCIAIS"
      exports: ["getTarefasDoDia"]
    - path: "src/actions/tarefas.ts"
      provides: "Server Actions: criar/editar/concluir tarefa, CRUD do checklist interno"
    - path: "src/app/(app)/tarefas/page.tsx"
      provides: "Server Component da tela real (substitui o EmBreve)"
    - path: "src/app/(app)/tarefas/tarefas-lista.tsx"
      provides: "Client component: seletor de dia + 3 blocos + cards"
    - path: "src/app/(app)/tarefas/tarefa-sheet.tsx"
      provides: "Sheet de criar/editar tarefa com checklist interno e recorrência"
  key_links:
    - from: "src/app/(app)/tarefas/page.tsx"
      to: "src/lib/tarefas/dados.ts"
      via: "await getTarefasDoDia(dia)"
      pattern: "getTarefasDoDia"
    - from: "src/lib/tarefas/dados.ts"
      to: "src/lib/tarefas/recorrencia.ts"
      via: "import da engine pura"
      pattern: "ocorrenciasFaltantes"
    - from: "src/lib/tarefas/dados.ts"
      to: "postgres"
      via: "insert().onConflictDoNothing() no índice único (tarefa_mae_id, data)"
      pattern: "onConflictDoNothing"
    - from: "src/components/app-sidebar.tsx"
      to: "/tarefas"
      via: "item de menu (e AUSÊNCIA de /checklist)"
      pattern: "'/tarefas'"
---

<objective>
Construir o **módulo Tarefas** (estilo ClickUp) em `/tarefas`, substituindo o placeholder "em breve", e **eliminar** a rota/menu `/checklist` — o checklist passa a viver DENTRO da tarefa.

Purpose: A operação diária da agência (onboarding de cliente, revisão de contas de anúncio) hoje mora no ClickUp/planilha. Trazer isso para o Sistema JSR fecha o último buraco entre "ver a saúde do cliente" e "executar a rotina".
Output: 2 tabelas novas + migration GERADA (não aplicada), engine de recorrência pura e testada, camada de dados com materialização preguiçosa (sem cron novo), Server Actions e a tela `/tarefas` completa.
</objective>

<context>
@.planning/STATE.md
@CLAUDE.md

# Padrões OBRIGATÓRIOS deste repo (leia antes de codar):
@src/lib/clientes/lista.ts          # queries agregadas SEQUENCIAIS — nunca Promise.all
@src/lib/clientes/agregar.ts        # módulo PURO testável (zero import de db/auth/react)
@src/lib/date-br.ts                 # hojeBrasilia() — NUNCA new Date() do server p/ "hoje"
@src/app/(app)/clientes/clientes-lista.tsx  # padrão de client component com abas/busca
@src/actions/checklist.ts           # padrão de Server Action ({ data } | { error })
@src/lib/db/schema.ts
@src/components/app-sidebar.tsx
</context>

<interfaces>
<!-- Contratos existentes que o executor VAI usar. Não precisa explorar o codebase. -->

De `@/lib/date-br`:
```ts
export function hojeBrasilia(): string            // 'YYYY-MM-DD' no fuso de Brasília
export function dataMenosDias(n: number, base?: string): string  // âncora T12:00:00Z (à prova de DST)
```

De `@/lib/auth/session`:
```ts
export type CurrentUser = { id: string; email: string | undefined; nome: string; role: 'admin' | 'membro' }
export const getCurrentUser: () => Promise<CurrentUser | null>   // memoizado com React cache()
```

De `@/actions/clientes`:
```ts
export async function getProfiles(): Promise<{ id: string; nome: string }[]>
```

Padrão de retorno das Server Actions (ver `src/actions/checklist.ts`):
```ts
{ data: T } | { error: string }
```

**Componentes shadcn DISPONÍVEIS** (`src/components/ui/`): alert-dialog, avatar, badge, button, card,
chart, checkbox, dropdown-menu, form, input, label, progress, select, separator, **sheet**, sidebar,
skeleton, sonner, table, tabs, textarea, tooltip.
⚠️ **`dialog` NÃO está instalado** e não deve ser adicionado (precedente: "ContratoForm evita o
componente Dialog do shadcn"). Use **`sheet`** para o detalhe/criação da tarefa.

Comandos: `npm run build` · `npx tsc --noEmit` · `npx vitest run` · `npx drizzle-kit generate`
</interfaces>

<decisoes_travadas>
Decisões do usuário — NÃO revisitar:

- **D-01** Status (4, exatos): `a_fazer` · `em_andamento` · `concluida` · `nao_realizada`.
- **D-02** Prioridade: `baixa` · `media` · `alta` · `urgente`.
- **D-03** Recorrência nasce pelo **CALENDÁRIO, não pelo check**. A de ontem não concluída vira
  `nao_realizada`; a de hoje aparece do mesmo jeito.
- **D-04** Modelo: tarefa **MOLDE** (recorrente) + **ocorrências** geradas apontando para ele via `tarefaMaeId`.
- **D-05** **SEM CRON NOVO** — os 2 slots do plano Hobby já estão em uso (`vercel.json`: sync-meta +
  relatorios-semanais). Materialização **PREGUIÇOSA** ao abrir `/tarefas`. Idempotente.
- **D-06** O menu "Checklists" **deixa de existir**; a rota `src/app/(app)/checklist/` é deletada.
- **D-07** Engine de recorrência = módulo PURO em `src/lib/tarefas/recorrencia.ts`, **TDD obrigatório**.
- **D-08 (FORA DO ESCOPO V1)**: anexos de arquivo, etiquetas, quadro Kanban, vínculo com histórico do
  cliente, migração do `checklist_items` existente, "Alerta → Tarefa". Registrar no SUMMARY como V2.
</decisoes_travadas>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Schema (2 tabelas + 3 enums), migration 0015 GERADA e engine de recorrência PURA sob TDD</name>
  <files>src/lib/db/schema.ts, src/lib/tarefas/recorrencia.ts, src/lib/tarefas/recorrencia.test.ts, drizzle/0015_*.sql</files>

  <behavior>
    Escreva `src/lib/tarefas/recorrencia.test.ts` PRIMEIRO (RED), depois implemente. Casos obrigatórios:

    `ocorreEm(regra, dataMolde, data)`:
    - Test 1 — `dias_uteis`: molde 2026-07-13 (segunda). Ocorre 13/14/15/16/17 (seg→sex);
      NÃO ocorre 18 (sáb) nem 19 (dom); ocorre 20 (segunda seguinte).
    - Test 2 — `dia_sim_dia_nao`: molde 2026-07-13. Ocorre 13, 15, 17, 19; NÃO ocorre 14, 16, 18.
      (paridade pela diferença de dias contra o molde, não pelo dia do mês).
    - Test 3 — `personalizada` com `dias: [1,2,3]` (seg/ter/qua): ocorre 13/14/15; NÃO ocorre 16/17/18/19.
      Convenção: 0=domingo … 6=sábado.
    - Test 4 — `semanal`: molde numa terça → só ocorre às terças.
    - Test 5 — `mensal` virando o mês: molde 2026-01-31 → ocorre em 2026-02-28 (fevereiro não tem 31;
      **grampeia no último dia do mês**, NUNCA vaza para 2026-03-03), e em 2026-03-31.
    - Test 6 — `anual`: molde 2026-07-14 → ocorre 2027-07-14, não 2027-07-15.
    - Test 7 — `diaria`: ocorre todo dia.
    - Test 8 — nunca ocorre ANTES da data do molde (data < dataMolde ⇒ false, em toda regra).

    `ocorrenciasFaltantes({ molde, existentes, de, ate })` → `string[]`:
    - Test 9 — devolve as datas da regra dentro de [de, ate] que NÃO estão em `existentes`.
    - Test 10 (IDEMPOTÊNCIA) — se `existentes` já cobre toda a janela, devolve `[]`.
    - Test 11 — chamar 2× com o resultado da 1ª somado a `existentes` devolve `[]` (simula abrir 2×).
    - Test 12 — `recorrencia: 'nenhuma'` devolve `[]` (tarefa avulsa não materializa nada).

    `janelaMaterializacao(hoje, diaSelecionado)` → `{ de: string; ate: string }`:
    - Test 13 — dia selecionado = hoje ⇒ `de = hoje-30`, `ate = hoje`.
    - Test 14 — dia selecionado no futuro próximo (hoje+7) ⇒ `ate = hoje+7`.
    - Test 15 (TETO) — dia selecionado muito no futuro (hoje+400) ⇒ `ate` grampeado em `hoje+60`.
      Impede explosão de linhas se alguém navegar para 2030.
  </behavior>

  <action>
    **1a. Schema** — em `src/lib/db/schema.ts`, ADITIVO (não tocar em `checklist_items`, que é V2):

    ```ts
    export const tarefaStatusEnum = pgEnum('tarefa_status', ['a_fazer', 'em_andamento', 'concluida', 'nao_realizada'])          // D-01
    export const tarefaPrioridadeEnum = pgEnum('tarefa_prioridade', ['baixa', 'media', 'alta', 'urgente'])                      // D-02
    export const tarefaRecorrenciaEnum = pgEnum('tarefa_recorrencia', ['nenhuma', 'diaria', 'semanal', 'mensal', 'anual', 'dia_sim_dia_nao', 'dias_uteis', 'personalizada'])

    export const tarefas = pgTable('tarefas', {
      id: uuid('id').primaryKey().defaultRandom(),
      titulo: text('titulo').notNull(),
      notas: text('notas'),
      status: tarefaStatusEnum('status').notNull().default('a_fazer'),
      prioridade: tarefaPrioridadeEnum('prioridade').notNull().default('media'),
      data: date('data').notNull(),                       // vencimento, 'YYYY-MM-DD'
      clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
      responsavelId: uuid('responsavel_id').references(() => profiles.id, { onDelete: 'set null' }),
      recorrencia: tarefaRecorrenciaEnum('recorrencia').notNull().default('nenhuma'),
      recorrenciaDias: jsonb('recorrencia_dias'),          // number[] p/ 'personalizada' (0=dom..6=sab)
      ehMolde: boolean('eh_molde').notNull().default(false),   // true = tarefa MOLDE (D-04)
      tarefaMaeId: uuid('tarefa_mae_id').references((): any => tarefas.id, { onDelete: 'cascade' }),
      ativa: boolean('ativa').notNull().default(true),     // no MOLDE: false = recorrência encerrada
      concluidaEm: timestamp('concluida_em', { withTimezone: true }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    }, (table) => ({
      dataStatusIdx: index('tarefas_data_status_idx').on(table.data, table.status),
      // ⚠️ GARANTIA DE IDEMPOTÊNCIA NO BANCO (D-05): uma ocorrência por molde por dia.
      // NULLs não conflitam entre si no Postgres → tarefas avulsas (tarefa_mae_id NULL)
      // não são afetadas por esta restrição.
      maeDataIdx: uniqueIndex('tarefas_mae_data_idx').on(table.tarefaMaeId, table.data),
    }))

    export const tarefaChecklistItems = pgTable('tarefa_checklist_items', {
      id: uuid('id').primaryKey().defaultRandom(),
      tarefaId: uuid('tarefa_id').notNull().references(() => tarefas.id, { onDelete: 'cascade' }),
      texto: text('texto').notNull(),
      concluido: boolean('concluido').notNull().default(false),
      ordem: integer('ordem').notNull().default(0),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    }, (table) => ({
      tarefaIdx: index('tarefa_checklist_tarefa_id_idx').on(table.tarefaId),
    }))
    ```
    Adicione as `relations` seguindo o padrão do arquivo (tarefas→cliente/responsavel/checklistItems;
    tarefaChecklistItems→tarefa). Deixe `clientesRelations` com `tarefas: many(tarefas)`.

    **1b. Engine PURA** — `src/lib/tarefas/recorrencia.ts`, cabeçalho igual ao de `agregar.ts`:
    `// Módulo PURO: zero import de db/auth/react/next.`
    Exporte os tipos (`TarefaRecorrencia`, `TarefaStatus`, `TarefaPrioridade`, `RegraRecorrencia`) e as
    rótulos em pt-BR (`RECORRENCIA_LABEL`, `STATUS_LABEL`, `PRIORIDADE_LABEL`) — o client component vai
    importar daqui, então NADA de import de servidor.

    Regras de implementação:
    - Datas SEMPRE como string 'YYYY-MM-DD'. Toda aritmética ancorada em **meio-dia UTC**
      (`new Date(\`${data}T12:00:00Z\`)` + `setUTCDate`), mesmo truque de `dataMenosDias` — imune a DST.
    - `dias_uteis`: dia da semana (UTC) entre 1 e 5.
    - `dia_sim_dia_nao`: `diffDias(dataMolde, data) % 2 === 0`.
    - `personalizada`: `dias.includes(getUTCDay(data))`. `dias` vazio/ausente ⇒ nunca ocorre.
    - `mensal`: mesmo dia do mês do molde, **grampeado no último dia do mês** quando o mês é curto
      (31 jan → 28 fev). Idem `anual` (29/fev → 28/fev em ano comum).
    - `datasDaRegra(regra, dataMolde, de, ate)`: itera dia a dia chamando `ocorreEm` — a janela é
      curta (≤ 91 dias por `janelaMaterializacao`), simplicidade > esperteza.
    - `janelaMaterializacao(hoje, diaSelecionado)`: `de = hoje-30`; `ate = min(max(hoje, diaSelecionado), hoje+60)`.

    **1c. Migration** — rodar `npx drizzle-kit generate`. Vai sair `drizzle/0015_*.sql`.
    ⚠️ **NÃO APLICAR** (`npx drizzle-kit push`/`migrate` é PROIBIDO aqui) — o orquestrador aplica de
    forma controlada. Confira lendo o SQL: só `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX`
    (aditivo). Se aparecer qualquer `DROP` ou `ALTER ... checklist_items`, PARE e reporte.
  </action>

  <verify>
    <automated>npx vitest run src/lib/tarefas/recorrencia.test.ts &amp;&amp; npx tsc --noEmit &amp;&amp; ls drizzle/0015_*.sql &amp;&amp; ! grep -iE "DROP |checklist_items" drizzle/0015_*.sql</automated>
  </verify>
  <done>15+ testes passando (RED→GREEN documentado em 2 commits); `drizzle/0015_*.sql` existe, é 100% aditivo e NÃO foi aplicado; `tsc --noEmit` limpo; `recorrencia.ts` sem nenhum import de db/auth/react.</done>
</task>

<task type="auto">
  <name>Task 2: Camada de dados com materialização preguiçosa (queries sequenciais) + Server Actions</name>
  <files>src/lib/tarefas/dados.ts, src/actions/tarefas.ts</files>

  <action>
    **2a. `src/lib/tarefas/dados.ts`** — módulo server comum, **SEM `'use server'`** (é chamado direto
    pelo Server Component da página; ver o cabeçalho de `src/lib/clientes/lista.ts` e replicar o aviso).

    ```ts
    export type TarefaCard = {
      id: string; titulo: string; notas: string | null
      status: TarefaStatus; prioridade: TarefaPrioridade; data: string
      clienteId: string | null; clienteNome: string | null
      responsavelId: string | null; responsavelNome: string | null
      recorrencia: TarefaRecorrencia; recorrenciaDias: number[] | null
      tarefaMaeId: string | null
      checklistTotal: number; checklistConcluidos: number
    }
    export type TarefasDoDia = { dia: string; hoje: string; atrasadas: TarefaCard[]; doDia: TarefaCard[]; concluidas: TarefaCard[] }

    export async function getTarefasDoDia(diaSelecionado?: string): Promise<TarefasDoDia>
    ```

    ⚠️⚠️ **QUERIES SEQUENCIAIS — NUNCA `Promise.all` dentro desta função.** Pool `max:3`,
    `max_pipeline:0`: queries paralelas na mesma conexão penduram PARA SEMPRE (causa raiz dos
    travamentos dos quicks 260713-usi e 260714-ita). Uma query por vez, `await` a `await`.

    "Hoje" = `hojeBrasilia()`. `diaSelecionado` default = hoje. Comparação de datas como string ISO.
    Envolva TUDO num `try/catch` que loga `[getTarefasDoDia]` e devolve blocos vazios — a página degrada,
    nunca quebra (mesmo contrato de `getClientesLista`).

    Ordem exata (9 queries sequenciais, nenhuma cresce com o nº de tarefas):
    1. `const { de, ate } = janelaMaterializacao(hoje, dia)` (puro, sem query).
    2. **SELECT moldes**: `where(and(eq(tarefas.ehMolde, true), eq(tarefas.ativa, true)))`.
    3. **SELECT ocorrências já materializadas** desses moldes na janela:
       `select({ tarefaMaeId, data }).where(and(inArray(tarefas.tarefaMaeId, ids), gte(data, de), lte(data, ate)))`.
       Pule 3–6 se não houver molde.
    4. Para cada molde, `ocorrenciasFaltantes({ molde, existentes, de, ate })` (**puro, em memória**).
    5. **INSERT em lote** das ocorrências faltantes (uma única query com array de values):
       herda titulo/notas/prioridade/clienteId/responsavelId do molde; `ehMolde: false`,
       `recorrencia: 'nenhuma'` (a regra vive só no molde — D-04), `tarefaMaeId: molde.id`,
       `status: 'a_fazer'`, `data: <data gerada>`.
       ⚠️ **`.onConflictDoNothing()`** + `.returning({ id, tarefaMaeId, data })`.
       Esta é a trava de corrida: se dois requests abrirem `/tarefas` ao mesmo tempo, o índice único
       `tarefas_mae_data_idx` derruba a duplicata e o `returning` só devolve o que REALMENTE nasceu.
    6. **SELECT + INSERT dos itens de checklist copiados**: cada ocorrência precisa da SUA cópia dos
       itens do molde (a rotina "revisar contas" tem os mesmos passos todo dia, marcáveis por dia).
       Uma SELECT dos itens dos moldes + uma INSERT em lote das cópias, só para os ids do `returning`
       do passo 5. Se o `returning` veio vazio, pule as duas.
    7. **UPDATE varredura (D-03)**: `set({ status: 'nao_realizada', updatedAt: new Date() })`
       `.where(and(isNotNull(tarefas.tarefaMaeId), lt(tarefas.data, hoje), inArray(tarefas.status, ['a_fazer','em_andamento'])))`.
       **Só ocorrências** (`tarefaMaeId IS NOT NULL`): a próxima nasce pelo calendário, não pelo check.
       Tarefas AVULSAS atrasadas continuam abertas de propósito — são elas que alimentam o bloco "Atrasadas".
    8. **SELECT do dia**: `where(and(eq(tarefas.ehMolde, false), eq(tarefas.data, dia)))`,
       `leftJoin(clientes)`, `leftJoin(profiles)`, `orderBy` prioridade desc + createdAt asc.
    9. **SELECT atrasadas**: `where(and(eq(ehMolde,false), lt(data, hoje), inArray(status, ['a_fazer','em_andamento'])))` + os mesmos joins.
    10. **SELECT progresso do checklist AGREGADO** (1 query, não N+1):
        `select({ tarefaId, total: sql<number>\`count(*)::int\`, feitos: sql<number>\`count(*) filter (where ${tarefaChecklistItems.concluido})::int\` })`
        `.where(inArray(tarefaChecklistItems.tarefaId, todosOsIds)).groupBy(tarefaId)`. Merge em memória.

    Separação dos blocos (em memória, sem query extra):
    - `doDia` = status `a_fazer` | `em_andamento`;
    - `concluidas` = status `concluida` | `nao_realizada` (o `nao_realizada` recebe badge próprio na UI);
    - `atrasadas` = resultado da query 9 (relativo ao HOJE real, não ao dia selecionado).

    **2b. `src/actions/tarefas.ts`** — `'use server'`, padrão `{ data } | { error }` de
    `src/actions/checklist.ts`: toda action começa com `getCurrentUser()` → se null,
    `{ error: 'Sessao expirada. Faca login novamente.' }`. Toda mutação termina com
    `revalidatePath('/tarefas')`. Valide a entrada com Zod (`src/lib/validations/tarefa.ts` se preferir
    separar, seguindo `validations/transacao.ts`).

    - `criarTarefa(input)` — titulo obrigatório (trim, não vazio); data 'YYYY-MM-DD' (default `hojeBrasilia()`).
      Se `recorrencia === 'nenhuma'`: insere UMA tarefa (`ehMolde: false`) + os itens de checklist informados.
      Se `recorrencia !== 'nenhuma'`: insere o **MOLDE** (`ehMolde: true`, `ativa: true`) + os itens de
      checklist NO MOLDE. **Não materialize aqui** — o próximo `getTarefasDoDia` faz isso e é o único
      caminho de materialização (uma fonte de verdade, D-05).
    - `atualizarTarefa(id, campos)` — titulo/notas/prioridade/data/clienteId/responsavelId/status.
      Ao setar `status: 'concluida'`, grave `concluidaEm: new Date()`; ao sair de concluída, volte a null.
    - `atualizarRecorrencia(id, { recorrencia, recorrenciaDias, ativa })` — **resolva o alvo**:
      se a tarefa tem `tarefaMaeId`, aplique no MOLDE (`alvo = tarefaMaeId ?? id`). Editar a recorrência
      de uma ocorrência é editar a regra da série. `ativa: false` encerra a série (para de materializar).
    - `addChecklistItemTarefa(tarefaId, texto)` / `toggleChecklistItemTarefa(id, concluido)` /
      `deleteChecklistItemTarefa(id)` — `ordem` = `count` atual no add.
    - `deletarTarefa(id)` — o `onDelete: 'cascade'` do `tarefaMaeId` já apaga a série ao apagar o molde.

    Nada de `Promise.all` interno nas actions (mesma regra do pool).
  </action>

  <verify>
    <automated>npx tsc --noEmit &amp;&amp; ! grep -n "Promise.all" src/lib/tarefas/dados.ts src/actions/tarefas.ts &amp;&amp; grep -q "onConflictDoNothing" src/lib/tarefas/dados.ts &amp;&amp; grep -q "hojeBrasilia" src/lib/tarefas/dados.ts &amp;&amp; ! grep -n "new Date()" src/lib/tarefas/dados.ts</automated>
  </verify>
  <done>`getTarefasDoDia()` compila, usa `hojeBrasilia()` (zero `new Date()` para "hoje"), roda queries estritamente sequenciais, materializa com `onConflictDoNothing()` e varre atrasadas só de ocorrências; `src/actions/tarefas.ts` expõe as 7 actions com o padrão `{ data } | { error }`.</done>
</task>

<task type="auto">
  <name>Task 3: Tela /tarefas (seletor de dia, 3 blocos, sheet de detalhe) + remoção do /checklist</name>
  <files>src/app/(app)/tarefas/page.tsx, src/app/(app)/tarefas/tarefas-lista.tsx, src/app/(app)/tarefas/tarefa-sheet.tsx, src/components/app-sidebar.tsx, src/app/(app)/checklist/page.tsx</files>

  <action>
    **NÃO invente design novo** — reproduza o padrão visual de `clientes-lista.tsx` (Card, Badge, Tabs,
    Input, Button, cores semânticas de `globals.css` como `bg-chart-success` / `bg-chart-warning`).

    **3a. `page.tsx`** (Server Component; apaga o `EmBreve`):
    ```tsx
    export const maxDuration = 60   // backstop do timeout de 300s da Vercel — manter
    export default async function TarefasPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
      const { dia } = await searchParams          // Next 16: searchParams é Promise
      const dados = await getTarefasDoDia(dia)
      const [clientesLista, profilesLista] = ... // SEQUENCIAL: await um, depois o outro. Sem Promise.all.
      return <TarefasLista dados={dados} clientes={clientesLista} responsaveis={profilesLista} />
    }
    ```
    Cabeçalho: `<h1 className="text-[28px] leading-tight font-semibold">Tarefas</h1>` + botão "Nova Tarefa"
    (mesmo layout do header de `/clientes`). Clientes via `db.select({id,nome}).from(clientes)`;
    responsáveis via `getProfiles()` de `@/actions/clientes`.

    **3b. `tarefas-lista.tsx`** (`'use client'`):
    - **Seletor de dia no topo**: `‹ [Hoje ▸ 14 de julho] ›` — botões ◂/▸ que fazem
      `router.push('/tarefas?dia=YYYY-MM-DD')`, mais um botão "Hoje" que volta para `/tarefas`.
      Rótulo do dia: "Hoje" / "Ontem" / "Amanhã" quando aplicável, senão `dd 'de' MMMM` com
      `date-fns` + locale `ptBR`. **Nunca** derive o dia com `new Date()` — use `dados.hoje` (que veio de
      `hojeBrasilia()` no servidor) e faça a aritmética sobre a string.
    - **3 blocos**, cada um com título + contagem, escondidos quando vazios:
      1. **Atrasadas** — renderizar **somente quando `dados.dia === dados.hoje`** (num dia passado o
         conceito de "atrasada" confunde). Título em `text-destructive`.
      2. **{rótulo do dia}** — `dados.doDia`.
      3. **Concluídas** — `dados.concluidas` (inclui `nao_realizada`, com badge próprio cinza/destrutivo
         "Não realizada" e título com `line-through`).
    - **Card da tarefa** (Card clicável, `cursor-pointer hover:bg-muted/40`, `tabIndex={0}`, Enter abre):
      Checkbox à esquerda (marca `concluida` via `atualizarTarefa`, com `useTransition`) · título ·
      Badge de prioridade (urgente=`bg-destructive`, alta=`bg-chart-warning text-white`,
      media=`variant="secondary"`, baixa=`variant="outline"`) · Badge de status · nome do cliente ·
      nome do responsável · progresso do checklist `3/5` (só quando `checklistTotal > 0`; use `Progress`
      ou texto `tabular-nums`) · ícone de repetição (lucide `Repeat`) quando `tarefaMaeId !== null`.
      Use `stopPropagation` no checkbox para ele não abrir o sheet (padrão do `⋯` em `clientes-lista.tsx`).
    - **Estado vazio simpático** quando os 3 blocos estão vazios: card tracejado
      (`rounded-xl border border-dashed p-12 text-center`), "Nada para hoje 🎉" / "Nada para este dia" +
      "Aproveite — ou crie uma tarefa para não esquecer." + botão "Nova Tarefa".

    **3c. `tarefa-sheet.tsx`** (`'use client'`) — **UM** componente serve criar E editar (`tarefa?: TarefaCard`).
    Use **`Sheet`** (`side="right"`), NÃO `Dialog` (não instalado — ver `<interfaces>`).
    - Campos: `titulo` (Input) · `notas` (Textarea) · `cliente` (Select, com opção "Nenhum") ·
      `responsavel` (Select, "Nenhum") · `prioridade` (Select, D-02) · `data` (`<Input type="date">`) ·
      `status` (Select, D-01 — só na edição).
    - **Recorrência**: Select com os 8 valores (rótulos de `RECORRENCIA_LABEL`). Quando
      `personalizada`, mostrar 7 Checkboxes (D S T Q Q S S → 0..6) que alimentam `recorrenciaDias`.
      Na EDIÇÃO de uma ocorrência, um aviso discreto: "Alterar a recorrência afeta toda a série."
      (a action já resolve `tarefaMaeId ?? id`) + botão "Encerrar recorrência" (`ativa: false`).
    - **Checklist interno**: lista de itens com Checkbox + texto (`line-through` quando concluído) +
      botão de remover (ícone `Trash2`); Input + Enter/botão "Adicionar item". Na CRIAÇÃO os itens
      vivem em `useState` e vão junto no `criarTarefa`; na EDIÇÃO cada ação chama a Server Action
      correspondente. Não é preciso `getTarefaDetalhe` — a `page.tsx` já pode passar os itens junto se
      quiser, ou o sheet os recebe via prop do card. Escolha o caminho mais simples e documente.
    - Feedback com `toast` (sonner, já instalado). `useTransition` para os estados de "salvando".

    **3d. Remoções (D-06)** — nesta ordem:
    - `rm -rf "src/app/(app)/checklist"` (a rota inteira).
    - Em `src/components/app-sidebar.tsx`: apagar a linha
      `{ title: 'Checklists', url: '/checklist', icon: CheckSquare }` **e** o import de `CheckSquare`
      (senão o ESLint quebra o build por import não usado). O item `Tarefas` → `/tarefas` já existe e
      agora aponta para o módulo real — mantenha como está.
    - `grep -rn "/checklist" src/` para garantir que nenhum link órfão sobrou. ⚠️ **NÃO** confundir com
      `src/actions/checklist.ts` e a tabela `checklist_items`: são o checklist DA FICHA DO CLIENTE, que
      continua vivo e intocado (migração dele é V2 — D-08).
    - `checklistMock` em `src/lib/mock/extra.ts` fica órfão: pode remover se nada mais o importa
      (`grep -rn "checklistMock" src/`).

    **3e. Commits** — arquivos específicos, **NUNCA `git add -A`**.
  </action>

  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npx vitest run &amp;&amp; npm run build &amp;&amp; test ! -d "src/app/(app)/checklist" &amp;&amp; ! grep -rn "url: '/checklist'" src/ &amp;&amp; ! grep -rn "EmBreve" "src/app/(app)/tarefas/"</automated>
  </verify>
  <done>`npm run build` + `npx tsc --noEmit` + `npx vitest run` verdes; `/tarefas` renderiza seletor de dia, 3 blocos e estado vazio; sheet cria/edita tarefa com checklist e recorrência; `src/app/(app)/checklist/` não existe e o menu não tem mais "Checklists".</done>
</task>

</tasks>

<verification>
Checagem final antes do SUMMARY:

1. `npx vitest run` — toda a suíte verde (a de recorrência inclusa, 15+ casos).
2. `npx tsc --noEmit` — zero erros.
3. `npm run build` — build limpo. **Não concluir com build quebrado.**
4. `git status` — `drizzle/0015_*.sql` existe e **NÃO foi aplicado** (nenhum `drizzle-kit push`/`migrate` rodou).
5. `grep -rn "Promise.all" src/lib/tarefas/ src/actions/tarefas.ts` — **zero ocorrências**.
6. `grep -rn "new Date()" src/lib/tarefas/dados.ts` — só em `updatedAt`/`concluidaEm` (timestamps), **nunca** para derivar "hoje".
7. `test ! -d "src/app/(app)/checklist"` e `grep -rn "/checklist" src/` — só sobram `actions/checklist.ts` e `checklist_items` (ficha do cliente, intocados).
8. `grep -rn "from '@/lib/db'\|next/\|react" src/lib/tarefas/recorrencia.ts` — **zero** (módulo puro).
</verification>

<success_criteria>
- [ ] 2 tabelas (`tarefas`, `tarefa_checklist_items`) + 3 enums no schema; migration `0015_*.sql` **gerada e não aplicada**, 100% aditiva, sem tocar em `checklist_items`
- [ ] `src/lib/tarefas/recorrencia.ts` é puro e passa nos 15+ testes: dias úteis pulando fim de semana, dia sim/dia não, personalizada por dias da semana, mensal grampeando no fim do mês, e idempotência (2 chamadas ⇒ zero duplicata)
- [ ] Materialização preguiçosa em `getTarefasDoDia`: **sem cron novo**, queries sequenciais, `onConflictDoNothing()` sobre o índice único `(tarefa_mae_id, data)`
- [ ] Ocorrência aberta de dia passado vira `nao_realizada` e a do dia aparece do mesmo jeito (D-03)
- [ ] `/tarefas` real: seletor de dia, blocos Atrasadas/Dia/Concluídas, criar/editar/concluir tarefa, checklist interno funcionando, estado vazio simpático
- [ ] `/checklist` deletado e "Checklists" fora do menu
- [ ] `npm run build` + `npx tsc --noEmit` + `npx vitest run` verdes
</success_criteria>

<output>
Ao concluir, criar `.planning/quick/260714-qsy-modulo-tarefas-estilo-clickup-checklist-/260714-qsy-SUMMARY.md`.

Registrar OBRIGATORIAMENTE no SUMMARY:
- **⚠️ Migration `0015_*.sql` GERADA e NÃO APLICADA** — o orquestrador aplica.
- **V2 (fora do escopo desta entrega — D-08)**: anexos de arquivo, etiquetas, quadro Kanban, vínculo
  com o histórico do cliente, migração do `checklist_items` da ficha do cliente para o módulo Tarefas,
  e "Alerta → Tarefa".
- **Decisão a documentar**: a materialização é preguiçosa (na abertura de `/tarefas`) porque os 2 slots
  de cron do plano Hobby da Vercel já estão ocupados (`sync-meta` + `relatorios-semanais`). Se um dia
  o plano virar Pro, um cron diário pode assumir a materialização — `getTarefasDoDia` continua
  idempotente de qualquer jeito graças ao índice único.
- **Limite conhecido**: a janela de materialização é `hoje-30 .. hoje+60`. Navegar muito para o futuro
  não gera ocorrências além de 60 dias (proposital, evita explosão de linhas).
</output>
</content>
</invoke>

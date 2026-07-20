---
phase: quick-260719-rah
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/tarefas/nova/nova-tarefa-form.tsx
autonomous: true
requirements: [QUICK-RAH-01, QUICK-RAH-02]
must_haves:
  truths:
    - "A página /tarefas/nova tem apenas UM botão Voltar (o BotaoVoltar da page)"
    - "A grade de metadados da criação tem o mesmo desenho do detalhe: 2 colunas, linhas com ícone + rótulo (w-32) + valor inline"
    - "Todos os campos existentes continuam presentes e a criação funciona igual (criarTarefa inalterada)"
  artifacts:
    - path: "src/app/(app)/tarefas/nova/nova-tarefa-form.tsx"
      provides: "Form de criação no layout ClickUp"
      contains: "w-32 shrink-0"
  key_links:
    - from: "src/app/(app)/tarefas/nova/nova-tarefa-form.tsx"
      to: "src/actions/tarefas"
      via: "criarTarefa (payload inalterado)"
      pattern: "criarTarefa\\("
---

<objective>
Alinhar /tarefas/nova ao layout ClickUp já aplicado no detalhe da tarefa (quick 260719-qr2) e remover o botão "Voltar" duplicado.

Purpose: consistência visual entre criação e detalhe; eliminar UI redundante.
Output: nova-tarefa-form.tsx reformado (grade 2 colunas estilo ClickUp, sem Voltar interno).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/(app)/tarefas/nova/nova-tarefa-form.tsx
@src/app/(app)/tarefas/nova/page.tsx
@src/app/(app)/tarefas/[id]/tarefa-detalhe.tsx
@.planning/quick/260719-qr2-detalhe-da-tarefa-no-layout-clickup-pain/260719-qr2-SUMMARY.md

<interfaces>
Referência de estilo (tarefa-detalhe.tsx, linhas ~670-881 — copiar o padrão):

```tsx
// Grade de metadados estilo ClickUp: 2 colunas, ícone + rótulo à esquerda, valor à direita
<div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
  {/* Cada linha: */}
  <div className="flex items-center gap-2 py-2">
    <span className="flex w-32 shrink-0 items-center gap-2 text-sm text-muted-foreground">
      <CircleDot className="size-4" />
      Status
    </span>
    {/* valor inline: Select/Input com SELECT_CELULA / DATA_CELULA */}
  </div>
</div>
```

Ícones usados no detalhe por linha: Status=CircleDot, Datas=CalendarDays (Início → ChevronRight → Prazo na mesma linha), Estimativa=Clock, Responsável=Users, Prioridade=Flag, Etiquetas=Tag, Cliente=Building2. As constantes SELECT_CELULA e DATA_CELULA já existem em nova-tarefa-form.tsx (linhas 79-80) com os mesmos valores do detalhe.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remover o botão "Voltar" duplicado do form</name>
  <files>src/app/(app)/tarefas/nova/nova-tarefa-form.tsx</files>
  <action>
    Na barra superior do form (linhas ~174-195), remover o `<Button variant="ghost" asChild>` com `<Link href="/tarefas"><ArrowLeft/>Voltar</Link>` (linhas ~177-182). O padrão do projeto é o `BotaoVoltar` renderizado pela page (page.tsx linha 46) — a page NÃO muda.
    Manter o breadcrumb "Tarefas › Nova Tarefa" e o botão "Criar tarefa" na barra. Remover o import de `ArrowLeft` (fica órfão). `Link` continua usado pelo breadcrumb — manter.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>Só existe um caminho "Voltar" na página (BotaoVoltar da page); sem imports mortos; tsc limpo.</done>
</task>

<task type="auto">
  <name>Task 2: Grade de metadados no layout ClickUp do detalhe</name>
  <files>src/app/(app)/tarefas/nova/nova-tarefa-form.tsx</files>
  <action>
    Substituir a grade antiga de 8 células com divisórias (`grid grid-cols-2 divide-x divide-y ... md:grid-cols-4`, linhas ~225-370) pela grade do detalhe: `grid grid-cols-1 gap-x-10 md:grid-cols-2`, com linhas `flex items-center gap-2 py-2` e rótulo `<span className="flex w-32 shrink-0 items-center gap-2 text-sm text-muted-foreground"><Icone className="size-4"/>Rótulo</span>` (ver bloco interfaces).

    Distribuição igual ao detalhe:
    - Coluna 1: Status (CircleDot + Select com Badge STATUS_CLASSE), Datas (CalendarDays + Input date início → ChevronRight → Input date prazo na mesma linha), Estimativa (Clock + Input "4h")
    - Coluna 2: Responsável (Users + Select com Avatar), Prioridade (Flag + Select com ArrowUp/Badge), Etiquetas (Tag + Input texto "tráfego, urgente" — manter o Input de texto separado por vírgula que já existe; não precisa replicar os badges removíveis do detalhe), Cliente (Building2 + Select)

    Regras:
    - NENHUM campo se perde: os mesmos useState e o payload de criarTarefa ficam intactos (a action não muda).
    - Título grande + subtítulo (linhas ~206-222) já estão iguais ao detalhe — não mexer.
    - Abas (Detalhes com Descrição+Recorrência, Checklists, e as 3 desabilitadas), card de Notas na direita, barra superior e botão "Criar tarefa" permanecem como estão. SEM painel de Atividade (tarefa não existe ainda).
    - Importar de lucide-react os ícones novos (CircleDot, CalendarDays, Users, Flag, Tag) e remover os que ficarem sem uso.
    - Textos em português; classes funcionam em dark mode (só tokens do tema, como no detalhe).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/lib/tarefas</automated>
  </verify>
  <done>Grade de /tarefas/nova visualmente idêntica em estrutura à do detalhe (2 colunas, ícone+rótulo w-32+valor); todos os 8 campos editáveis presentes; suíte src/lib/tarefas verde; tsc limpo.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` limpo
- `npx vitest run src/lib/tarefas` verde
- Grep: nenhum `ArrowLeft` órfão em nova-tarefa-form.tsx; `w-32 shrink-0` presente
</verification>

<success_criteria>
- /tarefas/nova com um único Voltar e grade de metadados no padrão ClickUp do detalhe
- criarTarefa recebe exatamente o mesmo payload de antes
</success_criteria>

<output>
After completion, create `.planning/quick/260719-rah-nova-tarefa-no-layout-clickup-remover-bo/260719-rah-SUMMARY.md`
</output>

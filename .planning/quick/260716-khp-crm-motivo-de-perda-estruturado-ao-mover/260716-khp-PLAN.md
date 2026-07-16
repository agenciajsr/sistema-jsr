---
phase: quick-260716-khp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/crm/motivos-perda.ts
  - src/lib/crm/motivos-perda.test.ts
  - src/components/crm/motivo-perda-dialog.tsx
  - src/components/crm/kanban-crm.tsx
autonomous: true
requirements: [QUICK-KHP]

must_haves:
  truths:
    - "Arrastar um card para a coluna Perdido abre um modal com os 7 motivos padronizados (não mais window.prompt)"
    - "Selecionar 'Outro' exibe campo livre obrigatório; os demais motivos confirmam direto"
    - "Cancelar o modal NÃO move o card e NÃO chama nenhuma action"
    - "O motivo salvo aparece no card de perdidos ('Motivo: …') e na ficha do lead"
  artifacts:
    - path: "src/lib/crm/motivos-perda.ts"
      provides: "Lista MOTIVOS_PERDA + montarMotivoPerda(motivo, detalhe)"
      exports: ["MOTIVOS_PERDA", "montarMotivoPerda"]
    - path: "src/components/crm/motivo-perda-dialog.tsx"
      provides: "Dialog controlado de seleção de motivo (pt-BR)"
    - path: "src/components/crm/kanban-crm.tsx"
      provides: "Integração drag→Perdido abre o dialog em vez de window.prompt"
  key_links:
    - from: "src/components/crm/kanban-crm.tsx"
      to: "src/components/crm/motivo-perda-dialog.tsx"
      via: "estado pendentePerda + onConfirm chama moverParaPerdido(id, motivo)"
      pattern: "MotivoPerdaDialog"
    - from: "src/components/crm/motivo-perda-dialog.tsx"
      to: "src/lib/crm/motivos-perda.ts"
      via: "import MOTIVOS_PERDA/montarMotivoPerda"
      pattern: "motivos-perda"
---

<objective>
CRM: motivo de perda estruturado. Ao arrastar um negócio para a coluna "Perdido" do Kanban da /crm, abrir um Dialog com seletor de motivo padronizado (7 opções, "Outro" com campo livre), salvar o motivo no banco (coluna `motivo_perda` já existente) e manter a exibição do motivo no card/ficha de perdidos.

Purpose: padronizar a análise de perdas (hoje o motivo é texto livre digitado num window.prompt feio e sem padrão).
Output: dialog novo + módulo puro de motivos testado + kanban integrado. SEM migration — o rótulo padronizado (ou "Outro: {texto}") é salvo na coluna text `motivo_perda` existente.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/crm/kanban-crm.tsx
@src/actions/crm.ts
@src/components/crm/card-oportunidade.tsx
@src/components/crm/converter-cliente-dialog.tsx

<interfaces>
Estado atual (verificado no código — NÃO recriar o que já existe):

- `crm_oportunidades.motivo_perda` já é `text` nullable no schema (src/lib/db/schema.ts:762). Nenhuma migration necessária.
- `perderOportunidade(id, motivoPerda)` / `moverParaPerdido(id, motivo)` em src/actions/crm.ts já validam motivo vazio, gravam `motivoPerda`, registram atividade 'perda' e revalidam /crm. NÃO alterar as actions.
- kanban-crm.tsx, função de drop (~linhas 186-221): hoje usa `window.prompt('Qual o motivo da perda?')` ANTES do update otimista; cancelar retorna sem mover. É esse trecho que vira dialog.
- card-oportunidade.tsx:161-162 já exibe `Motivo: {oportunidade.motivoPerda}` em perdidos; ficha-lead.tsx:1139-1140 idem. Exibição já resolvida — só validar.
- Padrão de dialog do repo: converter-cliente-dialog.tsx (Dialog shadcn controlado por estado no kanban, textos pt-BR).
- `reabrirOportunidade` já zera `motivoPerda` — nada a fazer aí.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Módulo puro de motivos de perda + Dialog de seleção</name>
  <files>src/lib/crm/motivos-perda.ts, src/lib/crm/motivos-perda.test.ts, src/components/crm/motivo-perda-dialog.tsx</files>
  <behavior>
    Testes (Vitest, módulo puro sem imports de db/react):
    - MOTIVOS_PERDA contém exatamente, nesta ordem: "Preço alto", "Sem verba no momento", "Fechou com concorrente", "Sem resposta/sumiu", "Timing errado (voltar depois)", "Não qualificado", "Outro"
    - montarMotivoPerda("Preço alto") → "Preço alto" (detalhe ignorado quando motivo ≠ Outro)
    - montarMotivoPerda("Outro", "cliente mudou de cidade") → "Outro: cliente mudou de cidade" (detalhe com trim)
    - montarMotivoPerda("Outro", "") e montarMotivoPerda("Outro", "   ") → null (inválido — Outro exige detalhe)
    - montarMotivoPerda("qualquer coisa fora da lista") → null
  </behavior>
  <action>
    1. Criar `src/lib/crm/motivos-perda.ts` (módulo PURO, zero imports de db/auth/react — padrão do repo, decisão 260714-ita):
       - `export const MOTIVOS_PERDA` com a lista travada pelo usuário (ordem acima; "Outro" por último).
       - `export function montarMotivoPerda(motivo: string, detalhe?: string): string | null` — devolve a string final a persistir ou null se inválido, conforme os testes.
       - Escrever os testes PRIMEIRO (RED), depois implementar (GREEN). Commits separados test→feat no padrão do repo.
    2. Criar `src/components/crm/motivo-perda-dialog.tsx` ('use client'), seguindo o padrão de converter-cliente-dialog.tsx:
       - Props: `{ open: boolean; onCancel: () => void; onConfirm: (motivo: string) => void; nomeNegocio?: string }`. Componente CONTROLADO — quem chama a action é o kanban.
       - Dialog shadcn (src/components/ui/dialog.tsx já no registry) com título "Motivo da perda" e descrição citando o negócio quando `nomeNegocio` vier.
       - Lista dos motivos como botões de rádio (RadioGroup do shadcn se já existir em src/components/ui; senão, botões estilizados com estado selecionado — NÃO adicionar dependência nova). Selecionado com destaque que funcione no dark (usar tokens do tema: border-primary/bg-accent, nunca cor hex fixa — regra do dark mode).
       - Quando "Outro" selecionado, mostrar `<Textarea>`/`<Input>` "Descreva o motivo" obrigatório.
       - Botão "Confirmar perda" desabilitado enquanto `montarMotivoPerda(selecionado, detalhe)` retornar null; ao confirmar, chama `onConfirm(montarMotivoPerda(...)!)`.
       - Botão "Cancelar" e fechar/ESC chamam `onCancel`. Todos os textos em português. Ao abrir, resetar seleção/detalhe (sem estado sujo entre perdas).
  </action>
  <verify>
    <automated>npx vitest run src/lib/crm/motivos-perda.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>Módulo puro com testes passando; dialog compila, controlado por props, textos pt-BR, "Outro" com campo livre obrigatório.</done>
</task>

<task type="auto">
  <name>Task 2: Integrar o dialog no drag & drop do Kanban (substituir window.prompt)</name>
  <files>src/components/crm/kanban-crm.tsx</files>
  <action>
    Em kanban-crm.tsx:
    1. Adicionar estado `pendentePerda: { id: string; nome: string } | null`.
    2. No handler de drop (~linha 186): quando `destino === PERDIDO`, NÃO mover o quadro nem chamar action — apenas `setPendentePerda({ id, nome: achado.card.titulo/nome })` e retornar. Remover o `window.prompt` por completo.
    3. Extrair a lógica de "efetivar a perda" (update otimista do quadro + `moverParaPerdido(id, motivo)` + rollback em erro + toast "Negócio marcado como perdido.") para uma função `confirmarPerda(motivo: string)` que reaproveita EXATAMENTE o fluxo otimista existente (guardar `anterior`, mover card com `status: 'perdida'` e `motivoPerda: motivo`, rollback + toast.error se a action falhar). Atenção: no momento da confirmação o card precisa ser re-localizado via `acharCard(id)` (o quadro pode ter mudado); se não achar, apenas fechar o dialog.
    4. Renderizar `<MotivoPerdaDialog open={!!pendentePerda} nomeNegocio={pendentePerda?.nome} onCancel={() => setPendentePerda(null)} onConfirm={(motivo) => { confirmarPerda(motivo); setPendentePerda(null) }} />` junto dos outros dialogs do board.
    5. Cancelar = card fica onde estava (nenhuma mutação foi feita antes da confirmação — mesmo contrato do prompt atual).
    6. Conferir que card-oportunidade.tsx e ficha-lead.tsx seguem exibindo o motivo (já exibem `Motivo: {motivoPerda}` — não mexer, só garantir que o valor padronizado flui).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <done>`window.prompt` não existe mais no arquivo; arrastar para Perdido abre o dialog; confirmar salva motivo padronizado via moverParaPerdido; cancelar não move; suíte completa verde.</done>
</task>

</tasks>

<verification>
- `grep -n "window.prompt" src/components/crm/kanban-crm.tsx` → sem resultados.
- `npx vitest run` → todos os testes passando (incluindo os novos de motivos-perda).
- `npx tsc --noEmit` limpo.
- Manual (usuário, opcional): arrastar card para Perdido → modal com 7 motivos; "Outro" exige texto; card em Perdido mostra "Motivo: …".
</verification>

<success_criteria>
- Modal em português com a lista exata travada pelo usuário substitui o window.prompt.
- Motivo padronizado persistido na coluna `motivo_perda` existente (sem migration) e exibido no card/ficha de perdidos.
- Cancelamento não move o card nem chama actions.
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260716-khp-crm-motivo-de-perda-estruturado-ao-mover/260716-khp-SUMMARY.md`
</output>

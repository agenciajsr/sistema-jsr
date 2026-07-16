---
phase: quick-260716-ezd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/schema.ts
  - src/actions/crm.ts
  - src/lib/crm/conversao.ts
  - src/lib/crm/conversao.test.ts
  - src/components/crm/kanban-crm.tsx
  - src/components/crm/converter-cliente-dialog.tsx
  - drizzle/00XX_*.sql (gerada, NÃO aplicada)
autonomous: false
requirements: [FUNIL-F3-01, FUNIL-F3-02, FUNIL-F3-03, FUNIL-F3-04, FUNIL-F3-05]
must_haves:
  truths:
    - "Ao soltar um card na coluna Ganho, um dialog oferece 'Converter em cliente' (pode recusar — negócio ganha mesmo assim)"
    - "Confirmar a conversão cria cliente com status aguardando_inicio pré-preenchido com nome/telefone/email/empresa do contato"
    - "Se o contato (ou empresa) já virou cliente antes, NÃO duplica — vincula e mostra o cliente existente"
    - "O cliente criado fica rastreável a partir da oportunidade e do contato (cliente_id preenchido)"
    - "Toda a UI em português, seguindo shadcn/ui com variantes dark:"
  artifacts:
    - path: "src/lib/crm/conversao.ts"
      provides: "Lógica pura de decisão da conversão (dados do cliente + detecção de cliente existente)"
    - path: "src/components/crm/converter-cliente-dialog.tsx"
      provides: "Dialog de conversão no fluxo de Ganho"
    - path: "drizzle (nova migration)"
      provides: "Coluna aditiva cliente_id em crm_contatos"
      contains: "ALTER TABLE"
  key_links:
    - from: "src/components/crm/kanban-crm.tsx"
      to: "converter-cliente-dialog.tsx"
      via: "estado aberto após moverParaGanho com sucesso"
      pattern: "ConverterClienteDialog"
    - from: "src/components/crm/converter-cliente-dialog.tsx"
      to: "src/actions/crm.ts"
      via: "action converterOportunidadeEmCliente"
      pattern: "converterOportunidadeEmCliente"
---

<objective>
Fase 3 do funil da agência — Ganho → Cliente: quando uma oportunidade do CRM vira "Ganho", oferecer a conversão do lead em cliente da agência com status `aguardando_inicio`, reaproveitando os dados do contato, com idempotência (nunca duplicar cliente) e rastreabilidade (cliente_id no contato e na oportunidade).

Purpose: fechar a costura CRM → carteira de clientes (item "Ganho → virar Cliente: ❌ Falta" do reality-check em .planning/FUNIL-AGENCIA-PLANEJAMENTO.md).
Output: action de conversão lead-first, dialog no fluxo de Ganho do kanban, migration aditiva (gerada, aplicação manual), testes do módulo puro.
</objective>

<context>
@.planning/FUNIL-AGENCIA-PLANEJAMENTO.md (Fase 3 + reality-check)
@src/actions/crm.ts (ganharOportunidade linhas ~545-643, moverParaGanho ~684)
@src/lib/db/schema.ts (crmContatos ~644, crmOportunidades ~730 — já tem clienteId; crmEmpresas já tem clienteId)
@src/components/crm/kanban-crm.tsx (onDragEnd ~169-244 — hoje chama moverParaGanho(id) SEM opts)

**Estado atual (verificado no código):**
- `ganharOportunidade(id, { criarCliente })` JÁ cria cliente `aguardando_inicio` — MAS só quando a oportunidade tem `empresaId`. O CRM é LEAD-FIRST: a maioria das oportunidades tem só `contatoId`, então a conversão hoje é inalcançável na prática.
- A UI nunca passa `criarCliente` — `moverParaGanho(id)` sem opts. Não existe dialog.
- `crm_oportunidades.cliente_id` e `crm_empresas.cliente_id` JÁ EXISTEM no schema. `crm_contatos` NÃO tem `cliente_id` — é a coluna nova (idempotência por contato).
- Status `aguardando_inicio` já existe no enum de cliente (migration 0014) e em `src/lib/validations/cliente.ts`.

**Regras críticas (não negociáveis):**
- Migration: gerar com `npx drizzle-kit generate`, NUNCA aplicar automaticamente (nem migrate nem push). Aplicação é passo manual do dono (checkpoint). SQL aditivo.
- Queries SEQUENCIAIS dentro de actions (pool max=5, sem Promise.all interno).
- Commits e UI 100% em português. `git add` só de arquivos específicos, nunca `-A`.
- Não quebrar os 587+ testes Vitest existentes.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend lead-first — coluna cliente_id em crm_contatos + action converterOportunidadeEmCliente + módulo puro</name>
  <files>src/lib/db/schema.ts, drizzle/ (migration gerada), src/lib/crm/conversao.ts, src/lib/crm/conversao.test.ts, src/actions/crm.ts</files>
  <behavior>
    Módulo puro `src/lib/crm/conversao.ts` (zero import de db/auth/react), testado com Vitest:
    - `clienteExistenteDe({ contato, empresa })` → retorna o clienteId existente (prioridade: contato.clienteId, depois empresa.clienteId) ou null.
    - `dadosClienteDe({ contato, empresa, oportunidade })` → monta o payload do cliente novo: nome = empresa?.nome ?? contato.nome; status 'aguardando_inicio'; nicho default 'negocio_local'; contatoNome/Telefone/Email do contato.
    - Casos de teste: só contato (lead-first), contato+empresa, contato já convertido (retorna existente), empresa já cliente, sem contato nem empresa (inválido).
  </behavior>
  <action>
    1. Schema: adicionar em `crmContatos` a coluna `clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' })` com comentário em português ("Preenchido quando o lead vira cliente da agência — idempotência da conversão Ganho → Cliente"). ATENÇÃO à ordem de declaração: `clientes` é declarado antes no arquivo, referência ok.
    2. Gerar migration: `npx drizzle-kit generate` — conferir que o SQL é APENAS `ALTER TABLE crm_contatos ADD COLUMN cliente_id ...` (aditivo). NÃO rodar migrate/push (regra do projeto — histórico do Drizzle vazio, replay destruiria dados).
    3. Criar `src/lib/crm/conversao.ts` + `conversao.test.ts` conforme <behavior> (TDD: testes primeiro).
    4. Em `src/actions/crm.ts`, criar a action `converterOportunidadeEmCliente(oportunidadeId: string)` SEPARADA de ganharOportunidade (o ganho já aconteceu quando ela roda; a conversão é decisão posterior do dialog):
       - Auth (`getCurrentUser`) + `getWorkspaceAtual()` como as demais actions.
       - Buscar oportunidade (com contatoId, empresaId, clienteId) no workspace; recusar se não existir ou status !== 'ganha'.
       - Idempotência em 3 níveis, nesta ordem: (a) oportunidade.clienteId já preenchido → retornar `{ data: { clienteId, jaExistia: true } }`; (b) contato.clienteId preenchido; (c) empresa.clienteId preenchido — em (b)/(c) só vincular o id existente na oportunidade (e no contato/empresa que estiver sem) e retornar jaExistia: true.
       - Caso novo: montar payload via `dadosClienteDe`, insert em `clientes` com `.returning({ id })`, depois updates SEQUENCIAIS: crm_oportunidades.cliente_id, crm_contatos.cliente_id (se contato), crm_empresas.cliente_id (se empresa). NADA de Promise.all.
       - `registrarAtividadeCrm` tipo 'ganho' ou similar já usado, detalhe 'Convertido em cliente da carteira' (ou 'Vinculado a cliente existente').
       - `revalidatePath('/crm')` e `revalidatePath('/clientes')`. Retornar `{ data: { clienteId, jaExistia } }`.
       - Degradação graciosa enquanto a migration não for aplicada: se o update de crm_contatos falhar com 'column ... does not exist', logar e seguir (conversão funciona; idempotência por contato só após a migration) — mesmo espírito do getWorkspaceAtual.
    5. Simplificar `ganharOportunidade`: manter compatível (opts?.criarCliente continua funcionando para não quebrar nada), sem mudar comportamento existente.
    6. Commit em português: `feat(crm): conversão Ganho → Cliente (action lead-first + coluna cliente_id em crm_contatos)` — arquivos específicos.
  </action>
  <verify>
    <automated>npx vitest run src/lib/crm/conversao.test.ts && npx vitest run</automated>
  </verify>
  <done>Migration gerada (não aplicada), módulo puro testado, action converterOportunidadeEmCliente idempotente em 3 níveis, suíte inteira verde.</done>
</task>

<task type="auto">
  <name>Task 2: UI — dialog "Converter em cliente" no fluxo de Ganho do kanban</name>
  <files>src/components/crm/converter-cliente-dialog.tsx, src/components/crm/kanban-crm.tsx</files>
  <action>
    1. Criar `converter-cliente-dialog.tsx` (client component, shadcn Dialog já no registry desde 260715-gmf):
       - Props: `oportunidade` (id, titulo, nome do contato/empresa) | null, `onOpenChange`.
       - Título: "Negócio ganho! Converter em cliente?" — texto explicando que cria a ficha do cliente com status "Aguardando início" reaproveitando nome, telefone, e-mail e empresa do lead.
       - Mostrar preview dos dados que serão usados (nome, telefone, e-mail — os que existirem no card).
       - Botões: "Agora não" (fecha, negócio continua ganho) e "Converter em cliente" (chama `converterOportunidadeEmCliente(id)` com useTransition/estado de loading).
       - Resultado: sucesso novo → toast "Cliente criado — aguardando início." com link/ação para `/clientes/{clienteId}`; `jaExistia: true` → toast "Este lead já é cliente." também com link para a ficha; erro → toast.error com a mensagem da action.
       - Dark mode: usar tokens do tema (bg-card, text-muted-foreground etc.) e variantes dark: onde houver cor pastel, seguindo os padrões dos dialogs existentes do CRM (ver novo-lead e criar-atividade).
    2. Em `kanban-crm.tsx`:
       - Estado `conversaoPendente: OportunidadeCard | null`.
       - No `onDragEnd`, quando `destino === GANHO` e `moverParaGanho(id)` retornar sucesso: além do toast "Negocio ganho.", setar `conversaoPendente` com o card movido (abre o dialog). O drop NÃO fica condicionado ao dialog — ganho primeiro, conversão é oferta separada (cancelar o dialog não desfaz o ganho).
       - Se o card já tiver clienteId (dado disponível no tipo OportunidadeCard? se não tiver, adicionar o campo na query do quadro em src/lib/crm — conferir getCrmVisaoGeral), NÃO abrir o dialog (já convertido).
       - Renderizar `<ConverterClienteDialog oportunidade={conversaoPendente} onOpenChange={...} />` ao lado do board.
    3. Verificar tipagem: se `OportunidadeCard` não expõe clienteId, incluir `clienteId` no select de getCrmVisaoGeral (src/lib/crm) e no tipo — mudança mínima, sem query extra.
    4. Commit: `feat(crm): dialog Converter em cliente ao ganhar negócio no kanban`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <done>Soltar card em Ganho abre o dialog após o sucesso da action; converter cria/vincula cliente e mostra toast com link; card já convertido não reabre o dialog; build de tipos limpo.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Aplicar a migration na mão e validar o fluxo em produção</name>
  <what-built>Conversão Ganho → Cliente completa no código; migration aditiva de `cliente_id` em `crm_contatos` GERADA mas NÃO aplicada (regra do projeto: aplicação manual, nunca drizzle-kit migrate/push).</what-built>
  <how-to-verify>
    1. Aplicar o SQL da migration nova no banco (padrão do projeto: script Node pontual lendo DIRECT_URL, statements separados por `--> statement-breakpoint`, dentro de `sql.begin()` — ver scripts/aplicar-migration-0024.ts como modelo; ou editor SQL do Supabase). Conferir antes com information_schema que a coluna ainda não existe.
    2. Deploy: `git push origin master`.
    3. Na /crm: arrastar uma oportunidade de teste para Ganho → dialog "Converter em cliente?" aparece → confirmar → toast com link → ficha do cliente em /clientes com status "Aguardando início" e nome/telefone/e-mail do lead.
    4. Idempotência: reabrir e ganhar de novo (ou ganhar outro negócio do MESMO contato) → NÃO cria segundo cliente; mostra "Este lead já é cliente."
  </how-to-verify>
  <resume-signal>Digite "aprovado" ou descreva o problema encontrado</resume-signal>
</task>

</tasks>

<verification>
- `npx vitest run` — suíte inteira verde (587+ testes, incluindo os novos de conversao.test.ts)
- `npx tsc --noEmit` limpo
- Migration gerada em drizzle/ contém APENAS ALTER TABLE aditivo e NÃO foi aplicada pelo Claude
- Nenhum Promise.all novo dentro de actions; nenhuma UI em inglês
</verification>

<success_criteria>
- Ganhar um negócio no kanban oferece (não força) a conversão do lead em cliente `aguardando_inicio` com dados do contato pré-preenchidos
- Contato/empresa/oportunidade ficam vinculados ao cliente (cliente_id) para rastreabilidade
- Conversão idempotente: contato que já virou cliente reaproveita o cliente existente, nunca duplica
- Reality-check do FUNIL-AGENCIA-PLANEJAMENTO.md pode marcar "Ganho → virar Cliente" como ✅
</success_criteria>

<output>
Após completar, criar `.planning/quick/260716-ezd-fase-3-do-funil-ganho-no-crm-converte-le/260716-ezd-SUMMARY.md`
</output>

---
phase: quick-260715-gmf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/schema.ts
  - drizzle/0021_crm_tags_lead_endereco.sql
  - scripts/aplicar-migration-0021.ts
  - src/lib/validations/crm.ts
  - src/actions/crm-tags.ts
  - src/actions/crm-lead.ts
  - src/components/ui/dialog.tsx
  - src/components/crm/tags-select.tsx
  - src/components/crm/novo-lead-dialog.tsx
  - src/components/crm/crm-view.tsx
autonomous: true
requirements: [GMF-01]
must_haves:
  truths:
    - "Clicar em Novo Lead abre um Dialog CENTRALIZADO com overlay, título 'Criar novo Lead', X para fechar e botão azul 'Confirmar' no rodapé"
    - "O modal tem Nome no topo, seletor de Tags multi-select com busca e criação inline, e 4 abas: Contato / Dados Pessoais / Endereço / Anotações"
    - "Serviço, Valor, Tipo de receita e Etapa continuam no modal e o negócio continua sendo criado junto (fluxo lead-first com dedup e aviso de lead existente)"
    - "Todos os campos novos (site, origem, nascimento, endereço completo, notas, tags) ficam persistidos em crm_contatos / crm_contato_tags"
  artifacts:
    - path: "drizzle/0021_crm_tags_lead_endereco.sql"
      provides: "crm_tags, crm_contato_tags e colunas pais/numero/complemento/bairro em crm_contatos"
    - path: "src/actions/crm-tags.ts"
      provides: "listarTags e criarTag"
      exports: ["listarTags", "criarTag"]
    - path: "src/components/crm/tags-select.tsx"
      provides: "Multi-select de tags com busca, badges coloridas e 'Criar' inline"
    - path: "src/components/crm/novo-lead-dialog.tsx"
      provides: "Dialog 'Criar novo Lead' com abas, conforme imagens 07-11"
  key_links:
    - from: "src/components/crm/novo-lead-dialog.tsx"
      to: "src/actions/crm-lead.ts"
      via: "criarLead(values) com campos novos + tagIds"
      pattern: "criarLead\\("
    - from: "src/actions/crm-lead.ts"
      to: "crm_contato_tags"
      via: "insert dos vínculos lead↔tag após criar/achar o contato"
      pattern: "crmContatoTags"
    - from: "src/components/crm/tags-select.tsx"
      to: "src/actions/crm-tags.ts"
      via: "listarTags no mount + criarTag inline"
      pattern: "criarTag|listarTags"
---

<objective>
Reformular o modal "Novo Lead" do CRM para o layout das imagens de referência (Imagens_referencia_CRM/imagem07.png a imagem11.png): Dialog centralizado "Criar novo Lead" com Nome, seletor de Tags (sistema de tags completo, novo) e 4 abas (Contato / Dados Pessoais / Endereço / Anotações), mantendo a seção de negócio (Serviço/Valor/Tipo de receita/Etapa) e o fluxo lead-first com dedup existente.

Purpose: o modal atual é um Card inline com poucos campos; o usuário quer o cadastro rico do mockup, com tags e endereço completo persistidos.
Output: migration 0021 aplicada, tabela crm_tags + crm_contato_tags, actions de tags, leadSchema/criarLead ampliados, Dialog novo conforme mockup.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@Imagens_referencia_CRM/imagem07.png  (aba Contato: Telefone c/ bandeira BR +55, E-mail, Site; título "Criar novo Lead", X, Confirmar azul)
@Imagens_referencia_CRM/imagem08.png  (seletor de Tags aberto: busca "Pesquisar...", badges coloridas, link "Criar" no rodapé)
@Imagens_referencia_CRM/imagem09.png  (aba Dados Pessoais: Documento CPF/CNPJ, Empresa, Origem, Data de Nascimento dd/MM/yyyy)
@Imagens_referencia_CRM/imagem10.png  (aba Endereço: País default Brasil c/ bandeira, CEP, Endereço, Número, Complemento, Bairro, Cidade, UF)
@Imagens_referencia_CRM/imagem11.png  (aba Anotações: textarea simples)
@src/components/crm/novo-lead-dialog.tsx
@src/actions/crm-lead.ts
@src/lib/validations/crm.ts
@src/lib/db/schema.ts  (crmContatos ~linha 543)

<interfaces>
Padrões existentes que o executor DEVE usar (sem exploração):

- Actions devolvem `{ data } | { error }`, começam por `getCurrentUser()` + `getWorkspaceAtual()` e terminam com `revalidatePath('/crm')`. Queries SEQUENCIAIS (pool max=3) — nunca Promise.all interno.
- Máscaras BR: `mascararTelefone`, `mascararDocumento` em `@/lib/crm/mascaras` (inputs controlados via setValue, não register).
- `leadSchema` (src/lib/validations/crm.ts:136) já tem: nome, empresaNome, email, telefone, documento, origem (enum ORIGENS_LEAD), servico, valor, tipoReceita, etapaId, donoId + refine "email OU telefone". Helpers `opcionalTexto`, `opcionalData`, `opcionalEmail`, `opcionalUuid` já existem no arquivo.
- `crmContatos` JÁ tem: documento, site, dataNascimento, cep, endereco, cidade, estado, notas. FALTAM: pais, numero, complemento, bairro.
- Helpers internos server: `registrarAtividadeCrm` em `@/lib/crm/atividades` (NUNCA exportar helper de arquivo 'use server').
- UI registry: tabs.tsx, badge.tsx, textarea.tsx, select.tsx, input.tsx, label.tsx existem. dialog.tsx NÃO existe (adicionar via `npx shadcn@latest add dialog` — radix dialog já é dependência transitiva de sheet/alert-dialog).
- MIGRATIONS: NUNCA `drizzle-kit migrate` (controle vazio no banco → replay destruiria dados). Gerar SQL manual em drizzle/, aplicar via script Node pontual com `tsx --env-file=.env.local`, lendo DIRECT_URL, separando por `--> statement-breakpoint` e rodando dentro de `sql.begin()`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schema + migration 0021 (crm_tags, crm_contato_tags, colunas de endereço) e aplicação manual</name>
  <files>src/lib/db/schema.ts, drizzle/0021_crm_tags_lead_endereco.sql, scripts/aplicar-migration-0021.ts</files>
  <action>
    1. Em `src/lib/db/schema.ts`, junto às demais tabelas do CRM:
       - `crmTags` → tabela `crm_tags`: id uuid pk defaultRandom, workspaceId uuid NOT NULL FK workspaces (cascade), nome text NOT NULL, cor text NOT NULL (classe/hex — armazenar chave de cor, ex.: 'violet', 'green'...), createdAt timestamptz defaultNow. Unique index (workspace_id, lower(nome)) — se lower() em índice for chato no Drizzle, unique (workspaceId, nome) e normalizar nome com trim na action.
       - `crmContatoTags` → tabela `crm_contato_tags` (junção): id uuid pk defaultRandom, contatoId uuid NOT NULL FK crm_contatos (cascade), tagId uuid NOT NULL FK crm_tags (cascade), createdAt defaultNow, unique index (contato_id, tag_id).
       - Em `crmContatos`, adicionar colunas nullable: `pais: text('pais')`, `numero: text('numero')`, `complemento: text('complemento')`, `bairro: text('bairro')` (req. 7 — cep/endereco/cidade/estado/notas/documento/site/dataNascimento JÁ existem, não recriar).
    2. Escrever `drizzle/0021_crm_tags_lead_endereco.sql` MANUALMENTE (não rodar drizzle-kit generate se ele tentar diff contra estado inexistente; se `drizzle-kit generate` funcionar bem, pode usá-lo e renomear — o que importa é o SQL correto): CREATE TABLE crm_tags, CREATE TABLE crm_contato_tags, ALTER TABLE crm_contatos ADD COLUMN pais/numero/complemento/bairro, índices únicos; statements separados por `--> statement-breakpoint`. Usar IF NOT EXISTS onde couber (idempotência).
    3. Criar `scripts/aplicar-migration-0021.ts` no padrão da memória do projeto: lê o SQL do arquivo, separa por `--> statement-breakpoint`, conecta com `postgres(process.env.DIRECT_URL)` e executa tudo dentro de `sql.begin()` (rollback total se falhar). ANTES de aplicar, conferir estado real: consultar information_schema para checar se crm_tags já existe (se existir, abortar com mensagem).
    4. APLICAR: `npx tsx --env-file=.env.local scripts/aplicar-migration-0021.ts`. Confirmar no output que as 2 tabelas e as 4 colunas existem (SELECT no information_schema ao final do script). NUNCA rodar `drizzle-kit migrate` (req. 5).
  </action>
  <verify>
    <automated>npx tsx --env-file=.env.local scripts/aplicar-migration-0021.ts && npx tsc --noEmit</automated>
  </verify>
  <done>crm_tags, crm_contato_tags e colunas pais/numero/complemento/bairro existem no banco (confirmado via information_schema); schema.ts compila.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Validação + actions — leadSchema ampliado, crm-tags.ts e criarLead persistindo tudo</name>
  <files>src/lib/validations/crm.ts, src/actions/crm-tags.ts, src/actions/crm-lead.ts, src/lib/validations/crm.test.ts (ou arquivo de teste existente do leadSchema)</files>
  <behavior>
    - leadSchema aceita os campos novos todos vazios (continuam opcionais) e mantém o refine "email OU telefone"
    - leadSchema aceita tagIds: array de uuid, default []
    - dataNascimento '2000-13-99' é rejeitada; '1990-05-20' passa
  </behavior>
  <action>
    1. `src/lib/validations/crm.ts` — ampliar `leadSchema` (req. 6) com campos TODOS opcionais usando os helpers existentes:
       - Contato: `site: opcionalTexto`
       - Dados Pessoais: `dataNascimento: opcionalData` (documento/empresaNome/origem já existem)
       - Endereço: `pais: opcionalTexto` (default 'Brasil' no form, não no schema), `cep: opcionalTexto`, `endereco: opcionalTexto`, `numero: opcionalTexto`, `complemento: opcionalTexto`, `bairro: opcionalTexto`, `cidade: opcionalTexto`, `estado: opcionalTexto`
       - Anotações: `notas: opcionalTexto`
       - Tags: `tagIds: z.array(z.string().uuid()).default([])`
       Adicionar também `tagSchema = z.object({ nome: min(1), cor: min(1) })`.
    2. Criar `src/actions/crm-tags.ts` ('use server', padrão do repo — getCurrentUser + getWorkspaceAtual, {data}|{error}):
       - `listarTags()`: SELECT id/nome/cor de crm_tags do workspace, ORDER BY nome.
       - `criarTag(input)`: valida com tagSchema, trim no nome, recusa duplicada (SELECT case-insensitive antes do insert), insere e devolve `{ data: { id, nome, cor } }`. revalidatePath('/crm').
       - Exportar de src/lib uma paleta `CORES_TAG` (ex.: em `src/lib/crm/tags.ts`, módulo comum NÃO 'use server') com ~8 chaves de cor → classes Tailwind de badge (bg/texto suaves como no mockup: violet, green, blue, lime, orange, red, pink, slate). A action valida que `cor` é uma das chaves.
    3. `src/actions/crm-lead.ts` — `criarLead`:
       - No INSERT de contato novo: incluir site, dataNascimento, pais, cep, endereco, numero, complemento, bairro, cidade, estado, notas (v.* ?? null).
       - No merge conservador de lead existente: mesmos campos, só preenchendo o que está null (padrão atual; nome nunca tocado).
       - Após ter `contatoId`: se `v.tagIds.length > 0`, inserir vínculos em crm_contato_tags com `onConflictDoNothing` (uma query, values múltiplos). Sequencial, depois do update/insert do contato.
       - `getFichaLead`: incluir os campos novos no select do perfil (pais, numero, complemento, bairro) — barato e evita ficha defasada.
    4. Testes: cobrir os 3 comportamentos do bloco behavior no arquivo de teste onde o leadSchema já é testado (ou criar um). Rodar a suíte.
  </action>
  <verify>
    <automated>npm test && npx tsc --noEmit</automated>
  </verify>
  <done>leadSchema aceita/valida os campos novos e tagIds; listarTags/criarTag funcionam no padrão do repo; criarLead persiste todos os campos e vincula tags; suíte de testes verde.</done>
</task>

<task type="auto">
  <name>Task 3: UI — Dialog "Criar novo Lead" com Tags e 4 abas, fiel às imagens 07-11</name>
  <files>src/components/ui/dialog.tsx, src/components/crm/tags-select.tsx, src/components/crm/novo-lead-dialog.tsx</files>
  <action>
    1. Adicionar o Dialog do shadcn: `npx shadcn@latest add dialog` (radix já presente via sheet/alert-dialog). Se o CLI falhar, escrever `dialog.tsx` manualmente sobre `@radix-ui/react-dialog` no mesmo estilo de sheet.tsx. Isso SUBSTITUI a decisão antiga "Card inline" — o usuário decidiu Dialog centralizado (req. 1); manter comentário no componente explicando a troca.
    2. Criar `src/components/crm/tags-select.tsx` (client), imagem 08:
       - Trigger tipo select ("Selecione as tags") mostrando as tags escolhidas como badges coloridas; popover/lista com Input "Pesquisar..." no topo, lista de tags como badges (classes de `CORES_TAG`), clique alterna seleção (destacar selecionadas), rodapé com link azul "Criar".
       - "Criar": quando a busca não bate com nada (ou sempre visível), cria a tag inline via `criarTag` usando o texto da busca como nome e uma cor da paleta (ciclar/aleatória entre CORES_TAG), adiciona à lista e já seleciona. Carregar tags com `listarTags` ao abrir. Props: `value: string[]`, `onChange`, controlado pelo form.
       - Sem lib nova: usar Popover não existe no registry — implementar com div absoluto + estado aberto/fechado + clique-fora (padrão simples), ou DropdownMenu existente se ficar fiel. Manter simples e em português.
    3. Reescrever `src/components/crm/novo-lead-dialog.tsx` (manter export `NovoLeadDialog({ etapas })` e o botão "Novo Lead" como trigger):
       - Dialog centralizado, título "Criar novo Lead", X no canto (DialogClose), largura ~max-w-lg, rodapé com botão azul "Confirmar" alinhado à direita (imagens 07-11). Estado do RHF preservado ao trocar de aba (Tabs não desmonta conteúdo — usar `forceMount`+hidden ou manter os inputs controlados/registrados; garantir que trocar de aba NÃO perde valores).
       - Topo: Nome (label "Nome", placeholder "Informe o nome do lead"); abaixo Tags (TagsSelect → tagIds).
       - Tabs (componente tabs.tsx) com 4 abas:
         - **Contato** (imagem 07): Telefone com prefixo fixo — grupo com bandeira 🇧🇷 + "+55" à esquerda e input mascarado (mascararTelefone) — placeholder vazio; E-mail (placeholder "Exemplo: meulead@gmail.com"); Site (placeholder "Exemplo: www.meulead.com.br").
         - **Dados Pessoais** (imagem 09): Documento (mascararDocumento, placeholder "Informe o CPF ou CNPJ"); Empresa ("Informe a empresa do lead" → empresaNome); Origem (Select existente ORIGENS_LEAD/nomeOrigem, placeholder "Como o lead ficou sabendo da sua empresa?"); Data de Nascimento (input type="date").
         - **Endereço** (imagem 10): grid 2 col — País (Select simples, default "Brasil", value do form `pais` default 'Brasil') + CEP ("ex: 12345-678"); linha Endereço ("ex: Av. Paulista") + Número ("ex: 123") + Complemento ("ex: Apto 101"); linha Bairro ("ex: Centro") + Cidade ("ex: São Paulo") + UF ("ex: SP", maxLength 2).
         - **Anotações** (imagem 11): Textarea → `notas`.
       - Seção extra "Negócio" (req. 3, abaixo das abas, separada por Separator): Serviço, Valor (R$), Tipo de receita, Etapa — mesmos Selects/inputs do componente atual. MANTER: aviso de lead existente (verificarLeadExistente + banner azul), onInvalid do refine sem path (toast), reset ao fechar, router.refresh() e toasts atuais. Manter a dica "Informe ao menos o email ou o telefone...".
       - Tudo em português; botão submit: "Confirmar" (variant padrão azul/primary), desabilitado com isPending ("Salvando...").
    4. Conferir integração: onde `NovoLeadDialog` é renderizado (crm-view/página) nada muda de props. Build final.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>Botão "Novo Lead" abre Dialog centralizado idêntico ao mockup (título, X, Nome, Tags com busca+criação inline, 4 abas com os campos certos, seção Negócio, Confirmar azul); trocar de aba não perde dados; submit cria lead+negócio com dedup e aviso preservados; build passa.</done>
</task>

</tasks>

<verification>
- `npm test` verde (inclui testes novos do leadSchema) e `npm run build` sem erros.
- Migration 0021 aplicada no banco (information_schema confirma crm_tags, crm_contato_tags, pais/numero/complemento/bairro) — sem `drizzle-kit migrate`.
- Fluxo manual: criar lead preenchendo campos das 4 abas + 2 tags → contato salvo com todos os campos, vínculos em crm_contato_tags, negócio criado na etapa escolhida; repetir com mesmo email → aviso de lead existente + novo negócio sem duplicar contato.
</verification>

<success_criteria>
Modal "Criar novo Lead" reproduz as imagens 07-11 (Dialog central, Tags completas com criação inline, 4 abas, seção de negócio mantida), todos os campos persistidos ponta a ponta, dedup intacto, migration aplicada na mão em transação, tudo em português.
</success_criteria>

<output>
After completion, create `.planning/quick/260715-gmf-reformular-modal-novo-lead-do-crm-dialog/260715-gmf-SUMMARY.md`
</output>

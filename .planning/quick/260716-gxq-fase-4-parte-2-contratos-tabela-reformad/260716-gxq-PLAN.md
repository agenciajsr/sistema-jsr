---
phase: quick-260716-gxq
plan: 01
type: execute
wave: 1
depends_on: [quick-260716-g4h]
files_modified:
  - src/lib/db/schema.ts
  - drizzle/0030_contratos_assinatura.sql
  - scripts/aplicar-migration-0030.ts
  - src/lib/contratos/fluxo.ts
  - src/lib/contratos/fluxo.test.ts
  - src/lib/contratos/variaveis.ts
  - src/lib/contratos/variaveis.test.ts
  - src/lib/contratos/template-trafego.ts
  - src/lib/contratos/pdf.tsx
  - src/lib/autentique/client.ts
  - src/actions/contratos.ts
  - src/app/api/webhooks/autentique/route.ts
  - src/app/(app)/contratos/page.tsx
  - src/app/(app)/contratos/tabela-contratos.tsx
  - src/app/(app)/contratos/preview/[id]/page.tsx
  - src/components/contratos/verificar-dados-dialog.tsx
  - src/components/contratos/editar-contrato-dialog.tsx
  - src/components/contratos/excluir-contrato-alert.tsx
autonomous: true
requirements: [GXQ-01, GXQ-02, GXQ-03]
user_setup:
  - service: autentique
    why: "Envio de contratos para assinatura eletrônica"
    env_vars:
      - name: AUTENTIQUE_API_TOKEN
        source: "Painel da Autentique -> Configurações -> API (usuário já tem conta; configurar na Vercel)"
must_haves:
  truths:
    - "A tabela de /contratos mostra as 12 colunas exatas na ordem: Cliente | Tipo | Valor | Status | Início | Fim | Verificar | Enviar/Reenviar | Preview | Editar | Excluir | Selecionar"
    - "Preview abre o contrato preenchido (fiel ao texto dos DOCX de 3/6 meses) com os dados do contratante"
    - "Enviar gera o PDF e cria o documento na Autentique com o contratante como signatário; status vira 'aguardando_assinatura'"
    - "Sem AUTENTIQUE_API_TOKEN, Enviar mostra erro amigável 'Configure o token da Autentique'"
    - "Contrato assinado (via webhook ou botão de atualizar) vira statusFluxo 'assinado' e o cliente é ativado"
    - "Verificar abre dialog com os dados PJ/PF recebidos pelo link público; Editar edita campos; Excluir pede confirmação; Selecionar marca checkboxes com contagem"
  artifacts:
    - path: "drizzle/0030_contratos_assinatura.sql"
      provides: "Colunas tipo_documento, autentique_documento_id, enviado_para_assinatura_em, assinado_em (SQL aditivo, NÃO aplicado)"
    - path: "src/lib/contratos/variaveis.ts"
      provides: "Montagem pura das variáveis do contrato a partir de dadosContratante + contrato (TDD)"
    - path: "src/lib/contratos/template-trafego.ts"
      provides: "Template TS/HTML versionado, fiel ao texto dos DOCX de 3 e 6 meses"
    - path: "src/lib/autentique/client.ts"
      provides: "Cliente GraphQL da Autentique (createDocument multipart, consulta de status)"
    - path: "src/app/(app)/contratos/tabela-contratos.tsx"
      provides: "Client component da tabela com as 12 colunas e dialogs"
  key_links:
    - from: "src/app/(app)/contratos/tabela-contratos.tsx"
      to: "src/actions/contratos.ts"
      via: "actions enviarParaAssinatura / atualizarStatusAssinatura / atualizarDadosContrato / deleteContrato"
      pattern: "enviarParaAssinatura"
    - from: "src/actions/contratos.ts"
      to: "src/lib/autentique/client.ts"
      via: "criação do documento com PDF gerado de template-trafego + variaveis"
      pattern: "autentique"
    - from: "src/app/api/webhooks/autentique/route.ts"
      to: "contratos.statusFluxo + clientes.status"
      via: "assinado → statusFluxo 'assinado' + cliente ativo"
      pattern: "assinado"
---

<objective>
Fase 4 Parte 2 — Contratos: reformar a tabela de /contratos com as 12 colunas exatas pedidas pelo usuário e fechar o ciclo do fluxo: gerar o contrato preenchido a partir dos templates de 3/6 meses, preview, envio/reenvio para assinatura via Autentique e retorno de assinado → cliente ativo.

Purpose: fechar a Fase 4 do funil da agência — do lead ganho ao contrato assinado sem sair do sistema.
Output: migration 0030 (gerada, NÃO aplicada), módulos puros testados, template do contrato versionado, preview HTML, integração Autentique (envio + webhook + atualização manual) e tabela /contratos reformada com dialogs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260716-g4h-fase-4-parte-1-contratos-dialog-com-plan/260716-g4h-SUMMARY.md
@src/app/(app)/contratos/page.tsx
@src/actions/contratos.ts
@src/lib/contratos/fluxo.ts
@src/lib/validations/contratante.ts
@src/actions/contrato-publico.ts
@src/lib/db/schema.ts (tabela contratos, linhas ~67-87)

<interfaces>
De src/lib/validations/contratante.ts (shape do jsonb dadosContratante):

```typescript
// PJ: { tipo:'pj', razaoSocial, cnpj, enderecoSede, telefone, nomeRepresentante,
//       nacionalidade, estadoCivil, profissao, cpf, enderecoRepresentante, email }
// PF: { tipo:'pf', nomeCompleto, cpf, nacionalidade, estadoCivil, profissao,
//       endereco, telefone, email }
export type ContratanteInput = z.infer<typeof contratanteSchema>
```

De src/lib/contratos/fluxo.ts:
```typescript
export type StatusFluxo = 'aguardando_dados' | 'dados_recebidos' | 'aguardando_assinatura' | 'assinado'
export function rotuloStatusFluxo(status: string | null | undefined): string
export function badgeStatusFluxo(status: string | null | undefined): string
```

De src/actions/contratos.ts:
```typescript
export type ContratoConsolidado = { id, clienteId, clienteNome, dataInicio, dataVencimento,
  valorMensal, vigente, token, statusFluxo, duracaoMeses, servico }
export async function listarTodosContratos(): Promise<ContratoConsolidado[]>
export async function atualizarContrato(id, input)  // admin, db.update
export async function deleteContrato(id)            // admin
```

Templates fonte (texto de referência, NÃO usados em runtime):
- contratos/JSR MIDIAS Contrato Tráfego Pago [3meses].docx
- contratos/JSR MIDIAS Contrato Tráfego Pago [6meses].docx
</interfaces>

**REGRAS CRÍTICAS (memórias do projeto — obedecer):**
- Migration: SQL aditivo em drizzle/0030, NUNCA `drizzle-kit migrate`. Script pontual modelo scripts/aplicar-migration-0024.ts. Degradação graciosa (try/catch, padrão de listarTodosContratos) enquanto 0029 E 0030 não estiverem aplicadas em produção.
- Nunca Promise.all com queries no mesmo client — queries sequenciais.
- Badges/cores com variantes dark:.
- Vercel Hobby região gru1 — nada de infra nova, nada de LibreOffice/puppeteer pesado.
- Todo texto de UI/erros/comentários em português brasileiro.
- Exports de arquivo 'use server' viram endpoints — helpers internos moram em src/lib.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Migration 0030 + estados/colunas de assinatura + módulos puros (variáveis e template do contrato)</name>
  <files>src/lib/db/schema.ts, drizzle/0030_contratos_assinatura.sql, scripts/aplicar-migration-0030.ts, src/lib/contratos/variaveis.ts, src/lib/contratos/variaveis.test.ts, src/lib/contratos/template-trafego.ts, src/lib/contratos/fluxo.ts</files>
  <behavior>
    TDD em src/lib/contratos/variaveis.test.ts (módulo PURO, zero import de db/auth/react):
    - montarVariaveisContrato({ contrato, dadosContratante }) para PJ retorna qualificação completa do contratante ("RAZÃO SOCIAL, pessoa jurídica..., CNPJ nº X, ... representada por NOME, nacionalidade, estado civil, profissão, CPF nº Y...") e para PF a qualificação de pessoa física.
    - Formata CPF (000.000.000-00) e CNPJ (00.000.000/0000-00) a partir de dígitos crus ou mascarados.
    - Valor mensal em moeda ("R$ 1.500,00") + valor por extenso simplificado NÃO é exigido — usar apenas numérico formatado (decisão: sem extenso no v1, documentar no código).
    - Datas 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (fuso).
    - duracaoMeses seleciona o texto de vigência (3 ou 6 meses); duração desconhecida → erro claro.
    - dadosContratante ausente/incompleto → retorna { error } (nunca gera contrato com placeholder vazio).
  </behavior>
  <action>
    1. Schema (src/lib/db/schema.ts), colunas ADITIVAS e nullable em `contratos` (per decisão LOCKED do usuário sobre "Tipo"):
       - tipoDocumento: text('tipo_documento') — nulo exibe "Contrato"
       - autentiqueDocumentoId: text('autentique_documento_id')
       - enviadoParaAssinaturaEm: timestamp('enviado_para_assinatura_em', { withTimezone: true })
       - assinadoEm: timestamp('assinado_em', { withTimezone: true })
    2. Escrever drizzle/0030_contratos_assinatura.sql À MÃO (APENAS ADD COLUMN IF NOT EXISTS — snapshot do drizzle pode estar contaminado, mesmo caso da 0029; se rodar drizzle-kit generate, LIMPAR o SQL para conter só as 4 colunas). Criar scripts/aplicar-migration-0030.ts no modelo do aplicar-migration-0024.ts (DIRECT_URL, sql.begin, split por '--> statement-breakpoint'). NÃO aplicar.
    3. src/lib/contratos/fluxo.ts: nenhum estado novo é necessário (fluxo já tem os 4); apenas garantir que a Parte 2 usa 'aguardando_assinatura'/'assinado'. Adicionar helper puro `rotuloTipoDocumento(tipo: string | null): string` (null → 'Contrato'; 'aditivo' → 'Aditivo'; desconhecido → capitalizado).
    4. Extrair o TEXTO dos dois DOCX (contratos/*.docx) uma única vez em dev — usar `npx mammoth` ou unzip do word/document.xml — e versionar como template TS em src/lib/contratos/template-trafego.ts: função `montarContratoHtml(vars)` que devolve o HTML completo do contrato (cláusulas fiéis ao texto dos DOCX; as diferenças entre 3 e 6 meses viram condicionais por duracaoMeses — comparar os dois textos; tipicamente só vigência/valores mudam). Estrutura: array de seções { titulo, paragrafos } + interpolação das variáveis — nada de docxtemplater/pizzip em runtime (DOCX não tem placeholders; template versionado é a rota robusta para serverless).
    5. src/lib/contratos/variaveis.ts: implementar montarVariaveisContrato até os testes passarem (GREEN).
    Commits: test → feat (padrão RED/GREEN do projeto).
  </action>
  <verify>
    <automated>npx vitest run src/lib/contratos && npx tsc --noEmit</automated>
  </verify>
  <done>Migration 0030 gerada (só 4 ADD COLUMN, não aplicada), script pontual criado, variaveis.ts com testes verdes, template-trafego.ts com o texto integral do contrato versionado.</done>
</task>

<task type="auto">
  <name>Tarefa 2: Preview HTML, PDF serverless, cliente Autentique, actions de envio/atualização e webhook</name>
  <files>src/app/(app)/contratos/preview/[id]/page.tsx, src/lib/contratos/pdf.tsx, src/lib/autentique/client.ts, src/actions/contratos.ts, src/app/api/webhooks/autentique/route.ts</files>
  <action>
    1. **Preview** — rota INTERNA (autenticada, dentro do grupo (app)) /contratos/preview/[id]: Server Component que carrega o contrato + cliente, monta vars (montarVariaveisContrato) e renderiza montarContratoHtml em página imprimível (tipografia serifada, max-w, botão window.print via client component pequeno). dadosContratante ausente → aviso "Aguardando os dados do contratante" com link de copiar o formulário público. Degradação: colunas 0029/0030 ausentes → mensagem amigável.
    2. **PDF** — src/lib/contratos/pdf.tsx com `@react-pdf/renderer` (instalar; leve e suficiente para contrato textual — NADA de puppeteer/chromium no Hobby): `gerarPdfContrato(vars): Promise<Buffer>` mapeando as mesmas seções do template para <Document>/<Page>/<Text>. Fonte padrão Helvetica (evitar registro de fontes externas).
    3. **Cliente Autentique** — src/lib/autentique/client.ts (módulo server em lib, NÃO 'use server'): fetch para https://api.autentique.com.br/v2/graphql com Bearer AUTENTIQUE_API_TOKEN.
       - `criarDocumento({ nome, pdf, signatario: { email, nome } })`: multipart GraphQL (spec graphql-multipart-request: campos operations/map/file com FormData + Blob) usando a mutation CreateDocumentMutation (document { name }, signers [{ email, action: SIGN }], file). Retorna { id } do documento.
       - `consultarDocumento(id)`: query do documento com signatures { signed { created_at } } para saber se todos assinaram.
       - Token ausente → lançar erro tipado TOKEN_AUSENTE.
    4. **Actions** em src/actions/contratos.ts (todas com requireAdmin? NÃO — envio é operação da equipe; usar getCurrentUser/sessão como as demais; deleteContrato continua admin):
       - `enviarParaAssinatura(contratoId)`: carrega contrato+cliente (sequencial), exige dadosContratante presente (senão erro "O contratante ainda não preencheu os dados."), monta vars, gera PDF, cria documento na Autentique com email do dadosContratante; grava autentiqueDocumentoId, enviadoParaAssinaturaEm=now, statusFluxo='aguardando_assinatura'. TOKEN_AUSENTE → { error: 'Configure o token da Autentique (AUTENTIQUE_API_TOKEN na Vercel).' } (decisão LOCKED). Reenvio = mesma action quando statusFluxo==='aguardando_assinatura': cria NOVO documento (regenera com dados atuais) e sobrescreve o id — comentar por quê.
       - `atualizarStatusAssinatura(contratoId)`: consulta a Autentique; se todos assinaram → statusFluxo='assinado', assinadoEm=now, e UPDATE clientes SET status='ativo' WHERE id=clienteId (sequencial, nunca Promise.all); revalidatePath('/contratos') e do cliente.
       - `atualizarDadosContrato(id, input)`: estende a edição para também aceitar tipoDocumento, servico, duracaoMeses além de datas/valor (reusar contratoSchema + campos novos com Zod; manter admin como atualizarContrato — pode evoluir a existente em vez de criar nova).
    5. **Webhook** — src/app/api/webhooks/autentique/route.ts (POST, público): parse defensivo do JSON (formatos da Autentique variam; aceitar payloads com document.id / documento id em campos alternativos); localizar contrato por autentiqueDocumentoId; se evento indicar assinatura concluída (ou na dúvida, CONSULTAR consultarDocumento(id) para confirmar — fonte da verdade é a API, não o payload) → mesmo efeito de atualizarStatusAssinatura. Sempre responder 200 rápido; try/catch com log. Sem token de validação disponível → validar pela consulta à API (documentar). O botão "Atualizar status" da Tarefa 3 é o fallback oficial.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>Preview interno renderiza o contrato preenchido; enviarParaAssinatura cria documento na Autentique (ou erro amigável sem token); webhook + atualizarStatusAssinatura marcam 'assinado' e ativam o cliente.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Tabela /contratos reformada — 12 colunas exatas + dialogs Verificar/Editar/Excluir + seleção</name>
  <files>src/app/(app)/contratos/page.tsx, src/app/(app)/contratos/tabela-contratos.tsx, src/components/contratos/verificar-dados-dialog.tsx, src/components/contratos/editar-contrato-dialog.tsx, src/components/contratos/excluir-contrato-alert.tsx, src/actions/contratos.ts</files>
  <action>
    1. Estender listarTodosContratos/ContratoConsolidado com tipoDocumento, autentiqueDocumentoId, dadosContratante, enviadoParaAssinaturaEm, assinadoEm — mantendo o try/catch de degradação (0029/0030 pendentes → campos null; encadear: tentar consulta completa → sem 0030 → sem 0029 → antiga).
    2. page.tsx continua Server Component (StatCards intactos) e passa os dados para o novo client component tabela-contratos.tsx.
    3. Tabela com as colunas EXATAS nesta ordem (decisão LOCKED): Cliente | Tipo | Valor | Status | Início | Fim | Verificar | Enviar/Reenviar | Preview | Editar | Excluir | Selecionar.
       - Cliente: link p/ /clientes/[id] + "(anterior)" quando não vigente.
       - Tipo: rotuloTipoDocumento (null → "Contrato").
       - Valor: mensalidade em BRL.
       - Status: badge do fluxo (badgeStatusFluxo, legado "Manual"); quando aguardando_dados, manter o botão copiar link junto do badge (não perder a funcionalidade da Parte 1).
       - Verificar: botão-ícone (Eye/ClipboardCheck) com Tooltip; desabilitado sem dadosContratante; abre verificar-dados-dialog.tsx mostrando PJ/PF formatado (rótulos pt-BR, CPF/CNPJ mascarados, data de recebimento).
       - Enviar/Reenviar: botão (Send) — "Enviar" quando dados_recebidos, "Reenviar" quando aguardando_assinatura, desabilitado com tooltip explicativo nos demais estados; chama enviarParaAssinatura com useTransition + toast (sonner se já existir no projeto; senão mensagem inline). Quando aguardando_assinatura, mostrar também botão secundário "Atualizar status" (RefreshCw) → atualizarStatusAssinatura (fallback do webhook).
       - Preview: link (FileText) para /contratos/preview/[id], desabilitado sem dadosContratante.
       - Editar: dialog RHF+Zod (editar-contrato-dialog.tsx) com datas, mensalidade, serviço, duração e tipo de documento → atualizarDadosContrato.
       - Excluir: AlertDialog de confirmação (excluir-contrato-alert.tsx) → deleteContrato (copy: "Excluir o contrato de {cliente}? Esta ação não pode ser desfeita.").
       - Selecionar: Checkbox por linha + checkbox "selecionar todos" no header; estado local com contagem "N selecionados" acima da tabela (base p/ ações em lote futuras — por ora só seleção/contagem, sem ação falsa).
    4. Ícones lucide + Tooltip do shadcn; adicionar componentes shadcn faltantes (tooltip, alert-dialog, checkbox) via CLI se não existirem no registry local. Dark mode: usar tokens/variantes dark: nas cores novas.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>/contratos exibe as 12 colunas na ordem exata; Verificar/Editar/Excluir funcionam via dialogs; Enviar mostra erro amigável sem token; seleção com contagem funciona; suite completa verde e build compila.</done>
</task>

</tasks>

<verification>
- `npx vitest run` — suite completa verde (incl. novos testes de variaveis)
- `npx tsc --noEmit` limpo; `npm run build` compila (erros ECONNREFUSED de prerender sem banco são pré-existentes)
- drizzle/0030_contratos_assinatura.sql contém APENAS ADD COLUMN (sem DROP/ALTER destrutivo)
- Nenhum Promise.all novo com queries no mesmo client
- Nenhuma rota pública nova além de /api/webhooks/autentique
- Toda a UI em português brasileiro; badges com dark:
</verification>

<success_criteria>
- Tabela /contratos com as 12 colunas exatas na ordem pedida (decisão LOCKED)
- Contrato preenchido gerado dos templates 3/6 meses (texto fiel aos DOCX), preview interno imprimível
- Envio/reenvio via Autentique com PDF; erro amigável "Configure o token da Autentique" sem env
- Assinado (webhook OU botão Atualizar status) → statusFluxo 'assinado' + cliente ativo
- Migration 0030 gerada e NÃO aplicada, com script pontual pronto; degradação graciosa até aplicar
</success_criteria>

<output>
Após a conclusão, criar `.planning/quick/260716-gxq-fase-4-parte-2-contratos-tabela-reformad/260716-gxq-SUMMARY.md`

No SUMMARY, registrar o checkpoint humano: aplicar migrations 0029+0030 na mão (em ordem), configurar AUTENTIQUE_API_TOKEN na Vercel, cadastrar a URL do webhook (/api/webhooks/autentique) no painel da Autentique e testar o fluxo ponta a ponta em produção.
</output>

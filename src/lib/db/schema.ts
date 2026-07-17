import { pgTable, pgEnum, uuid, text, timestamp, date, numeric, integer, index, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

export const roleEnum = pgEnum('role', ['admin', 'membro'])
export const nichoEnum = pgEnum('nicho', ['ecommerce', 'negocio_local', 'infoproduto'])
// `aguardando_inicio` = lead que já fechou contrato mas está em onboarding.
// `em_aviso` = cliente ativo porém sinalizado (risco/atenção).
// Valores novos vão no FIM: `ALTER TYPE ... ADD VALUE` só acrescenta, nunca reordena.
export const clienteStatusEnum = pgEnum('cliente_status', ['ativo', 'pausado', 'encerrado', 'aguardando_inicio', 'em_aviso'])
export const tipoPessoaEnum = pgEnum('tipo_pessoa', ['fisica', 'juridica'])
export const formaPagamentoEnum = pgEnum('forma_pagamento', ['pix', 'boleto', 'cartao', 'transferencia'])

// Estende auth.users (gerenciado pelo Supabase) — NÃO redefinir auth.users aqui.
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // == auth.users.id, setado explicitamente no insert
  nome: text('nome').notNull(),
  role: roleEnum('role').notNull().default('membro'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const clientes = pgTable('clientes', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  nicho: nichoEnum('nicho').notNull(),
  status: clienteStatusEnum('status').notNull().default('ativo'),
  contatoNome: text('contato_nome'),
  contatoTelefone: text('contato_telefone'),
  contatoEmail: text('contato_email'),
  notas: text('notas'),
  /** DEPRECIADA (0033) — substituída por modoCobranca. Mantida só para não quebrar código antigo. */
  usaAsaas: boolean('usa_asaas').notNull().default(false),
  /** 'automatico_asaas' | 'manual_pix' — cliente manual NUNCA gera chamada ao Asaas. */
  modoCobranca: text('modo_cobranca').notNull().default('manual_pix'),
  // Dados fiscais / pessoa
  tipoPessoa: tipoPessoaEnum('tipo_pessoa').default('juridica'),
  documento: text('documento'),
  razaoSocial: text('razao_social'),
  nomeFantasia: text('nome_fantasia'),
  // Endereço
  endereco: text('endereco'),
  cidade: text('cidade'),
  estado: text('estado'),
  cep: text('cep'),
  // Online
  instagram: text('instagram'),
  siteUrl: text('site_url'),
  // Pagamento
  formaPagamento: formaPagamentoEnum('forma_pagamento'),
  diaPagamento: integer('dia_pagamento'),
  // Id do customer no Asaas (nulo = ainda não cadastrado lá). Migration 0032.
  asaasCustomerId: text('asaas_customer_id'),
  // Serviços
  servicosContratados: jsonb('servicos_contratados'),
  // Operação
  gestorId: uuid('gestor_id').references(() => profiles.id, { onDelete: 'set null' }),
  verbaMensal: numeric('verba_mensal', { precision: 10, scale: 2 }),
  ticketMedio: numeric('ticket_medio', { precision: 10, scale: 2 }),
  agendamentoPosts: boolean('agendamento_posts').notNull().default(false),
  frequenciaPosts: text('frequencia_posts'),
  origemCliente: text('origem_cliente'),
  objetivoPrincipal: text('objetivo_principal'),
  linkDrive: text('link_drive'),
  // Metas de performance alvo por cliente (nullable). Nulo = sem meta manual →
  // a avaliação de saúde cai no baseline automático por histórico.
  metaCpa: numeric('meta_cpa', { precision: 10, scale: 2 }),
  metaCpl: numeric('meta_cpl', { precision: 10, scale: 2 }),
  metaRoas: numeric('meta_roas', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const contratos = pgTable('contratos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  dataInicio: date('data_inicio').notNull(),
  dataVencimento: date('data_vencimento').notNull(),
  valorMensal: numeric('valor_mensal', { precision: 10, scale: 2 }).notNull(), // NUNCA float/real para dinheiro
  // --- Fluxo de coleta de dados (Fase 4 Parte 1) — TUDO nullable: contratos
  // antigos (cadastrados na mão) não têm token nem fluxo. status_fluxo é text
  // (NÃO pgEnum) de propósito: a Parte 2 (PDF + Autentique) adiciona estados
  // sem migration de enum. Valores: 'aguardando_dados' | 'dados_recebidos' |
  // 'aguardando_assinatura' | 'assinado' (união TS em src/lib/contratos/fluxo.ts).
  token: text('token').unique(), // link público /contrato/[token]
  statusFluxo: text('status_fluxo'),
  duracaoMeses: integer('duracao_meses'),
  servico: text('servico'), // chave de SERVICOS_JSR (src/lib/crm/servicos.ts)
  dadosContratante: jsonb('dados_contratante'), // PJ/PF preenchido pelo cliente
  dadosRecebidosEm: timestamp('dados_recebidos_em', { withTimezone: true }),
  // [{servico, valor, plataformas?}] — ver src/lib/contratos/servicos-contratados.ts;
  // null = contrato legado (usa servico/valorMensal). Migration 0031 (nullable).
  servicos: jsonb('servicos'),
  // --- Assinatura eletrônica (Fase 4 Parte 2) — TUDO nullable (migration 0030).
  tipoDocumento: text('tipo_documento'), // nulo exibe "Contrato" na UI
  autentiqueDocumentoId: text('autentique_documento_id'),
  enviadoParaAssinaturaEm: timestamp('enviado_para_assinatura_em', { withTimezone: true }),
  assinadoEm: timestamp('assinado_em', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteIdx: index('contratos_cliente_id_idx').on(table.clienteId, table.dataInicio),
}))

// Cobranças/faturas da mensalidade (Fase 5 Parte 1 — migration 0032, quick-260716-qzu).
// NOSSA tabela é a fonte da verdade (D-04); o Asaas é um meio de quitação.
// Tabela NOVA de propósito — NÃO reusa `transacoes` (livro-caixa do financeiro,
// com recorrência/centro de custo próprios). Integração cobrancas → transacoes
// fica para uma parte futura da Fase 5.
// status: 'pendente' | 'paga' | 'vencida' | 'cancelada' (text, não enum).
// forma_quitacao: 'asaas' | 'pix_manual' | null. criado_via: 'automatico' | 'manual'.
export const cobrancas = pgTable('cobrancas', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  contratoId: uuid('contrato_id').references(() => contratos.id, { onDelete: 'set null' }),
  competencia: text('competencia').notNull(), // 'YYYY-MM'
  valor: numeric('valor', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('pendente'),
  vencimento: date('vencimento').notNull(),
  asaasPaymentId: text('asaas_payment_id').unique(),
  invoiceUrl: text('invoice_url'),
  formaQuitacao: text('forma_quitacao'),
  pagoEm: timestamp('pago_em', { withTimezone: true }),
  criadoVia: text('criado_via').notNull().default('automatico'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Índice único PARCIAL (WHERE criado_via='automatico'): o fluxo automático
  // nunca duplica o mês; cobranças manuais extras continuam livres.
  contratoCompetenciaUniq: uniqueIndex('cobrancas_contrato_competencia_uniq')
    .on(table.contratoId, table.competencia)
    .where(sql`${table.criadoVia} = 'automatico'`),
}))

export type Cobranca = typeof cobrancas.$inferSelect
export type NovaCobranca = typeof cobrancas.$inferInsert

export const tipoTransacaoEnum = pgEnum('tipo_transacao', ['receita', 'despesa'])
export const categoriaTransacaoEnum = pgEnum('categoria_transacao', ['mensalidade', 'projeto', 'outro', 'ferramenta', 'ads_agencia', 'salario'])
export const statusTransacaoEnum = pgEnum('status_transacao', ['pago', 'pendente', 'vencido'])
export const centroCustoEnum = pgEnum('centro_custo', ['operacao', 'midia', 'infraestrutura'])
export const recorrenciaEnum = pgEnum('recorrencia', ['semanal', 'mensal', 'trimestral', 'avulsa'])

export const transacoes = pgTable('transacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: tipoTransacaoEnum('tipo').notNull(),
  categoria: categoriaTransacaoEnum('categoria').notNull(),
  clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
  descricao: text('descricao').notNull(),
  valor: numeric('valor', { precision: 10, scale: 2 }).notNull(),
  data: date('data').notNull(),
  status: statusTransacaoEnum('status').notNull().default('pendente'),
  diaVencto: integer('dia_vencto'),
  notas: text('notas'),
  centroCusto: centroCustoEnum('centro_custo'),
  recorrencia: recorrenciaEnum('recorrencia').notNull().default('avulsa'),
  transacaoPaiId: uuid('transacao_pai_id').references((): any => transacoes.id, { onDelete: 'set null' }),
  formaPagamento: formaPagamentoEnum('forma_pagamento_transacao'),
  responsavelId: uuid('responsavel_id').references(() => profiles.id, { onDelete: 'set null' }),
  comprovanteUrl: text('comprovante_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  dataIdx: index('transacoes_data_idx').on(table.data, table.tipo),
}))

export const plataformaEnum = pgEnum('plataforma', ['meta', 'google'])

export const adAccounts = pgTable('ad_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
  plataforma: plataformaEnum('plataforma').notNull(),
  metaAccountId: text('meta_account_id').notNull(),
  nome: text('nome').notNull(),
  accountStatus: integer('account_status'),
  currency: text('currency').default('BRL'),
  saldo: numeric('saldo', { precision: 12, scale: 2 }),
  fundingSource: text('funding_source'), // 'credit_card', 'prepaid', 'invoice', etc.
  ativo: boolean('ativo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  metaAccountIdIdx: uniqueIndex('ad_accounts_meta_account_id_idx').on(table.metaAccountId),
}))

export const campaignInsights = pgTable('campaign_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  adAccountId: uuid('ad_account_id').notNull().references(() => adAccounts.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull(),
  campaignName: text('campaign_name').notNull(),
  date: date('date').notNull(),
  spend: numeric('spend', { precision: 10, scale: 2 }).notNull().default('0'),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  reach: integer('reach').default(0),
  cpc: numeric('cpc', { precision: 10, scale: 4 }),
  cpm: numeric('cpm', { precision: 10, scale: 4 }),
  ctr: numeric('ctr', { precision: 8, scale: 4 }),
  actions: jsonb('actions'),
  actionValues: jsonb('action_values'),
  // Objetivo OFICIAL da campanha na Meta (ex.: 'OUTCOME_SALES', 'OUTCOME_LEADS').
  // Nullable: linhas antigas (pré-Etapa 2) não têm; classificarObjetivo é o fallback.
  objective: text('objective'),
  // effective_status OFICIAL da campanha na Meta ('ACTIVE', 'PAUSED', ...).
  // Nullable: linhas antigas não têm; o sync grava por campanha (fix 17/jul/2026).
  effectiveStatus: text('effective_status'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountDateCampaignIdx: index('ci_account_date_campaign_idx').on(table.adAccountId, table.date, table.campaignId),
}))

// --- Demografia Insights (breakdown idade × gênero, janela agregada ~30d) ---
// Como ad_insights: 1 janela nova por dia de sync — o painel usa SEMPRE a janela
// mais recente por (campaignId, age, gender) via maior dateStop.
export const demografiaInsights = pgTable('demografia_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  adAccountId: uuid('ad_account_id').notNull().references(() => adAccounts.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull(),
  campaignName: text('campaign_name').notNull(),
  age: text('age').notNull(), // '13-17' | '18-24' | ... | '65+' | 'Unknown'
  gender: text('gender').notNull(), // 'male' | 'female' | 'unknown'
  spend: numeric('spend', { precision: 10, scale: 2 }).notNull().default('0'),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  actions: jsonb('actions'),
  actionValues: jsonb('action_values'),
  dateStart: date('date_start').notNull(),
  dateStop: date('date_stop').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountCampaignDateIdx: index('demografia_account_campaign_date_idx').on(table.adAccountId, table.campaignId, table.dateStop),
}))

// --- Região Insights (breakdown region, janela agregada ~30d) ---
export const regiaoInsights = pgTable('regiao_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  adAccountId: uuid('ad_account_id').notNull().references(() => adAccounts.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull(),
  campaignName: text('campaign_name').notNull(),
  region: text('region').notNull(),
  spend: numeric('spend', { precision: 10, scale: 2 }).notNull().default('0'),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  actions: jsonb('actions'),
  actionValues: jsonb('action_values'),
  dateStart: date('date_start').notNull(),
  dateStop: date('date_stop').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountCampaignDateIdx: index('regiao_account_campaign_date_idx').on(table.adAccountId, table.campaignId, table.dateStop),
}))

export const frequenciaChecklistEnum = pgEnum('frequencia_checklist', ['diaria', 'semanal', 'mensal'])

export const checklistItems = pgTable('checklist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  tarefa: text('tarefa').notNull(),
  frequencia: frequenciaChecklistEnum('frequencia').notNull(),
  concluido: boolean('concluido').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteIdx: index('checklist_items_cliente_id_idx').on(table.clienteId),
}))

// --- Módulo Tarefas (estilo ClickUp) ---
// ⚠️ NÃO confundir com `checklist_items` acima: aquele é o checklist DA FICHA DO
// CLIENTE e segue vivo e intocado. Este módulo tem o SEU próprio checklist,
// interno à tarefa (`tarefa_checklist_items`).
export const tarefaStatusEnum = pgEnum('tarefa_status', ['a_fazer', 'em_andamento', 'concluida', 'nao_realizada'])
export const tarefaPrioridadeEnum = pgEnum('tarefa_prioridade', ['baixa', 'media', 'alta', 'urgente'])
export const tarefaRecorrenciaEnum = pgEnum('tarefa_recorrencia', ['nenhuma', 'diaria', 'semanal', 'mensal', 'anual', 'dia_sim_dia_nao', 'dias_uteis', 'personalizada'])

// Modelo MOLDE + ocorrências: a tarefa recorrente é um molde (eh_molde=true) que
// nunca aparece na lista; as ocorrências (eh_molde=false, tarefa_mae_id=molde)
// nascem pelo CALENDÁRIO, materializadas preguiçosamente ao abrir /tarefas.
export const tarefas = pgTable('tarefas', {
  id: uuid('id').primaryKey().defaultRandom(),
  titulo: text('titulo').notNull(),
  subtitulo: text('subtitulo'),
  notas: text('notas'),
  status: tarefaStatusEnum('status').notNull().default('a_fazer'),
  prioridade: tarefaPrioridadeEnum('prioridade').notNull().default('media'),
  data: date('data').notNull(), // vencimento, 'YYYY-MM-DD'
  clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
  responsavelId: uuid('responsavel_id').references(() => profiles.id, { onDelete: 'set null' }),
  recorrencia: tarefaRecorrenciaEnum('recorrencia').notNull().default('nenhuma'),
  recorrenciaDias: jsonb('recorrencia_dias'), // number[] p/ 'personalizada' (0=dom..6=sab)
  ehMolde: boolean('eh_molde').notNull().default(false),
  tarefaMaeId: uuid('tarefa_mae_id').references((): any => tarefas.id, { onDelete: 'cascade' }),
  ativa: boolean('ativa').notNull().default(true), // no MOLDE: false = série encerrada
  concluidaEm: timestamp('concluida_em', { withTimezone: true }),
  descricao: text('descricao'),
  etiquetas: jsonb('etiquetas'), // string[]
  tempoEstimado: text('tempo_estimado'), // texto livre, ex.: '4h'
  dataInicio: date('data_inicio'),
  // D-08: o pin do mockup. Fixada sobe no topo da coluna do quadro (ORDER BY).
  fixada: boolean('fixada').notNull().default(false),
  // D-04: `codigo_num` é a ÚNICA fonte sequencial (identity do Postgres) e
  // `codigo` é coluna GERADA a partir dela. Zero query extra, zero corrida —
  // nada de `select max()+1` (que duplicaria sob concorrência) nem de sequence
  // na mão. O espelho puro para exibição é codigoTarefa() em lib/tarefas/quadro.ts.
  codigoNum: integer('codigo_num').generatedByDefaultAsIdentity(),
  codigo: text('codigo').generatedAlwaysAs(sql`'TAR-' || lpad(codigo_num::text, 4, '0')`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  dataStatusIdx: index('tarefas_data_status_idx').on(table.data, table.status),
  codigoIdx: uniqueIndex('tarefas_codigo_idx').on(table.codigo),
  // ⚠️ GARANTIA DE IDEMPOTÊNCIA NO BANCO: uma ocorrência por molde por dia.
  // NULLs não conflitam entre si no Postgres → tarefas avulsas (tarefa_mae_id
  // NULL) não são afetadas por esta restrição. É a trava final contra corrida
  // quando dois requests abrem /tarefas ao mesmo tempo.
  maeDataIdx: uniqueIndex('tarefas_mae_data_idx').on(table.tarefaMaeId, table.data),
}))

export const tarefaChecklistItems = pgTable('tarefa_checklist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tarefaId: uuid('tarefa_id').notNull().references(() => tarefas.id, { onDelete: 'cascade' }),
  texto: text('texto').notNull(),
  concluido: boolean('concluido').notNull().default(false),
  ordem: integer('ordem').notNull().default(0),
  // D-08: o nome do grupo do checklist. `ordem` é contada DENTRO do grupo.
  // Default 'Checklist' mantém os itens já existentes num grupo válido.
  grupo: text('grupo').notNull().default('Checklist'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tarefaIdx: index('tarefa_checklist_tarefa_id_idx').on(table.tarefaId),
}))

// Comentários da tarefa (a aba "Comentários" do detalhe). `autor_nome` é
// denormalizado: evita o join na leitura, que roda sequencial e agregada.
export const tarefaComentarios = pgTable('tarefa_comentarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  tarefaId: uuid('tarefa_id').notNull().references(() => tarefas.id, { onDelete: 'cascade' }),
  autorId: uuid('autor_id').references(() => profiles.id, { onDelete: 'set null' }),
  autorNome: text('autor_nome').notNull(),
  texto: text('texto').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tarefaCreatedIdx: index('tarefa_comentarios_tarefa_created_idx').on(table.tarefaId, table.createdAt),
}))

// Anexos da tarefa. D-04: reutilizam o bucket `documentos` com prefixo
// `tarefas/{tarefaId}/` — zero setup novo de storage.
export const tarefaAnexos = pgTable('tarefa_anexos', {
  id: uuid('id').primaryKey().defaultRandom(),
  tarefaId: uuid('tarefa_id').notNull().references(() => tarefas.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  tamanhoBytes: integer('tamanho_bytes').notNull(),
  mimeType: text('mime_type').notNull(),
  storagePath: text('storage_path').notNull(),
  uploadPorId: uuid('upload_por_id').references(() => profiles.id, { onDelete: 'set null' }),
  uploadPorNome: text('upload_por_nome').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tarefaIdx: index('tarefa_anexos_tarefa_id_idx').on(table.tarefaId),
}))

// Histórico da tarefa (o card "Atividade Recente"). D-03: `tipo` é text, não
// pgEnum — um tipo de atividade novo não pode exigir migration.
export const tarefaAtividades = pgTable('tarefa_atividades', {
  id: uuid('id').primaryKey().defaultRandom(),
  tarefaId: uuid('tarefa_id').notNull().references(() => tarefas.id, { onDelete: 'cascade' }),
  autorId: uuid('autor_id').references(() => profiles.id, { onDelete: 'set null' }),
  autorNome: text('autor_nome').notNull(),
  tipo: text('tipo').notNull(),
  campo: text('campo'),
  de: text('de'),
  para: text('para'),
  detalhe: text('detalhe'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tarefaCreatedIdx: index('tarefa_atividades_tarefa_created_idx').on(table.tarefaId, table.createdAt),
}))

export const tarefasRelations = relations(tarefas, ({ one, many }) => ({
  cliente: one(clientes, { fields: [tarefas.clienteId], references: [clientes.id] }),
  responsavel: one(profiles, { fields: [tarefas.responsavelId], references: [profiles.id] }),
  tarefaMae: one(tarefas, { fields: [tarefas.tarefaMaeId], references: [tarefas.id], relationName: 'ocorrencias' }),
  checklistItems: many(tarefaChecklistItems),
  comentarios: many(tarefaComentarios),
  anexos: many(tarefaAnexos),
  atividades: many(tarefaAtividades),
}))

export const tarefaChecklistItemsRelations = relations(tarefaChecklistItems, ({ one }) => ({
  tarefa: one(tarefas, { fields: [tarefaChecklistItems.tarefaId], references: [tarefas.id] }),
}))

export const tarefaComentariosRelations = relations(tarefaComentarios, ({ one }) => ({
  tarefa: one(tarefas, { fields: [tarefaComentarios.tarefaId], references: [tarefas.id] }),
  autor: one(profiles, { fields: [tarefaComentarios.autorId], references: [profiles.id] }),
}))

export const tarefaAnexosRelations = relations(tarefaAnexos, ({ one }) => ({
  tarefa: one(tarefas, { fields: [tarefaAnexos.tarefaId], references: [tarefas.id] }),
  uploadPor: one(profiles, { fields: [tarefaAnexos.uploadPorId], references: [profiles.id] }),
}))

export const tarefaAtividadesRelations = relations(tarefaAtividades, ({ one }) => ({
  tarefa: one(tarefas, { fields: [tarefaAtividades.tarefaId], references: [tarefas.id] }),
  autor: one(profiles, { fields: [tarefaAtividades.autorId], references: [profiles.id] }),
}))

export const acompanhamentos = pgTable('acompanhamentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  autorId: uuid('autor_id'),
  autorNome: text('autor_nome').notNull(),
  nota: text('nota').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteCreatedIdx: index('acompanhamentos_cliente_created_idx').on(table.clienteId, table.createdAt),
}))

export const clientesRelations = relations(clientes, ({ one, many }) => ({
  gestor: one(profiles, { fields: [clientes.gestorId], references: [profiles.id] }),
  contratos: many(contratos),
  transacoes: many(transacoes),
  adAccounts: many(adAccounts),
  checklistItems: many(checklistItems),
  acompanhamentos: many(acompanhamentos),
  documentos: many(documentos),
  tarefas: many(tarefas),
}))
export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  cliente: one(clientes, { fields: [checklistItems.clienteId], references: [clientes.id] }),
}))
export const acompanhamentosRelations = relations(acompanhamentos, ({ one }) => ({
  cliente: one(clientes, { fields: [acompanhamentos.clienteId], references: [clientes.id] }),
}))
export const contratosRelations = relations(contratos, ({ one }) => ({
  cliente: one(clientes, { fields: [contratos.clienteId], references: [clientes.id] }),
}))
export const cobrancasRelations = relations(cobrancas, ({ one }) => ({
  cliente: one(clientes, { fields: [cobrancas.clienteId], references: [clientes.id] }),
  contrato: one(contratos, { fields: [cobrancas.contratoId], references: [contratos.id] }),
}))
export const transacoesRelations = relations(transacoes, ({ one }) => ({
  cliente: one(clientes, { fields: [transacoes.clienteId], references: [clientes.id] }),
  responsavel: one(profiles, { fields: [transacoes.responsavelId], references: [profiles.id] }),
  transacaoPai: one(transacoes, { fields: [transacoes.transacaoPaiId], references: [transacoes.id], relationName: 'parcelas' }),
}))
export const adAccountsRelations = relations(adAccounts, ({ one, many }) => ({
  cliente: one(clientes, { fields: [adAccounts.clienteId], references: [clientes.id] }),
  campaignInsights: many(campaignInsights),
}))
export const campaignInsightsRelations = relations(campaignInsights, ({ one }) => ({
  adAccount: one(adAccounts, { fields: [campaignInsights.adAccountId], references: [adAccounts.id] }),
}))
export const demografiaInsightsRelations = relations(demografiaInsights, ({ one }) => ({
  adAccount: one(adAccounts, { fields: [demografiaInsights.adAccountId], references: [adAccounts.id] }),
}))
export const regiaoInsightsRelations = relations(regiaoInsights, ({ one }) => ({
  adAccount: one(adAccounts, { fields: [regiaoInsights.adAccountId], references: [adAccounts.id] }),
}))

// --- Adset Insights (conjuntos de anúncio) ---
export const adsetInsights = pgTable('adset_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  adAccountId: uuid('ad_account_id').notNull().references(() => adAccounts.id, { onDelete: 'cascade' }),
  adsetId: text('adset_id').notNull(),
  adsetName: text('adset_name').notNull(),
  campaignId: text('campaign_id'),
  campaignName: text('campaign_name'),
  spend: numeric('spend', { precision: 10, scale: 2 }).notNull().default('0'),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  reach: integer('reach').default(0),
  ctr: numeric('ctr', { precision: 8, scale: 4 }),
  actions: jsonb('actions'),
  actionValues: jsonb('action_values'),
  dateStart: date('date_start').notNull(),
  dateStop: date('date_stop').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountAdsetDateIdx: index('adset_account_adset_date_idx').on(table.adAccountId, table.adsetId, table.dateStart),
}))

// --- Ad Insights (criativos/anúncios individuais) ---
export const adInsights = pgTable('ad_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  adAccountId: uuid('ad_account_id').notNull().references(() => adAccounts.id, { onDelete: 'cascade' }),
  adId: text('ad_id').notNull(),
  adName: text('ad_name').notNull(),
  adsetId: text('adset_id'),
  adsetName: text('adset_name'),
  campaignId: text('campaign_id'),
  campaignName: text('campaign_name'),
  thumbnailUrl: text('thumbnail_url'),
  effectiveStatus: text('effective_status'),
  spend: numeric('spend', { precision: 10, scale: 2 }).notNull().default('0'),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  reach: integer('reach').default(0),
  frequency: numeric('frequency', { precision: 8, scale: 4 }),
  ctr: numeric('ctr', { precision: 8, scale: 4 }),
  actions: jsonb('actions'),
  actionValues: jsonb('action_values'),
  dateStart: date('date_start').notNull(),
  dateStop: date('date_stop').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountAdDateIdx: index('ad_account_ad_date_idx').on(table.adAccountId, table.adId, table.dateStart),
}))

export const adsetInsightsRelations = relations(adsetInsights, ({ one }) => ({
  adAccount: one(adAccounts, { fields: [adsetInsights.adAccountId], references: [adAccounts.id] }),
}))
export const adInsightsRelations = relations(adInsights, ({ one }) => ({
  adAccount: one(adAccounts, { fields: [adInsights.adAccountId], references: [adAccounts.id] }),
}))

// --- Documentos ---
export const categoriaDocumentoEnum = pgEnum('categoria_documento', ['contrato', 'comprovante', 'briefing', 'criativo', 'relatorio', 'outro'])

export const documentos = pgTable('documentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  categoria: categoriaDocumentoEnum('categoria').notNull().default('outro'),
  tamanhoBytes: integer('tamanho_bytes').notNull(),
  mimeType: text('mime_type').notNull(),
  storagePath: text('storage_path').notNull(),
  uploadPorId: uuid('upload_por_id').references(() => profiles.id, { onDelete: 'set null' }),
  uploadPorNome: text('upload_por_nome').notNull(),
  notas: text('notas'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteIdx: index('documentos_cliente_id_idx').on(table.clienteId),
}))

export const documentosRelations = relations(documentos, ({ one }) => ({
  cliente: one(clientes, { fields: [documentos.clienteId], references: [clientes.id] }),
  uploadPor: one(profiles, { fields: [documentos.uploadPorId], references: [profiles.id] }),
}))

// --- Alertas persistidos ---
// Alimentada pelo cron diário (avaliarEPersistirAlertas). A identidade lógica de
// um alerta é a chaveDedup (o mesmo id estável que os avaliadores já produzem,
// ex.: `verba-${contaId}`) — uma única linha por chave, com ciclo de vida
// novo → lido → resolvido (e reabertura automática se o problema voltar).
export const alertas = pgTable('alertas', {
  id: uuid('id').primaryKey().defaultRandom(),
  // text (não pgEnum) de propósito: novos tipos de alerta não podem exigir migration
  tipo: text('tipo').notNull(),
  clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'cascade' }),
  clienteNome: text('cliente_nome').notNull(), // denormalizado — evita join na leitura
  titulo: text('titulo').notNull(),
  detalhe: text('detalhe').notNull(),
  severidade: text('severidade').notNull(), // 'critico' | 'atencao' | 'info'
  status: text('status').notNull().default('novo'), // 'novo' | 'lido' | 'resolvido'
  chaveDedup: text('chave_dedup').notNull(), // identidade lógica (única)
  dataRelevante: text('data_relevante').notNull(), // YYYY-MM-DD (mesmo formato do tipo Alerta)
  detectadoEm: timestamp('detectado_em', { withTimezone: true }).notNull().defaultNow(),
  resolvidoEm: timestamp('resolvido_em', { withTimezone: true }),
  // "Silenciar 7 dias" (Feature 2, 17/jul/2026): até esta data o alerta some do
  // sininho/listas ativas mesmo aberto. Nullable — linhas antigas não silenciam.
  silenciadoAte: timestamp('silenciado_ate', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  chaveDedupIdx: uniqueIndex('alertas_chave_dedup_idx').on(table.chaveDedup),
  statusIdx: index('alertas_status_idx').on(table.status), // contagem barata do sininho
}))

export const alertasRelations = relations(alertas, ({ one }) => ({
  cliente: one(clientes, { fields: [alertas.clienteId], references: [clientes.id] }),
}))

// --- Relatórios persistidos (histórico) ---
// Gravados pelo cron semanal (segunda 07h BR) e também pela geração manual.
export const relatorios = pgTable('relatorios', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  clienteNome: text('cliente_nome').notNull(), // denormalizado — evita join na leitura
  tipo: text('tipo').notNull(), // 'semanal' | 'manual' | 'automatico'
  periodoInicio: date('periodo_inicio').notNull(),
  periodoFim: date('periodo_fim').notNull(),
  conteudo: text('conteudo').notNull(), // texto pronto para WhatsApp
  configId: uuid('config_id').references(() => relatorioConfigs.id, { onDelete: 'set null' }),
  geradoEm: timestamp('gerado_em', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteGeradoIdx: index('relatorios_cliente_gerado_idx').on(table.clienteId, table.geradoEm),
}))

export const relatoriosRelations = relations(relatorios, ({ one }) => ({
  cliente: one(clientes, { fields: [relatorios.clienteId], references: [clientes.id] }),
  config: one(relatorioConfigs, { fields: [relatorios.configId], references: [relatorioConfigs.id] }),
}))

// --- Relatórios configuráveis ---
// Uma config define UM relatório recorrente (semanal ou mensal) de um cliente,
// composto por N blocos de métricas (um por conta de anúncio) + compilado opcional.
// Campos de destino/horário são SALVOS PARA O FUTURO (envio automático de
// WhatsApp ainda não existe — hoje o fluxo é copiar e colar).
export const relatorioConfigs = pgTable('relatorio_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  frequencia: text('frequencia').notNull(), // 'semanal' | 'mensal'
  diaSemana: integer('dia_semana'), // 0-6 (domingo-sábado), quando semanal
  diaMes: integer('dia_mes'), // 1-31, quando mensal
  periodoDias: integer('periodo_dias'), // null = padrão da frequência (7 dias / mês anterior)
  horarioEnvio: text('horario_envio'), // 'HH:MM' — salvo para o futuro, não usado
  destinoTipo: text('destino_tipo'), // 'privado' | 'grupo' — futuro
  destinoValor: text('destino_valor'), // número ou nome do grupo — futuro
  cabecalho: text('cabecalho').notNull(), // template com variáveis ({{cliente}}, {{date_range}}...)
  incluirCompilado: boolean('incluir_compilado').notNull().default(true),
  mensagemCompilado: text('mensagem_compilado'),
  ativo: boolean('ativo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteIdx: index('relatorio_configs_cliente_idx').on(table.clienteId),
}))

export const relatorioBlocos = pgTable('relatorio_blocos', {
  id: uuid('id').primaryKey().defaultRandom(),
  configId: uuid('config_id').notNull().references(() => relatorioConfigs.id, { onDelete: 'cascade' }),
  ordem: integer('ordem').notNull(),
  adAccountId: uuid('ad_account_id').notNull().references(() => adAccounts.id, { onDelete: 'cascade' }),
  nivel: text('nivel').notNull(), // 'conta' | 'campanhas'
  campanhasSelecionadas: jsonb('campanhas_selecionadas'), // string[] de campaignId; null quando nivel='conta'
  metricas: jsonb('metricas').notNull(), // string[] de chaves do catálogo de variáveis
  mensagem: text('mensagem').notNull(), // template com variáveis
}, (table) => ({
  configIdx: index('relatorio_blocos_config_idx').on(table.configId, table.ordem),
}))

export const relatorioConfigsRelations = relations(relatorioConfigs, ({ one, many }) => ({
  cliente: one(clientes, { fields: [relatorioConfigs.clienteId], references: [clientes.id] }),
  blocos: many(relatorioBlocos),
}))

export const relatorioBlocosRelations = relations(relatorioBlocos, ({ one }) => ({
  config: one(relatorioConfigs, { fields: [relatorioBlocos.configId], references: [relatorioConfigs.id] }),
  adAccount: one(adAccounts, { fields: [relatorioBlocos.adAccountId], references: [adAccounts.id] }),
}))

// --- Credenciais do Google (integração com o Google Calendar) ---
// Tabela SINGLE-TENANT: o app tem UM único usuário, então esta tabela guarda
// no máximo UMA linha (a conta Google conectada). NÃO há coluna de tenant/org.
// O refresh_token é indispensável para renovar o access_token automaticamente.
export const googleCredentials = pgTable('google_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'), // e-mail da conta Google conectada (best-effort, pode faltar)
  accessToken: text('access_token'), // token de curta duração (renovável)
  refreshToken: text('refresh_token').notNull(), // usado para renovar o access_token
  expiry: timestamp('expiry', { withTimezone: true }), // quando o access_token expira
  scope: text('scope'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- CRM comercial ---
// Prefixo crm_ em todas as tabelas do módulo. `workspaces` está preparado para
// multi-tenant no futuro, mas o v1 tem UMA única linha (workspace 'JSR', criado
// pelo seed da migration 0019) — o helper getWorkspaceAtual() resolve essa linha.
// ⚠️ NÃO confundir `crm_tarefas` (tarefas COMERCIAIS: ligação, follow-up,
// reunião de venda) com o módulo Tarefas operacional acima (`tarefas`), que
// segue vivo e INTOCADO.
// Padrão Pipedrive: ganho/perdido NÃO são etapas do pipeline — são STATUS da
// oportunidade ('aberta' | 'ganha' | 'perdida'); as etapas só descrevem o
// caminho da negociação.
// Status/tipos/papéis/origens são `text` (NÃO pgEnum) de propósito: valores
// novos não podem exigir migration.

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('workspaces_slug_idx').on(table.slug),
}))

export const workspaceMembros = pgTable('workspace_membros', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  // 'admin' | 'gestor' | 'vendedor' — text de propósito (papéis novos sem migration)
  papel: text('papel').notNull().default('vendedor'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceProfileIdx: uniqueIndex('workspace_membros_workspace_profile_idx').on(table.workspaceId, table.profileId),
}))

export const crmEmpresas = pgTable('crm_empresas', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  cnpj: text('cnpj'),
  segmento: text('segmento'),
  site: text('site'),
  instagram: text('instagram'),
  telefone: text('telefone'),
  cidade: text('cidade'),
  estado: text('estado'),
  notas: text('notas'),
  donoId: uuid('dono_id').references(() => profiles.id, { onDelete: 'set null' }),
  // Preenchido quando a empresa vira cliente da agência (ganharOportunidade
  // com criarCliente=true) — liga o CRM à carteira em `clientes`.
  clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceNomeIdx: index('crm_empresas_workspace_nome_idx').on(table.workspaceId, table.nome),
}))

export const crmContatos = pgTable('crm_contatos', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  empresaId: uuid('empresa_id').references(() => crmEmpresas.id, { onDelete: 'set null' }),
  nome: text('nome').notNull(),
  email: text('email'),
  telefone: text('telefone'),
  // Só dígitos (normalizarTelefone) — usado no dedup de contato por telefone.
  telefoneNormalizado: text('telefone_normalizado'),
  cargo: text('cargo'),
  // Perfil do lead (fluxo lead-first). Todos NULLABLE: o lead chega por form
  // Meta/WhatsApp com o minimo (nome + telefone) e vai sendo completado depois.
  documento: text('documento'), // CPF ou CNPJ, como o usuario digitou
  site: text('site'),
  dataNascimento: date('data_nascimento'),
  cep: text('cep'),
  endereco: text('endereco'),
  cidade: text('cidade'),
  estado: text('estado'),
  notas: text('notas'),
  // Endereço completo (modal "Criar novo Lead", imagens 07-11). Todos nullable.
  pais: text('pais'),
  numero: text('numero'),
  complemento: text('complemento'),
  bairro: text('bairro'),
  // URL PÚBLICA da foto do lead (bucket crm-fotos, público de propósito —
  // avatar não pode depender de signed URL que expira).
  fotoUrl: text('foto_url'),
  // 'manual' | 'landing_page' | 'meta_lead_ad' | 'whatsapp' | 'indicacao' | 'outro'
  origem: text('origem').notNull().default('manual'),
  origemDetalhe: jsonb('origem_detalhe'),
  donoId: uuid('dono_id').references(() => profiles.id, { onDelete: 'set null' }),
  // Preenchido quando o lead vira cliente da agência — idempotência da
  // conversão Ganho → Cliente (nunca duplicar cliente para o mesmo lead).
  clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceEmailIdx: index('crm_contatos_workspace_email_idx').on(table.workspaceId, table.email),
  workspaceTelefoneIdx: index('crm_contatos_workspace_telefone_idx').on(table.workspaceId, table.telefoneNormalizado),
}))

// Tags do CRM (badges coloridas do modal "Criar novo Lead"). `cor` armazena a
// CHAVE da paleta CORES_TAG (src/lib/crm/tags.ts), nunca classe/hex cru — a UI
// resolve a chave em classes Tailwind. Unicidade por (workspace, nome) com o
// nome normalizado por trim na action (criarTag recusa duplicada
// case-insensitive antes do insert).
export const crmTags = pgTable('crm_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  cor: text('cor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceNomeIdx: uniqueIndex('crm_tags_workspace_nome_idx').on(table.workspaceId, table.nome),
}))

// Junção lead ↔ tag (N:N). Índice único impede vincular a mesma tag 2x.
export const crmContatoTags = pgTable('crm_contato_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  contatoId: uuid('contato_id').notNull().references(() => crmContatos.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => crmTags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  contatoTagIdx: uniqueIndex('crm_contato_tags_contato_tag_idx').on(table.contatoId, table.tagId),
}))

export const crmPipelines = pgTable('crm_pipelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  ordem: integer('ordem').notNull().default(0),
  // Invariante mantida por definirPipelinePadrao: SEMPRE exatamente 1 padrão.
  padrao: boolean('padrao').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crmEtapas = pgTable('crm_etapas', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipelineId: uuid('pipeline_id').notNull().references(() => crmPipelines.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  ordem: integer('ordem').notNull(),
  cor: text('cor'),
  // Probabilidade de fechamento (0-100). Ganho/perdido NÃO são etapas — são
  // status da oportunidade (padrão Pipedrive).
  probabilidade: integer('probabilidade'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crmOportunidades = pgTable('crm_oportunidades', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  // restrict: pipeline/etapa com oportunidades não podem ser excluídos —
  // a action recusa antes, o FK é a trava final.
  pipelineId: uuid('pipeline_id').notNull().references(() => crmPipelines.id, { onDelete: 'restrict' }),
  etapaId: uuid('etapa_id').notNull().references(() => crmEtapas.id, { onDelete: 'restrict' }),
  empresaId: uuid('empresa_id').references(() => crmEmpresas.id, { onDelete: 'set null' }),
  contatoId: uuid('contato_id').references(() => crmContatos.id, { onDelete: 'set null' }),
  titulo: text('titulo').notNull(),
  valor: numeric('valor', { precision: 12, scale: 2 }), // NUNCA float para dinheiro
  tipoReceita: text('tipo_receita').default('mensalidade'), // 'mensalidade' | 'projeto'
  status: text('status').notNull().default('aberta'), // 'aberta' | 'ganha' | 'perdida'
  motivoPerda: text('motivo_perda'),
  ganhaEm: timestamp('ganha_em', { withTimezone: true }),
  perdidaEm: timestamp('perdida_em', { withTimezone: true }),
  donoId: uuid('dono_id').references(() => profiles.id, { onDelete: 'set null' }),
  origem: text('origem'),
  // CHAVE do servico vendido neste negocio ('trafego_pago', 'landing_page',
  // 'crm_automacao', 'estrategia' — ver src/lib/crm/servicos.ts). Um lead tem N
  // negocios, um por servico: pode perder o de Trafego e ganhar o de Landing.
  servico: text('servico'),
  // LEGADO: array de interesses do form antigo/ingest. NAO e usado no fluxo
  // lead-first (quem manda e `servico`). Mantido para nao quebrar a API publica.
  servicosInteresse: jsonb('servicos_interesse'), // string[]
  // Produtos/servicos DENTRO do negocio: [{servico, valor}]. Um negocio = um card
  // no kanban; adicionar/remover produto NAO cria/apaga card (migration 0026).
  // null = legado: a UI/actions caem em [{servico, valor}] da propria linha.
  produtos: jsonb('produtos'),
  dataPrevistaFechamento: date('data_prevista_fechamento'),
  ordemNaEtapa: integer('ordem_na_etapa').notNull().default(0),
  // Carimbo do 1º CONTATO comercial do lead (migration 0034, quick-260717-qq6):
  // preenchido UMA vez (só se null) quando a 1ª tarefa/atividade de contato
  // (ligação/whatsapp/e-mail/reunião) é concluída ou registrada. Alimenta o
  // SLA de 24h (src/lib/crm/sla-contato.ts) — indicador no card + alerta.
  primeiroContatoEm: timestamp('primeiro_contato_em', { withTimezone: true }),
  // Preenchido quando a oportunidade GANHA vira cliente da agência.
  clienteId: uuid('cliente_id').references(() => clientes.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pipelineEtapaStatusIdx: index('crm_oportunidades_pipeline_etapa_status_idx').on(table.pipelineId, table.etapaId, table.status),
  workspaceStatusIdx: index('crm_oportunidades_workspace_status_idx').on(table.workspaceId, table.status),
}))

// Tarefas COMERCIAIS (ligação, follow-up, reunião de venda) — nada a ver com o
// módulo Tarefas operacional (`tarefas`).
export const crmTarefas = pgTable('crm_tarefas', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  oportunidadeId: uuid('oportunidade_id').references(() => crmOportunidades.id, { onDelete: 'cascade' }),
  contatoId: uuid('contato_id').references(() => crmContatos.id, { onDelete: 'set null' }),
  // 'ligacao' | 'whatsapp' | 'email' | 'reuniao' | 'followup' | 'outro'
  tipo: text('tipo').notNull().default('followup'),
  titulo: text('titulo').notNull(),
  notas: text('notas'),
  dataVencimento: timestamp('data_vencimento', { withTimezone: true }).notNull(),
  // Atividade AGENDADA (modal "Criar atividade"): início/fim com hora.
  // dataVencimento continua preenchida (= dataFim) para não quebrar a
  // heurística "sem contato +7d" de getCrmVisaoGeral.
  dataInicio: timestamp('data_inicio', { withTimezone: true }),
  dataFim: timestamp('data_fim', { withTimezone: true }),
  // 'baixa' | 'media' | 'alta' — validado no Zod (atividadeSchema), sem CHECK.
  prioridade: text('prioridade'),
  concluida: boolean('concluida').notNull().default(false),
  concluidaEm: timestamp('concluida_em', { withTimezone: true }),
  donoId: uuid('dono_id').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  oportunidadeConcluidaIdx: index('crm_tarefas_oportunidade_concluida_idx').on(table.oportunidadeId, table.concluida),
  donoVenctoIdx: index('crm_tarefas_dono_vencto_idx').on(table.donoId, table.dataVencimento),
}))

// Histórico/timeline do CRM. `autor_nome` denormalizado ('Sistema' para
// automações); `autor_id` SEM FK — segue o precedente de `acompanhamentos`.
// tipos: 'criacao' | 'mudanca_etapa' | 'ganho' | 'perda' | 'reabertura' |
// 'contato_criado' | 'tarefa_criada' | 'tarefa_concluida' | 'lead_recebido' | ...
export const crmAtividades = pgTable('crm_atividades', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  oportunidadeId: uuid('oportunidade_id').references(() => crmOportunidades.id, { onDelete: 'cascade' }),
  contatoId: uuid('contato_id').references(() => crmContatos.id, { onDelete: 'set null' }),
  empresaId: uuid('empresa_id').references(() => crmEmpresas.id, { onDelete: 'set null' }),
  tipo: text('tipo').notNull(),
  autorId: uuid('autor_id'),
  autorNome: text('autor_nome').notNull(),
  campo: text('campo'),
  de: text('de'),
  para: text('para'),
  detalhe: text('detalhe'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  oportunidadeCreatedIdx: index('crm_atividades_oportunidade_created_idx').on(table.oportunidadeId, table.createdAt),
}))

// Inbox de leads da API pública (/api/crm/leads). O uniqueIndex em dedup_hash
// é a trava de idempotência: o MESMO lead no MESMO dia não cria segunda linha.
export const crmLeadInbox = pgTable('crm_lead_inbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  fonte: text('fonte').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pendente'), // 'pendente' | 'processado' | 'descartado' | 'erro'
  erroDetalhe: text('erro_detalhe'),
  contatoId: uuid('contato_id').references(() => crmContatos.id, { onDelete: 'set null' }),
  oportunidadeId: uuid('oportunidade_id').references(() => crmOportunidades.id, { onDelete: 'set null' }),
  dedupHash: text('dedup_hash').notNull(),
  recebidoEm: timestamp('recebido_em', { withTimezone: true }).notNull().defaultNow(),
  processadoEm: timestamp('processado_em', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  dedupHashIdx: uniqueIndex('crm_lead_inbox_dedup_hash_idx').on(table.dedupHash),
}))

// --- Preferências do painel /campanhas (por CLIENTE, não por usuário —
// pensado para o futuro portal do cliente) ---
// kpis: [{ id, ativo }] na ORDEM de exibição da grade de KPIs.
// funil: { campanhas: string[] | null (null = todas), etapas: MetricaId[] (2-6) }.
export const preferenciasCampanhas = pgTable('preferencias_campanhas', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  kpis: jsonb('kpis'),
  funil: jsonb('funil'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteIdx: uniqueIndex('preferencias_campanhas_cliente_id_idx').on(table.clienteId),
}))

export const preferenciasCampanhasRelations = relations(preferenciasCampanhas, ({ one }) => ({
  cliente: one(clientes, { fields: [preferenciasCampanhas.clienteId], references: [clientes.id] }),
}))

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  membros: many(workspaceMembros),
  empresas: many(crmEmpresas),
  contatos: many(crmContatos),
  pipelines: many(crmPipelines),
  oportunidades: many(crmOportunidades),
}))

export const workspaceMembrosRelations = relations(workspaceMembros, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembros.workspaceId], references: [workspaces.id] }),
  profile: one(profiles, { fields: [workspaceMembros.profileId], references: [profiles.id] }),
}))

export const crmEmpresasRelations = relations(crmEmpresas, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmEmpresas.workspaceId], references: [workspaces.id] }),
  dono: one(profiles, { fields: [crmEmpresas.donoId], references: [profiles.id] }),
  cliente: one(clientes, { fields: [crmEmpresas.clienteId], references: [clientes.id] }),
  contatos: many(crmContatos),
  oportunidades: many(crmOportunidades),
}))

export const crmContatosRelations = relations(crmContatos, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmContatos.workspaceId], references: [workspaces.id] }),
  empresa: one(crmEmpresas, { fields: [crmContatos.empresaId], references: [crmEmpresas.id] }),
  dono: one(profiles, { fields: [crmContatos.donoId], references: [profiles.id] }),
  oportunidades: many(crmOportunidades),
}))

export const crmPipelinesRelations = relations(crmPipelines, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmPipelines.workspaceId], references: [workspaces.id] }),
  etapas: many(crmEtapas),
  oportunidades: many(crmOportunidades),
}))

export const crmEtapasRelations = relations(crmEtapas, ({ one, many }) => ({
  pipeline: one(crmPipelines, { fields: [crmEtapas.pipelineId], references: [crmPipelines.id] }),
  oportunidades: many(crmOportunidades),
}))

export const crmOportunidadesRelations = relations(crmOportunidades, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmOportunidades.workspaceId], references: [workspaces.id] }),
  pipeline: one(crmPipelines, { fields: [crmOportunidades.pipelineId], references: [crmPipelines.id] }),
  etapa: one(crmEtapas, { fields: [crmOportunidades.etapaId], references: [crmEtapas.id] }),
  empresa: one(crmEmpresas, { fields: [crmOportunidades.empresaId], references: [crmEmpresas.id] }),
  contato: one(crmContatos, { fields: [crmOportunidades.contatoId], references: [crmContatos.id] }),
  dono: one(profiles, { fields: [crmOportunidades.donoId], references: [profiles.id] }),
  cliente: one(clientes, { fields: [crmOportunidades.clienteId], references: [clientes.id] }),
  tarefas: many(crmTarefas),
  atividades: many(crmAtividades),
}))

export const crmTarefasRelations = relations(crmTarefas, ({ one }) => ({
  workspace: one(workspaces, { fields: [crmTarefas.workspaceId], references: [workspaces.id] }),
  oportunidade: one(crmOportunidades, { fields: [crmTarefas.oportunidadeId], references: [crmOportunidades.id] }),
  contato: one(crmContatos, { fields: [crmTarefas.contatoId], references: [crmContatos.id] }),
  dono: one(profiles, { fields: [crmTarefas.donoId], references: [profiles.id] }),
}))

export const crmAtividadesRelations = relations(crmAtividades, ({ one }) => ({
  workspace: one(workspaces, { fields: [crmAtividades.workspaceId], references: [workspaces.id] }),
  oportunidade: one(crmOportunidades, { fields: [crmAtividades.oportunidadeId], references: [crmOportunidades.id] }),
  contato: one(crmContatos, { fields: [crmAtividades.contatoId], references: [crmContatos.id] }),
  empresa: one(crmEmpresas, { fields: [crmAtividades.empresaId], references: [crmEmpresas.id] }),
}))

export const crmLeadInboxRelations = relations(crmLeadInbox, ({ one }) => ({
  workspace: one(workspaces, { fields: [crmLeadInbox.workspaceId], references: [workspaces.id] }),
  contato: one(crmContatos, { fields: [crmLeadInbox.contatoId], references: [crmContatos.id] }),
  oportunidade: one(crmOportunidades, { fields: [crmLeadInbox.oportunidadeId], references: [crmOportunidades.id] }),
}))

// --- Automações (aba Ferramentas) ---
// Central de automações liga/desliga com configuração editável (migration 0027).
// chave: 'aviso_lead_novo' (avisa SDR via WhatsApp) | 'mensagem_lead_novo'
// (primeira mensagem automática ao lead). config: { token, numeros?, mensagem }.
export const automacoes = pgTable('automacoes', {
  chave: text('chave').primaryKey(),
  ativo: boolean('ativo').notNull().default(false),
  config: jsonb('config'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

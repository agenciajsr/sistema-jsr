import { pgTable, pgEnum, uuid, text, timestamp, date, numeric, integer, index, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

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
  usaAsaas: boolean('usa_asaas').notNull().default(false),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteIdx: index('contratos_cliente_id_idx').on(table.clienteId, table.dataInicio),
}))

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
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountDateCampaignIdx: index('ci_account_date_campaign_idx').on(table.adAccountId, table.date, table.campaignId),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  dataStatusIdx: index('tarefas_data_status_idx').on(table.data, table.status),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tarefaIdx: index('tarefa_checklist_tarefa_id_idx').on(table.tarefaId),
}))

export const tarefasRelations = relations(tarefas, ({ one, many }) => ({
  cliente: one(clientes, { fields: [tarefas.clienteId], references: [clientes.id] }),
  responsavel: one(profiles, { fields: [tarefas.responsavelId], references: [profiles.id] }),
  tarefaMae: one(tarefas, { fields: [tarefas.tarefaMaeId], references: [tarefas.id], relationName: 'ocorrencias' }),
  checklistItems: many(tarefaChecklistItems),
}))

export const tarefaChecklistItemsRelations = relations(tarefaChecklistItems, ({ one }) => ({
  tarefa: one(tarefas, { fields: [tarefaChecklistItems.tarefaId], references: [tarefas.id] }),
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
  tipo: text('tipo').notNull(), // 'semanal' | 'manual'
  periodoInicio: date('periodo_inicio').notNull(),
  periodoFim: date('periodo_fim').notNull(),
  conteudo: text('conteudo').notNull(), // texto pronto para WhatsApp
  geradoEm: timestamp('gerado_em', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clienteGeradoIdx: index('relatorios_cliente_gerado_idx').on(table.clienteId, table.geradoEm),
}))

export const relatoriosRelations = relations(relatorios, ({ one }) => ({
  cliente: one(clientes, { fields: [relatorios.clienteId], references: [clientes.id] }),
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

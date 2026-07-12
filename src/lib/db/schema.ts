import { pgTable, pgEnum, uuid, text, timestamp, date, numeric, integer, index, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const roleEnum = pgEnum('role', ['admin', 'membro'])
export const nichoEnum = pgEnum('nicho', ['ecommerce', 'negocio_local', 'infoproduto'])
export const clienteStatusEnum = pgEnum('cliente_status', ['ativo', 'pausado', 'encerrado'])

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

export const clientesRelations = relations(clientes, ({ many }) => ({
  contratos: many(contratos),
  transacoes: many(transacoes),
  adAccounts: many(adAccounts),
  checklistItems: many(checklistItems),
  acompanhamentos: many(acompanhamentos),
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

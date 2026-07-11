import { pgTable, pgEnum, uuid, text, timestamp, date, numeric, integer, index } from 'drizzle-orm/pg-core'
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

export const clientesRelations = relations(clientes, ({ many }) => ({
  contratos: many(contratos),
  transacoes: many(transacoes),
}))
export const contratosRelations = relations(contratos, ({ one }) => ({
  cliente: one(clientes, { fields: [contratos.clienteId], references: [clientes.id] }),
}))
export const transacoesRelations = relations(transacoes, ({ one }) => ({
  cliente: one(clientes, { fields: [transacoes.clienteId], references: [clientes.id] }),
}))

import { pgTable, pgEnum, uuid, text, timestamp, date, numeric, index } from 'drizzle-orm/pg-core'
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

export const clientesRelations = relations(clientes, ({ many }) => ({
  contratos: many(contratos),
}))
export const contratosRelations = relations(contratos, ({ one }) => ({
  cliente: one(clientes, { fields: [contratos.clienteId], references: [clientes.id] }),
}))

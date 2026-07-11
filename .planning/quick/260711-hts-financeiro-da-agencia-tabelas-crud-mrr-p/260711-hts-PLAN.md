---
phase: quick-260711-hts
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/schema.ts
  - src/lib/validations/transacao.ts
  - src/actions/financeiro.ts
  - src/app/(app)/financeiro/page.tsx
  - src/app/(app)/financeiro/transacao-form.tsx
  - src/app/(app)/financeiro/transacoes-table.tsx
autonomous: true
requirements: [FIN-SCHEMA, FIN-CRUD, FIN-MRR, FIN-UI]

must_haves:
  truths:
    - "Tabela transacoes existe no banco com enums tipo/categoria/status"
    - "Server Actions criam, listam e deletam transacoes com validacao Zod"
    - "MRR e calculado a partir dos contratos vigentes (SUM valor_mensal WHERE datas cobrem hoje)"
    - "Tela /financeiro mostra cards reais (receita, despesa, lucro, MRR) e tabela de transacoes do banco"
    - "Formulario permite adicionar receita ou despesa com todos os campos do schema"
  artifacts:
    - path: "src/lib/db/schema.ts"
      provides: "transacoes table + enums tipoTransacao, categoriaTransacao, statusTransacao"
      contains: "transacoes"
    - path: "src/lib/validations/transacao.ts"
      provides: "transacaoSchema Zod validation"
      exports: ["transacaoSchema", "TransacaoInput"]
    - path: "src/actions/financeiro.ts"
      provides: "Server Actions CRUD + MRR query"
      exports: ["createTransacao", "listTransacoes", "deleteTransacao", "calcularMrr", "getResumoFinanceiro"]
    - path: "src/app/(app)/financeiro/page.tsx"
      provides: "Financeiro page with real data"
  key_links:
    - from: "src/app/(app)/financeiro/page.tsx"
      to: "src/actions/financeiro.ts"
      via: "Server Component calling actions directly"
      pattern: "getResumoFinanceiro|listTransacoes|calcularMrr"
    - from: "src/actions/financeiro.ts"
      to: "src/lib/db/schema.ts"
      via: "Drizzle queries on transacoes + contratos"
      pattern: "db\\.select|db\\.insert|db\\.delete"
    - from: "src/app/(app)/financeiro/transacao-form.tsx"
      to: "src/actions/financeiro.ts"
      via: "React Hook Form + useTransition calling createTransacao"
      pattern: "createTransacao"
---

<objective>
Substituir a tela mock /financeiro por dados reais: criar tabela `transacoes` no banco, Server Actions CRUD, calculo de MRR a partir dos contratos ativos, e UI com cards de resumo + tabela + formulario.

Purpose: Dar a equipe da JSR visibilidade real da saude financeira da agencia (receitas, despesas, lucro, MRR) em um unico lugar.
Output: Schema atualizado, migration aplicada, Server Actions funcionais, pagina /financeiro com dados do banco.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/db/schema.ts
@src/lib/db/index.ts
@src/actions/clientes.ts
@src/lib/validations/cliente.ts
@src/lib/validations/contrato.ts
@src/lib/auth/session.ts
@src/app/(app)/financeiro/page.tsx
@drizzle.config.ts

<interfaces>
<!-- Padroes existentes que o executor deve seguir -->

From src/lib/db/schema.ts:
```typescript
// Enum pattern:
export const roleEnum = pgEnum('role', ['admin', 'membro'])
// Table pattern:
export const clientes = pgTable('clientes', { ... })
// Relations pattern:
export const clientesRelations = relations(clientes, ({ many }) => ({ ... }))
```

From src/actions/clientes.ts:
```typescript
// Server Action pattern:
'use server'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'
import { clienteSchema } from '@/lib/validations/cliente'
import { getCurrentUser } from '@/lib/auth/session'

const ERRO_VALIDACAO = 'Não foi possível salvar. Verifique os dados e tente novamente.'

// Return type pattern: { data: ... } | { error: string }
```

From src/lib/validations/cliente.ts:
```typescript
// Zod schema pattern:
export const clienteSchema = z.object({ ... })
export type ClienteInput = z.infer<typeof clienteSchema>
```

From src/lib/db/index.ts:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle({ client, schema })
```

Contratos table (needed for MRR query):
```typescript
export const contratos = pgTable('contratos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clienteId: uuid('cliente_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  dataInicio: date('data_inicio').notNull(),
  dataVencimento: date('data_vencimento').notNull(),
  valorMensal: numeric('valor_mensal', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schema transacoes + validacao Zod + Server Actions CRUD + MRR</name>
  <files>src/lib/db/schema.ts, src/lib/validations/transacao.ts, src/actions/financeiro.ts</files>
  <action>
**1. src/lib/db/schema.ts** — Adicionar 3 enums e a tabela transacoes, seguindo o padrao existente (pgEnum, pgTable, relations):

```
tipoTransacaoEnum = pgEnum('tipo_transacao', ['receita', 'despesa'])
categoriaTransacaoEnum = pgEnum('categoria_transacao', ['mensalidade', 'projeto', 'outro', 'ferramenta', 'ads_agencia', 'salario'])
statusTransacaoEnum = pgEnum('status_transacao', ['pago', 'pendente', 'vencido'])
```

Tabela `transacoes`:
- id: uuid PK defaultRandom
- tipo: tipoTransacaoEnum notNull
- categoria: categoriaTransacaoEnum notNull
- clienteId: uuid('cliente_id') nullable, references clientes.id onDelete set null (null = custo da agencia, conforme decisao)
- descricao: text notNull
- valor: numeric('valor', { precision: 10, scale: 2 }) notNull
- data: date('data') notNull
- status: statusTransacaoEnum notNull default 'pendente'
- diaVencto: integer('dia_vencto') nullable (importar `integer` de drizzle-orm/pg-core)
- notas: text nullable
- createdAt: timestamp withTimezone notNull defaultNow
- updatedAt: timestamp withTimezone notNull defaultNow

Index: `transacoes_data_idx` em (data, tipo) para queries de filtro por mes.

Relations: transacoes -> one(clientes) via clienteId. Adicionar `transacoes: many(transacoes)` ao clientesRelations existente.

**2. src/lib/validations/transacao.ts** — Zod schema seguindo padrao de cliente.ts:

```typescript
export const transacaoSchema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  categoria: z.enum(['mensalidade', 'projeto', 'outro', 'ferramenta', 'ads_agencia', 'salario']),
  clienteId: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),
  descricao: z.string().min(1, 'Descricao e obrigatoria'),
  valor: z.coerce.number().positive('Valor deve ser maior que zero'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida'),
  status: z.enum(['pago', 'pendente', 'vencido']).default('pendente'),
  diaVencto: z.coerce.number().int().min(1).max(31).optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  notas: z.string().optional(),
})
export type TransacaoInput = z.infer<typeof transacaoSchema>
```

**3. src/actions/financeiro.ts** — Server Actions seguindo padrao de clientes.ts:

- `createTransacao(input: TransacaoInput)`: valida com transacaoSchema.safeParse, insere no banco. Retorna `{ data: { id } }` ou `{ error }`. Chama getCurrentUser() para verificar sessao.
- `listTransacoes(filtros?: { mes?: string, ano?: string })`: SELECT * from transacoes LEFT JOIN clientes (para nome). Filtra por mes/ano se fornecido (WHERE extract month/year from data). Ordena por data DESC. Retorna array com nome do cliente incluso.
- `deleteTransacao(id: string)`: requireAdmin(), deleta por id.
- `calcularMrr()`: SELECT SUM(valor_mensal) FROM contratos WHERE data_inicio <= CURRENT_DATE AND data_vencimento >= CURRENT_DATE. Retorna numero. Usar `sql` template do drizzle-orm para a query: `db.select({ total: sql<string>\`coalesce(sum(${contratos.valorMensal}), '0')\` }).from(contratos).where(and(lte(contratos.dataInicio, hoje), gte(contratos.dataVencimento, hoje)))` com `hoje` como string YYYY-MM-DD do dia atual.
- `getResumoFinanceiro(mes?: number, ano?: number)`: Agrega SUM(valor) agrupando por tipo (receita/despesa) filtrado pelo mes/ano. Retorna `{ receita: number, despesa: number, lucro: number }`. Usa `sql` template para o SUM condicional.

**4. Gerar e aplicar migration:**
Rodar `npx drizzle-kit generate` e depois `npx drizzle-kit push` (ou `npx drizzle-kit migrate` conforme o que funcionar no projeto — verificar se usa push ou migrate checando drizzle/ dir).
  </action>
  <verify>
    <automated>cd "C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr" && npx tsx -e "import { transacoes } from './src/lib/db/schema'; console.log('transacoes columns:', Object.keys(transacoes))" --env-file=.env.local</automated>
  </verify>
  <done>Tabela transacoes existe no banco com todos os campos e enums. transacaoSchema exportado. 5 Server Actions exportadas e funcionais. Migration aplicada.</done>
</task>

<task type="auto">
  <name>Task 2: Tela /financeiro real — cards de resumo + tabela + formulario</name>
  <files>src/app/(app)/financeiro/page.tsx, src/app/(app)/financeiro/transacao-form.tsx, src/app/(app)/financeiro/transacoes-table.tsx</files>
  <action>
**1. src/app/(app)/financeiro/transacoes-table.tsx** — Client Component para a tabela de transacoes:

- Props: `transacoes` (array com id, tipo, categoria, clienteNome, descricao, valor, data, status)
- Usa Table/TableHeader/TableBody/TableRow/TableCell/TableHead do shadcn
- Colunas: Data (formatada DD/MM/YYYY), Descricao, Cliente (ou "Agencia" se null), Categoria (Badge), Valor (formatado BRL, cor verde para receita, vermelho para despesa), Status (Badge com cores: pago=verde, pendente=amarelo, vencido=vermelho)
- Botao de excluir por linha (icone Trash2 do lucide-react) que chama deleteTransacao via useTransition + revalidatePath
- Se lista vazia, mostrar mensagem "Nenhuma transacao registrada"

**2. src/app/(app)/financeiro/transacao-form.tsx** — Client Component com React Hook Form + Zod:

- Usar useForm com zodResolver(transacaoSchema), seguindo o padrao existente (ver como login e cliente-form fazem)
- Campos: tipo (select receita/despesa), categoria (select — filtrar opcoes por tipo: receita mostra mensalidade/projeto/outro, despesa mostra ferramenta/ads_agencia/salario/outro), cliente (select opcional — buscar lista de clientes via prop passada do Server Component), descricao (input text), valor (input number), data (input date, default hoje), status (select pago/pendente/vencido), diaVencto (input number opcional), notas (textarea opcional)
- onSubmit: useTransition chamando createTransacao, mesma pattern de clientes.ts
- Apos submit com sucesso: router.refresh() para recarregar dados
- Botao "Adicionar Transacao" que abre/fecha o formulario (useState toggle, NAO usar Dialog do shadcn conforme decisao do projeto)
- Labels e placeholders em portugues

**3. src/app/(app)/financeiro/page.tsx** — Server Component (substituir todo o mock):

- Remover 'use client', remover imports de mock, remover MockNotice
- Importar e chamar: getResumoFinanceiro(), calcularMrr(), listTransacoes() — tudo no server side
- Buscar lista de clientes ativos para o select do formulario: `db.select({ id: clientes.id, nome: clientes.nome }).from(clientes).where(eq(clientes.status, 'ativo'))`
- Layout: titulo "Financeiro" + subtitulo
- 4 StatCards no topo (grid 4 colunas lg, 2 sm, 1 mobile):
  - Receita do Mes (valor formatado BRL, icone TrendingUp, cor success)
  - Despesas do Mes (valor formatado BRL, icone TrendingDown, cor danger/destructive — usar "warning" se danger nao existir no StatCard)
  - Lucro do Mes (receita - despesa, formatado BRL, icone DollarSign, cor primary)
  - MRR (valor formatado BRL, icone Wallet, cor success)
- TransacaoForm (passando lista de clientes como prop)
- TransacoesTable (passando transacoes como prop)
- Manter visual premium dark (seguindo padrao do sistema — Card border-none shadow-sm, cores com significado)
- Importar TrendingDown e DollarSign do lucide-react (ja tem TrendingUp e Wallet importados no mock atual)

Nao remover o grafico de MRR historico por enquanto — simplesmente remover essa secao. O foco e dados reais, grafico historico vira depois quando tiver dados acumulados.
  </action>
  <verify>
    <automated>cd "C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr" && npx next build 2>&1 | tail -20</automated>
  </verify>
  <done>Pagina /financeiro carrega sem erros, mostra 4 cards com dados reais do banco (receita, despesa, lucro, MRR), tabela de transacoes funcional, formulario permite adicionar receita/despesa. Nenhum dado mock remanescente na pagina.</done>
</task>

</tasks>

<verification>
1. `npx next build` completa sem erros
2. Acessar /financeiro — cards mostram valores reais (provavelmente R$ 0,00 se nao ha transacoes)
3. Adicionar uma receita pelo formulario — aparece na tabela
4. Adicionar uma despesa — aparece na tabela, card de lucro reflete diferenca
5. MRR mostra soma dos contratos vigentes (se existirem contratos ativos no banco)
</verification>

<success_criteria>
- Tabela transacoes criada no banco com migration aplicada
- 5 Server Actions funcionais (create, list, delete, calcularMrr, getResumoFinanceiro)
- /financeiro mostra cards reais + tabela + formulario — zero mocks
- Build passa sem erros
</success_criteria>

<output>
After completion, create `.planning/quick/260711-hts-financeiro-da-agencia-tabelas-crud-mrr-p/260711-hts-SUMMARY.md`
</output>

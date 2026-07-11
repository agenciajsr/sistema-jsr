# Quick Task 260711-hts: Financeiro da Agência - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Task Boundary

Financeiro da Agência — criar tabela `transacoes` no banco (receitas + despesas unificadas), Server Actions CRUD, cálculo de MRR a partir dos contratos ativos, status de pagamento manual (Asaas manual conforme decisão do produto). Escopo: receita dos clientes E custos da própria agência para enxergar lucro real. Tela /financeiro deixa de ser mock e passa a usar dados reais com cards de resumo + tabela + formulário.

</domain>

<decisions>
## Implementation Decisions

### Schema do banco
- **Tabela única `transacoes`** com campo `tipo` (receita/despesa). Queries de lucro diretas, sem UNION, menos joins.
- Campos: id (UUID), tipo enum, categoria enum, cliente_id (nullable — null para custos da agência), descricao, valor numeric(10,2), data, status enum (pago/pendente/vencido), dia_vencto (int, nullable), notas (nullable), timestamps.

### Categorias
- **Básico**: Receitas (mensalidade, projeto, outro) + Despesas (ferramenta, ads_agencia, salario, outro). Sem impostos/escritório/comissões no v1.

### Cálculo de MRR
- **Derivado dos contratos ativos**: SUM(valor_mensal) dos contratos vigentes (data_inicio <= hoje AND data_vencimento >= hoje). Zero input extra necessário.

### Escopo da UI
- **CRUD + resumo**: Cards de resumo no topo (receita total, despesa total, lucro, MRR), tabela de transações com filtros, formulário para adicionar receita/despesa.

### Asaas
- Controle **manual** — status de pagamento (pago/pendente/vencido) marcado na mão. Sem integração API nesta entrega.

</decisions>

<specifics>
## Specific Ideas

- Separar com clareza "dinheiro da agência" (módulo Financeiro) vs "verba do cliente nos ads" (módulo Tráfego & Performance)
- cliente_id nullable permite registrar custos da agência sem associação a cliente
- MRR vem dos contratos, não das transações — sempre atualizado automaticamente
- Status de pagamento = campo manual na transação (decisão Asaas manual)
- Visual premium mantendo padrão do sistema (dark cards, cores com significado)

</specifics>

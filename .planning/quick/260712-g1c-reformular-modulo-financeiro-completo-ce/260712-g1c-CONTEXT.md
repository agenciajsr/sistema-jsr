# Quick Task 260712-g1c: Reformular módulo financeiro completo - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Task Boundary

Reformular o módulo financeiro da agência para ser estratégico: centro de custo, forma de pagamento por transação, recorrência automática, upload de comprovante, responsável, previsão de caixa (contas a receber/pagar), saldo projetado 30 dias.

</domain>

<decisions>
## Implementation Decisions

### Centros de Custo
- 3 centros: Operação (ferramentas, software), Mídia (ads da agência), Infraestrutura (aluguel, internet)
- Novo enum `centro_custo` no schema, campo opcional na transação

### Recorrência
- Gerar parcelas automaticamente ao cadastrar transação recorrente
- Quantidade de parcelas = até a data de vencimento do contrato do cliente
- Se não tiver contrato vinculado (despesa da agência), gerar 12 meses por padrão
- Novos campos: `recorrencia` (enum: mensal/trimestral/avulsa), `transacao_pai_id` (FK para agrupar parcelas)

### Previsão de Caixa
- Considerar TUDO: contratos ativos (receita), despesas recorrentes, transações pendentes, e média histórica dos últimos 3 meses para variáveis
- Card de "Saldo Projetado 30 dias" com breakdown: a receber vs a pagar

### Comprovante
- Upload de arquivo (PDF/imagem) para Supabase Storage
- Novo campo `comprovante_url` na tabela transações
- Bucket: `comprovantes` no Supabase Storage

### Layout da Página
- 4 abas: Visão Geral | Contas a Receber | Contas a Pagar | Previsão de Caixa
- KPIs no topo (visíveis em todas as abas)
- Cada aba tem sua tabela filtrada

### Responsável
- Campo `responsavel_id` (FK para profiles) na transação — quem registrou/é responsável pela cobrança

### Forma de Pagamento (por transação)
- Reutilizar o enum `forma_pagamento` já existente (pix/boleto/cartao/transferencia)
- Campo opcional na transação

</decisions>

<specifics>
## Specific Ideas

- Ao criar cobrança para cliente com contrato ativo e recorrência mensal, calcular automaticamente quantas parcelas gerar (dataVencimento - hoje) / 30
- Aba "A Receber" mostra só receitas pendentes/vencidas, ordenadas por data
- Aba "A Pagar" mostra só despesas pendentes/vencidas, ordenadas por data
- Previsão mostra timeline dos próximos 30 dias com entradas e saídas projetadas
- Na tabela, mostrar coluna de centro de custo e comprovante (ícone clicável)

</specifics>

# Quick Task 260711-i9j: Alertas da Agência - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Task Boundary

Alertas da Agência — lógica de avaliação em tempo real (sem tabela extra) para alertas derivados de dados que já existem no banco: contratos (vencimento), transações financeiras (pagamento vencido) e clientes (inativos). Tela /alertas deixa de ser mock e passa a usar dados reais. Parte de tráfego (verba baixa, queda performance) fica pra quando Meta/Google Ads estiver integrado.

</domain>

<decisions>
## Implementation Decisions

### Tipos de alerta
- **Contrato a vencer** — contrato com dataVencimento dentro de 30 dias
- **Pagamento vencido** — transação financeira com status 'vencido'
- **Cliente inativo** — cliente com status 'pausado' ou 'encerrado' sem atividade recente

### Geração de alertas
- **Derivados em tempo real** — sem tabela `alertas` no banco. Uma Server Action (`getAlertas()`) consulta contratos, transações e clientes e retorna a lista de alertas na hora. Sempre atualizados, zero manutenção de estado.

### Severidade
- **3 níveis**: crítico (vermelho), atenção (âmbar), info (azul)

### Prazo de antecedência (contrato)
- **30 dias** = info (contrato vence em breve)
- **15 dias** = atenção (agir logo)
- **7 dias ou menos** = crítico (urgente)
- Contrato já vencido = crítico

### Pagamento vencido
- Transação com status 'vencido' = atenção
- Se valor alto (> threshold?) = crítico — Claude's Discretion

### Cliente inativo
- Status 'pausado' ou 'encerrado' = info

</decisions>

<specifics>
## Specific Ideas

- Alertas ordenados por severidade (crítico primeiro, depois atenção, depois info)
- Cada alerta mostra: título, detalhe, cliente associado, severidade, data relevante
- Visual com cores: vermelho (crítico), âmbar (atenção), azul (info) — conforme padrão do projeto
- Nenhuma tabela nova no banco — tudo derivado de queries
- Sem Inngest/cron — alertas calculados on-demand quando a página carrega
- Componente reutilizável para o card de alerta (usado na tela /alertas e potencialmente no dashboard)

</specifics>

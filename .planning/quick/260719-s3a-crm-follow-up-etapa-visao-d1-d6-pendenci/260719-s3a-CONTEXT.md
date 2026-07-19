# Quick Task 260719-s3a: CRM Follow-up (etapa + visão D1-D6 + temperatura) - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Task Boundary

Sistema de follow-up no CRM de vendas: nova etapa "Follow-up" no pipeline de vendas (entre "Contato feito" e "Qualificado"), aba/visão "Pipeline de Follow-up" com colunas D1–D6 + Perdido, pendências com prazos crescentes, e etiqueta automática de temperatura (quente/frio) por origem.

Motivação do usuário: leads (tanto de prospecção fria via webhook do "outro CRM"/extensão WhatsApp quanto de formulário instantâneo/LP) muitas vezes não respondem ao primeiro contato; follow-up estruturado é estratégico pra vendas.

</domain>

<decisions>
## Implementation Decisions (travadas com o usuário via AskUserQuestion)

### Arquitetura — card único + visão (SEM duplicação)
- O card da oportunidade é UM só. A aba "Follow-up" é uma VISÃO do mesmo card: kanban com colunas D1–D6 + Perdido, onde a coluna deriva de um campo `nível de follow-up` da oportunidade.
- Usuário escolheu explicitamente contra o modelo do CRM antigo dele (duplicar card em segundo pipeline) após recomendação — sem clones, sem dessincronia.
- Lead entra na visão quando está na etapa "Follow-up" do pipeline de vendas; sai sozinho quando move pra outra etapa (ex.: Qualificado) ou status ganho/perdido.
- Arrastar D1→D2 = "fiz o follow-up 2": carimba data/hora (padrão do carimbo primeiro_contato_em já existente).

### Níveis e prazos — D1-D6 com prazos CRESCENTES
- 24h sem resposta após "Contato feito" → pendente de follow-up D1
- Depois de cada follow-up feito, relógio para o próximo: D1→D2 48h, D2→D3 72h, D3→D4 5 dias, D4→D5 7 dias, D5→D6 14 dias
- Pendência visual estilo SLA de 1º contato já existente (selo ⏰ no card)

### Fim do fluxo — marcar, humano decide
- D6 vencido sem resposta → card ganha destaque "follow-ups esgotados"; mover pra Perdido é decisão manual. NUNCA perder lead automaticamente.
- "Perdido" na visão de follow-up é a coluna fixa já existente do kanban (status perdida), não uma etapa nova.

### Temperatura — automática por origem, com backfill
- 🔥 quente = meta ads / LP / formulário instantâneo; 🧊 frio = prospecção fria / disparo WhatsApp
- Aplicada automaticamente em leads novos (ingest/webhook) e backfill nos existentes
- Exibida no card do kanban

### Deploy — LOCAL PRIMEIRO
- Usuário quer testar tudo em dev local antes de subir. NÃO fazer push pra master até o OK explícito dele.

</decisions>

<specifics>
## Specific Ideas

- Etapa "Follow-up" entra no pipeline de vendas existente logo após "Contato feito" (usuário verificou que não há como criar etapa pela UI, só editar — a etapa deve ser criada/seedada pelo sistema de forma idempotente).
- Fluxo de entrada real: disparo pelo "outro CRM" (extensão WhatsApp) → webhook já vinculado → lead cai no nosso CRM como prospecção fria → segue o funil.
- SLA de primeiro contato (1h) já existe e continua como está; as pendências de follow-up são a mesma família visual.

</specifics>

<canonical_refs>
## Canonical References

- Memória do projeto: CRM é lead-first; ganho/perdido são STATUS, nunca etapas (padrão Pipedrive, decisão quick-260715-0zf)
- Migrations: NUNCA drizzle-kit migrate — gerar SQL e aplicar via script Node pontual com DIRECT_URL em transação, conferindo information_schema antes (memória migrations-aplicar-na-mao)

</canonical_refs>

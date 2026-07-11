# Quick Task 260711-q7a: Integração Meta Ads - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Task Boundary

Integração completa com Meta Marketing API (Graph API v25.0): tabelas no banco (ad_accounts + campaign_insights), módulo client Meta API (fetch + Zod), Inngest setup (cron diário + botão manual), Server Actions, tela /trafego com dados reais agrupados por cliente.

Token já configurado e testado:
- META_SYSTEM_USER_TOKEN no .env.local (System User, ads_read + business_management)
- META_BUSINESS_ID=833985956999765
- META_API_VERSION=v25.0
- 8 contas de clientes ativas + 1 da agência confirmadas via teste

</domain>

<decisions>
## Implementation Decisions

### Schema do banco
- **Tabela `ad_accounts`**: id UUID, cliente_id UUID FK clientes (nullable até associar), plataforma enum ('meta'|'google'), meta_account_id text, nome text, status int, currency text, ativo boolean, timestamps
- **Tabela `campaign_insights`**: id UUID, ad_account_id UUID FK ad_accounts, campaign_id text, campaign_name text, date date, spend numeric(10,2), impressions int, clicks int, reach int, cpc numeric(10,4), cpm numeric(10,4), ctr numeric(8,4), actions jsonb, synced_at timestamp
- Index composto em campaign_insights: (ad_account_id, date, campaign_id) para upsert e queries

### Granularidade de dados
- **Por campanha por dia** — uma linha por campanha por dia, permite gráficos de evolução e drill-down

### Sincronização
- **Inngest cron diário (6h) + botão manual** na tela
- Inngest function usa step.run por conta para retry individual
- Pausa de 2s entre contas para respeitar rate limits
- Monitorar header X-Business-Use-Case-Usage (backoff acima de 80%)
- Botão manual dispara Inngest event (mesma lógica)

### Meta API client
- **fetch direto** contra Graph API v25.0 (sem SDK oficial)
- Validar TODA resposta com Zod antes de salvar
- Versão pinada explicitamente em toda URL
- Campos: campaign_id, campaign_name, spend, impressions, clicks, reach, cpc, cpm, ctr, actions, cost_per_action_type
- date_preset=yesterday para polling diário

### Tela /trafego
- **Visão por cliente + campanhas**: cards agrupados por cliente mostrando spend total, campanhas ativas, última sync
- Expandir mostra campanhas individuais com métricas
- Botão "Sincronizar agora" no topo
- Última sync visível

### Variáveis de ambiente
- META_SYSTEM_USER_TOKEN (já configurado)
- META_BUSINESS_ID (já configurado)
- META_API_VERSION=v25.0 (já configurado)
- Adicionar ao .env.example como placeholders vazios

</decisions>

<specifics>
## Specific Ideas

- Contas conhecidas (confirmadas via teste da API):
  - act_926166376906564 — Magrass Vinhedo
  - act_2617591481740758 — Master Pizza
  - act_776331471222626 — Mountain (CA-01)
  - act_1763213724519896 — Melzinho (BM02 CA1)
  - act_24205126709189841 — Melzinho (CA-02)
  - act_1553732512524993 — Aurea Cred (CA02 BM02)
  - act_3798304903797275 — Mountain (CA-02)
  - act_25649213958071877 — Aurea Cred (CA03 BM02)
- cliente_id na ad_accounts começa null — associar manualmente depois na UI ou via seed
- Inngest precisa: npm install inngest, criar src/lib/inngest/client.ts, criar src/app/api/inngest/route.ts
- Primeiro sync pode ser manual (botão) para popular o banco imediatamente

</specifics>

# Meta Marketing API (Graph API) - Pesquisa Completa

**Data da pesquisa:** 2026-07-11
**Dominio:** Meta Marketing API / Graph API para agencia de marketing digital
**Confianca geral:** MEDIUM-HIGH
**Versao da API pesquisada:** v25.0 (lancada em 18/02/2026)

---

## Indice

1. [O que a API consegue puxar](#1-o-que-a-api-consegue-puxar)
2. [Autenticacao e acesso](#2-autenticacao-e-acesso)
3. [Seguranca — CRITICO](#3-seguranca--critico)
4. [Arquitetura recomendada para a JSR](#4-arquitetura-recomendada-para-a-jsr)
5. [Limites e cuidados](#5-limites-e-cuidados)
6. [O que e possivel fazer SEM App Review](#6-o-que-e-possivel-fazer-sem-app-review)
7. [Resumo executivo](#resumo-executivo)

---

## 1. O que a API consegue puxar

### 1.1 Hierarquia de objetos do Meta Ads

O Meta Ads organiza tudo numa hierarquia simples:

```
Business Manager (BM)
  └── Ad Account (Conta de Anuncio) — ex: act_123456789
        └── Campaign (Campanha)
              └── Ad Set (Conjunto de Anuncios)
                    └── Ad (Anuncio individual)
```

Cada nivel tem seu proprio endpoint de Insights (metricas de desempenho).

### 1.2 Dados de Conta de Anuncio

Endpoint: `GET /v25.0/act_{ad-account-id}`

| Campo | O que e | Exemplo |
|-------|---------|---------|
| `name` | Nome da conta | "JSR - Cliente ABC" |
| `account_status` | Status da conta (1=Ativa, 2=Desativada, 3=Nao confirmada, etc.) | `1` |
| `spend_cap` | Limite de gasto total da conta (em centavos) | `"500000"` (= R$5.000) |
| `amount_spent` | Total ja gasto pela conta (em centavos) | `"123456"` (= R$1.234,56) |
| `currency` | Moeda da conta | `"BRL"` |
| `balance` | Saldo devedor (pos-pago) | `"0"` |
| `business` | BM vinculado | `{id, name}` |
| `timezone_name` | Fuso horario | `"America/Sao_Paulo"` |

### 1.3 Metricas de Desempenho (Insights)

Essa e a parte mais importante para o dashboard da JSR. A API de Insights retorna 70+ metricas. As mais relevantes para voces:

#### Metricas de entrega e alcance

| Campo da API | O que significa | Util para |
|-------------|----------------|-----------|
| `impressions` | Quantas vezes o anuncio foi exibido | Volume geral |
| `reach` | Quantas pessoas UNICAS viram | Alcance real |
| `frequency` | Media de vezes que cada pessoa viu | Saturacao de audiencia |

#### Metricas de engajamento e cliques

| Campo da API | O que significa | Util para |
|-------------|----------------|-----------|
| `clicks` | Todos os cliques (incluindo curtir, comentar) | Engajamento geral |
| `link_clicks` | Cliques no link do anuncio | Trafego real pro site/LP |
| `ctr` | Taxa de clique (clicks/impressions * 100) | Eficiencia do criativo |
| `unique_clicks` | Cliques unicos | Pessoas que clicaram |
| `unique_ctr` | CTR unico | Eficiencia por pessoa |

#### Metricas de custo

| Campo da API | O que significa | Util para |
|-------------|----------------|-----------|
| `spend` | Quanto foi gasto (na moeda da conta) | **CRITICO - controle de verba** |
| `cpm` | Custo por mil impressoes | Custo de exibicao |
| `cpc` | Custo por clique | Custo de trafego |
| `cpp` | Custo por ponto de alcance | Eficiencia de alcance |
| `cost_per_action_type` | Custo por tipo de acao (compra, lead, etc.) | ROI por objetivo |
| `cost_per_unique_click` | Custo por clique unico | Custo real de trafego |

#### Metricas de conversao (as mais importantes para relatorio semanal)

| Campo da API | O que significa | Tipo de cliente |
|-------------|----------------|-----------------|
| `actions` | Array com TODAS as acoes (leads, compras, mensagens, etc.) | Todos |
| `action_values` | Valor monetario das acoes (faturamento de compras, etc.) | E-commerce |
| `conversions` | Conversoes rastreadas | Todos |
| `cost_per_action_type` | Custo por tipo de conversao | Todos |

**Como funciona o campo `actions`:**
E um array de objetos. Cada objeto tem `action_type` e `value`:
```json
{
  "actions": [
    {"action_type": "link_click", "value": "150"},
    {"action_type": "lead", "value": "12"},
    {"action_type": "purchase", "value": "5"},
    {"action_type": "onsite_conversion.messaging_conversation_started_7d", "value": "8"}
  ]
}
```

**Mapeamento por tipo de cliente da JSR:**

| Tipo de cliente | action_types relevantes | O que acompanhar |
|----------------|------------------------|------------------|
| E-commerce | `purchase`, `add_to_cart`, `initiate_checkout` + `action_values` para ROAS | Vendas, faturamento, ROAS |
| Local (restaurante, clinica) | `lead`, `messaging_conversation_started`, `onsite_conversion.messaging_*` | Leads, mensagens no WhatsApp/Messenger |
| Infoprodutos | `lead`, `offsite_conversion.fb_pixel_*`, `purchase` | Leads captados, vendas de curso |

#### Metricas de video

| Campo da API | O que significa |
|-------------|----------------|
| `video_play_actions` | Reproducoes de video |
| `video_views` | Visualizacoes de video |

#### Metricas de qualidade

| Campo da API | O que significa |
|-------------|----------------|
| `quality_ranking` | Ranking de qualidade vs concorrentes |

### 1.4 Endpoints de Insights

Voce pode puxar metricas em qualquer nivel da hierarquia:

```
GET /v25.0/act_{ad-account-id}/insights    ← nivel conta (total)
GET /v25.0/{campaign-id}/insights          ← nivel campanha
GET /v25.0/{ad-set-id}/insights            ← nivel conjunto
GET /v25.0/{ad-id}/insights                ← nivel anuncio
```

**Exemplo pratico — Puxar gastos e resultados de TODAS as campanhas de um cliente nos ultimos 7 dias:**
```
GET /v25.0/act_123456789/insights
  ?level=campaign
  &fields=campaign_id,campaign_name,impressions,clicks,spend,cpm,cpc,reach,frequency,actions,cost_per_action_type
  &date_preset=last_7d
  &access_token={TOKEN}
```

**Exemplo com periodo personalizado e dados por dia:**
```
GET /v25.0/act_123456789/insights
  ?level=campaign
  &fields=campaign_name,spend,impressions,actions
  &time_range={"since":"2026-07-01","until":"2026-07-07"}
  &time_increment=1
  &access_token={TOKEN}
```

O parametro `time_increment=1` faz a API retornar os dados separados por dia (em vez de somados no periodo).

### 1.5 Breakdowns (segmentacao dos dados)

Voce pode quebrar os resultados por diversas dimensoes:

| Breakdown | O que faz | Exemplo de uso |
|-----------|-----------|----------------|
| `age` | Separa por faixa etaria | Ver qual idade converte mais |
| `gender` | Separa por genero | Otimizar publico |
| `country` | Separa por pais | Irrelevante pra JSR (so BR) |
| `region` | Separa por estado/regiao | Util para clientes locais |
| `device_platform` | Mobile vs Desktop | Ver onde gasta mais |
| `publisher_platform` | Facebook vs Instagram vs Messenger | Ver qual plataforma performa |
| `platform_position` | Feed, Stories, Reels, Search | Ver qual posicionamento funciona |
| `hourly_stats_aggregated_by_advertiser_time_zone` | Por hora do dia | Otimizar horarios |

**Restricoes de combinacao:** Nem todos os breakdowns podem ser combinados entre si. A Meta tem uma tabela de combinacoes permitidas na documentacao oficial.

### 1.6 Dados de Campanhas, Ad Sets e Ads (nao-Insights)

Alem de metricas, voce pode puxar os metadados dos objetos:

**Campanhas:**
```
GET /v25.0/act_{id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time
```

**Conjuntos de anuncios (Ad Sets):**
```
GET /v25.0/act_{id}/adsets?fields=id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal
```

**Anuncios individuais:**
```
GET /v25.0/act_{id}/ads?fields=id,name,status,creative
```

### 1.7 O que NAO esta disponivel via API

| O que voce NAO consegue | Motivo |
|-------------------------|--------|
| Dados em tempo real (minuto a minuto) | Insights tem delay de ate 3 horas; dados do dia corrente sao parciais |
| Metricas de concorrentes | Meta nao expoe dados de outros anunciantes |
| Dados de Pixel/Conversions API detalhados (eventos crus) | Voce ve os agregados, nao o log individual de cada conversao |
| Publicos salvos de outros anunciantes | Privacidade |
| Criativos de outros anunciantes (exceto Ad Library publica) | Privacidade |
| Dados historicos ilimitados | Insights sao retidos por ~37 meses; dados mais antigos podem nao estar disponiveis |
| Metricas de `reach` com breakdowns para periodos > 13 meses | Restricao implementada em junho/2025 |

---

## 2. Autenticacao e acesso

### 2.1 Tipos de token

| Tipo | Duracao | Quando usar | Risco |
|------|---------|-------------|-------|
| **Short-lived User Token** | 1-2 horas | Testes rapidos | Expira rapido demais para producao |
| **Long-lived User Token** | 60 dias | Nunca em producao | Depende de uma pessoa estar logada; expira |
| **System User Token** | **Nao expira** (permanente) | **USAR ESTE** | Precisa de App + BM configurado |

**Decisao para a JSR: usar System User Token.** Motivos:
- Nao expira (nao vai parar de funcionar num sabado a noite)
- Nao depende de nenhuma pessoa especifica da equipe estar logada
- Pode ser revogado e regenerado a qualquer momento
- E o metodo recomendado pela Meta para automacao server-to-server

### 2.2 Permissoes necessarias

Para o caso da JSR (APENAS LEITURA de dados de campanhas), as permissoes necessarias sao:

| Permissao | O que permite | Necessaria? |
|-----------|--------------|-------------|
| `ads_read` | Ler dados de campanhas, ad sets, ads, e insights | **SIM - essencial** |
| `ads_management` | Criar, editar, deletar campanhas | **NAO para v1** (somente leitura) |
| `business_management` | Acessar dados do Business Manager, listar contas | **SIM** (para listar contas da BM) |
| `read_insights` | Ler metricas de paginas | Opcional |

**IMPORTANTE:** Para a v1 do sistema JSR, use APENAS `ads_read` + `business_management`. NAO peca `ads_management` — isso evita qualquer risco de alterar campanhas acidentalmente.

### 2.3 Niveis de acesso do App

A Meta tem niveis de acesso para apps que usam a Marketing API:

| Nivel | Quem pode usar o app | Rate limits | System Users | Precisa de App Review? |
|-------|---------------------|-------------|--------------|----------------------|
| **Development (Limited Access)** | Apenas admins do app e da BM | Bem limitado (60 pontos, ~60 leituras) | 1 system user + 1 admin | **NAO** |
| **Standard Access (Full Access)** | Usuarios da sua BM | Normal (9.000 pontos) | 10 system users + 1 admin | **SIM** (mas simplificado desde maio/2026) |
| **Advanced Access** | Qualquer negocio (terceiros) | Normal | 10+ | **SIM** (review completo) |

### 2.4 App Review — precisa ou nao?

**Resposta curta para o caso da JSR:**

Se TODAS as contas de anuncio dos clientes estao compartilhadas/vinculadas dentro do Business Manager da JSR (o que e o caso padrao de agencias no Meta), voce esta acessando **suas proprias contas** do ponto de vista da Meta.

Nesse cenario:
- **Development Mode funciona** para comecar a desenvolver e testar
- **Standard Access (Full Access)** e necessario para producao confiavel (rate limits muito maiores)
- **Advanced Access NAO e necessario** (isso e pra quem faz SaaS para terceiros)

**Processo para Standard Access (atualizado maio/2026):**
1. Fazer pelo menos 500 chamadas a API em 15 dias (era 1.500 antes)
2. Manter taxa de erro abaixo de 15% nessas 500 chamadas
3. Nao precisa mais enviar video/screencast (removido em maio/2026)
4. Solicitar upgrade no App Dashboard

**Tempo estimado:** Alguns dias para atingir as 500 chamadas + aprovacao em horas/poucos dias (automatico se os criterios forem atendidos).

### 2.5 Verificacao de negocio

A Verificacao de Negocio (Business Verification) e um processo SEPARADO do App Review:
- Confirma que a empresa e real (CNPJ, documentos)
- Necessaria para acessar dados sensiveis e para niveis de acesso mais altos
- **Recomendado iniciar CEDO** — pode levar de dias a semanas

---

## 3. Seguranca — CRITICO

### 3.1 Permissoes READ-ONLY (sem risco de alterar campanhas)

| Permissao | Consegue ALTERAR campanhas? | Segura para leitura? |
|-----------|---------------------------|---------------------|
| `ads_read` | **NAO** | **SIM** |
| `business_management` | Nao altera ads (mas pode gerenciar BM) | SIM para leitura de ads |
| `ads_management` | **SIM — pode criar/editar/deletar** | **NAO USAR na v1** |

**Regra de ouro:** Na v1 do sistema JSR, o System User deve ter APENAS `ads_read` + `business_management`. Nunca `ads_management`.

### 3.2 O que NUNCA fazer com a API

| Acao perigosa | O que pode acontecer | Como evitar |
|---------------|---------------------|-------------|
| Fazer muitas requisicoes em rajada (burst) | Flag de bot, conta restrita | Implementar backoff exponencial, respeitar headers |
| Tentar alterar campanhas via automacao sem supervisao humana | Ban da conta, suspensao da BM | Usar apenas `ads_read` na v1 |
| Compartilhar token em repositorio Git | Qualquer pessoa com o token tem acesso total | Guardar em variavel de ambiente (SOPS/env) |
| Ignorar rate limits e continuar batendo na API | Bloqueio temporario, e depois permanente | Monitorar `X-Business-Use-Case-Usage` |
| Usar SDKs/conectores nao-oficiais de terceiros | Se o app deles for banido, suas contas podem ser afetadas | Usar seu proprio App, SDK oficial ou fetch direto |
| Fazer scraping do Ads Manager (fora da API) | Ban imediato e permanente | Usar APENAS a API oficial |
| Acessar contas de clientes fora da sua BM sem permissao | Violacao de termos | Manter tudo dentro da BM da JSR |

### 3.3 Rate limits e como respeitar

#### Como funciona

A Meta usa um sistema de "pontos" por chamada de API. Cada chamada gasta pontos:
- **Leitura (GET):** ~1 ponto
- **Escrita (POST/PUT):** ~3 pontos

O limite e POR CONTA DE ANUNCIO, POR HORA:

| Nivel de acesso | Limite de pontos/hora (por ad account) | Tempo de bloqueio |
|----------------|---------------------------------------|-------------------|
| Development | 60 pontos (+ 40 por anuncio ativo) | 300 segundos (5 min) |
| Standard/Full | 9.000 pontos | 60 segundos |

Para a JSR com ~10 clientes e polling diario, voces vao usar uma FRACAO minuscula desses limites.

#### Como monitorar (IMPORTANTE)

Toda resposta da API inclui um header `X-Business-Use-Case-Usage` com:

```json
{
  "business_id_123": [
    {
      "call_count": 28,
      "total_cputime": 15,
      "total_time": 22,
      "type": "ads_insights",
      "estimated_time_to_regain_access": 0
    }
  ]
}
```

**Regras:**
- Valores sao porcentagem (0-100)
- **Abaixo de 80%:** tudo normal
- **Entre 80-100%:** comecar a desacelerar (backoff)
- **100%:** parar e esperar (vai receber erro 17 / HTTP 429)

Tambem existe o header `x-fb-ads-insights-throttle`:
```json
{
  "app_id_util_pct": 5.2,
  "acc_id_util_pct": 12.0,
  "ads_api_access_tier": "standard_access"
}
```

#### Implementacao recomendada (com Inngest)

```typescript
// No Inngest function, ANTES de cada chamada:
const usage = response.headers.get('x-business-use-case-usage');
if (usage) {
  const parsed = JSON.parse(usage);
  const metrics = Object.values(parsed)[0][0];
  
  if (metrics.call_count > 80 || metrics.total_cputime > 80 || metrics.total_time > 80) {
    // Backoff — esperar antes da proxima chamada
    await step.sleep('rate-limit-backoff', '30s');
  }
  
  if (metrics.call_count >= 100) {
    // Parar e esperar o tempo indicado pela Meta
    const waitTime = metrics.estimated_time_to_regain_access || 300;
    await step.sleep('rate-limit-wait', `${waitTime}s`);
  }
}
```

### 3.4 Token storage — como guardar tokens de forma segura

| Onde guardar | Seguro? | Como |
|-------------|---------|------|
| Variavel de ambiente no Vercel | **SIM** | Settings > Environment Variables |
| SOPS (criptografado no repo) | **SIM** | Criptografado em repouso |
| Supabase (tabela criptografada) | SIM | Se usar RLS + criptografia |
| Hardcoded no codigo | **NUNCA** | Token no codigo = desastre |
| `.env` commitado no Git | **NUNCA** | Qualquer um com acesso ao repo ve |
| Console do navegador / frontend | **NUNCA** | Token fica exposto ao usuario |

**O que acontece se o token vazar:**
- Quem tiver o token pode acessar TODAS as contas de anuncio do System User
- Se for `ads_management`: pode criar/pausar/deletar campanhas
- Se for `ads_read`: pode ver todos os dados financeiros
- **Acao imediata:** revogar o token no Business Manager e gerar um novo

### 3.5 Boas praticas para nao tomar flag/ban

1. **Espacar as requisicoes** — nao fazer 100 chamadas em 1 segundo
2. **Usar backoff exponencial** — se receber erro, esperar mais a cada tentativa
3. **Monitorar os headers de rate limit** em toda resposta
4. **Nao fazer polling a cada minuto** — dados de Insights tem delay de ~3h, polling diario e suficiente
5. **Usar requests async** para relatorios grandes (mais de 1 campanha com breakdowns)
6. **Pedir apenas os fields necessarios** — nao pedir todos os 70+ campos se precisa de 10
7. **Manter a versao da API atualizada** — nao usar versao deprecated

---

## 4. Arquitetura recomendada para a JSR

### 4.1 Visao geral do fluxo

```
Business Manager da JSR
    │
    ├── Conta de Anuncio: Cliente A (compartilhada na BM)
    ├── Conta de Anuncio: Cliente B (compartilhada na BM)
    ├── Conta de Anuncio: Cliente C (compartilhada na BM)
    └── ... (~10 clientes)
    
System User (criado na BM da JSR)
    │
    ├── Permissao: ads_read em TODAS as contas acima
    ├── Permissao: business_management
    └── Token gerado → guardado no Vercel (env var)

Sistema JSR (Next.js no Vercel)
    │
    ├── Inngest Function (cron diario)
    │     └── Para cada conta de anuncio:
    │           1. GET /insights (spend, actions, etc.)
    │           2. Salvar no Supabase (Postgres)
    │           3. Verificar alertas (verba baixa, etc.)
    │
    ├── Dashboard (leitura do Supabase)
    │     └── Mostra metricas, graficos, alertas
    │
    └── Relatorio Semanal (Inngest Function)
          └── Compila dados da semana do Supabase → gera relatorio
```

### 4.2 System User no Business Manager

**Como criar:**
1. Ir em Business Manager > Configuracoes > Usuarios > Usuarios do Sistema
2. Clicar em "Adicionar" > nome: "JSR Dashboard Bot" (ou similar)
3. Tipo: **Usuario do Sistema** (NAO admin — principio de menor privilegio)
4. Atribuir as contas de anuncio: dar acesso de **leitura** a cada conta de cliente
5. Gerar token com as permissoes `ads_read` e `business_management`

**Cuidados:**
- O System User NAO e uma pessoa — e uma "conta de servico" para automacao
- Voce pode ter 1 system user no modo Development, 10 no modo Standard
- Se alguem sair da equipe, o System User continua funcionando (nao depende de login pessoal)

### 4.3 Como acessar contas de clientes compartilhadas na BM

Quando um cliente compartilha (ou a agencia adiciona) a conta de anuncio dele na BM da JSR, essa conta aparece como "compartilhada". O System User da BM pode acessar QUALQUER conta compartilhada na BM, desde que tenha permissao atribuida.

**Para listar todas as contas de anuncio da BM:**
```
GET /v25.0/{business-id}/owned_ad_accounts
  ?fields=id,name,account_status,currency,amount_spent,spend_cap
  &access_token={SYSTEM_USER_TOKEN}
```

E para contas compartilhadas (de clientes):
```
GET /v25.0/{business-id}/client_ad_accounts
  ?fields=id,name,account_status,currency,amount_spent,spend_cap
  &access_token={SYSTEM_USER_TOKEN}
```

### 4.4 Diferenca entre Owner vs Shared Access

| Aspecto | Conta propria (owned) | Conta compartilhada (client) |
|---------|----------------------|------------------------------|
| Endpoint para listar | `/owned_ad_accounts` | `/client_ad_accounts` |
| Quem paga | A BM dona | O cliente (ou BM do cliente) |
| Pode remover acesso? | Sempre | O dono da conta pode revogar |
| Insights disponiveis? | Sim | Sim (se System User tem permissao) |
| Risco se cliente sair | N/A | Perde acesso quando desvincula |

Para a JSR, a maioria dos clientes provavelmente esta como `client_ad_accounts` (contas compartilhadas).

### 4.5 Fluxo do Inngest Function (polling diario)

```typescript
// app/api/inngest/functions/sync-meta-ads.ts

import { inngest } from '@/lib/inngest/client';

export const syncMetaAds = inngest.createFunction(
  { id: 'sync-meta-ads', name: 'Sincronizar Meta Ads' },
  { cron: '0 6 * * *' }, // Todo dia as 6h (dados do dia anterior ja consolidados)
  async ({ step }) => {
    // 1. Buscar todas as contas ativas do Supabase
    const accounts = await step.run('fetch-accounts', async () => {
      return db.select().from(adAccounts).where(eq(adAccounts.platform, 'meta'));
    });

    // 2. Para cada conta, puxar insights
    for (const account of accounts) {
      await step.run(`sync-${account.metaAccountId}`, async () => {
        const response = await fetch(
          `https://graph.facebook.com/v25.0/act_${account.metaAccountId}/insights` +
          `?fields=campaign_id,campaign_name,spend,impressions,clicks,actions,cost_per_action_type,reach` +
          `&date_preset=yesterday` +
          `&level=campaign` +
          `&access_token=${process.env.META_SYSTEM_USER_TOKEN}`
        );

        // 3. Validar com Zod (OBRIGATORIO — nunca confiar no shape da resposta)
        const data = await response.json();
        const validated = metaInsightsSchema.parse(data);

        // 4. Salvar no Supabase
        await db.insert(campaignInsights).values(
          validated.data.map(insight => ({
            clientId: account.clientId,
            campaignId: insight.campaign_id,
            campaignName: insight.campaign_name,
            spend: parseFloat(insight.spend),
            impressions: parseInt(insight.impressions),
            clicks: parseInt(insight.clicks),
            // ... demais campos
            date: insight.date_start,
            syncedAt: new Date(),
          }))
        );

        // 5. Verificar alertas (verba baixa, etc.)
        await checkBudgetAlerts(account);
      });

      // Pequena pausa entre contas para nao bater rate limit
      await step.sleep('between-accounts', '2s');
    }
  }
);
```

---

## 5. Limites e cuidados

### 5.1 Versoes da API e depreciacao

| Versao | Data de lancamento | Data de expiracao | Status |
|--------|-------------------|-------------------|--------|
| v25.0 | 18/02/2026 | ~02/2028 (estimado) | **ATUAL — USAR ESTA** |
| v24.0 | 08/10/2025 | ~10/2027 (estimado) | Suportada |
| v23.0 | 29/05/2025 | Expirou em 09/06/2026 | **EXPIRADA** |
| v22.0 | 21/01/2025 | ~01/2027 (estimado) | Suportada |
| v21.0 | 02/10/2024 | ~10/2026 (estimado) | Suportada |
| v20.0 | 21/05/2024 | **24/09/2026** | Deprecando em breve |

**Regra da Meta:** Cada versao e garantida por **pelo menos 2 anos** a partir do lancamento.

**Recomendacao:** Usar v25.0 (a mais recente). Isso da ate fevereiro de 2028 sem precisar atualizar.

### 5.2 Como monitorar mudancas da Meta

1. **Changelog oficial:** `developers.facebook.com/docs/graph-api/changelog/versions/`
2. **Blog de desenvolvedores:** `developers.facebook.com/blog/`
3. **Acompanhar datas de depreciacao** — colocar um lembrete 3 meses antes da expiracao da versao em uso
4. **Testar em versao nova** antes de migrar — basta mudar `v25.0` para `v26.0` na URL quando sair

### 5.3 Limites de requisicoes detalhados

**Para Insights (o que a JSR mais vai usar):**

| Nivel de acesso | Quota por hora (por ad account) |
|----------------|-------------------------------|
| Development | 600 + (400 x num. de anuncios ativos) |
| Standard/Full | 190.000 + (400 x num. de anuncios ativos) |

**Para a JSR:** Com ~10 contas e polling diario, voces vao fazer talvez 50-100 chamadas por dia TOTAL. O limite de Development ja e suficiente para comecar.

### 5.4 Campos que mudam frequentemente

| Campo/recurso | Risco | O que fazer |
|--------------|-------|-------------|
| `actions` e `action_types` | Meta adiciona/remove tipos de acao entre versoes | Validar com Zod; tratar `action_types` desconhecidos graciosamente |
| Metricas de Advantage+ / ASC | Mudou bastante na v25.0 | Ficar de olho no changelog |
| Metricas de alcance (reach) | Restricoes de periodo adicionadas em 2025 | Nao pedir reach com periodo > 13 meses |
| Metricas de video | Nomes mudam entre versoes | Sempre testar apos atualizar versao |

### 5.5 Mudancas recentes importantes (Q2 2026)

- **Junho 2026:** Meta aposentou metricas de Page/Post reach, video impressions, story impressions — substituidas por Media Views, Media Viewers, e Page Viewer
- **v25.0:** Melhor detalhamento de erros na API de Insights async (campos `error_code`, `error_message`, etc.)
- **Maio 2026:** Requisito para Standard Access baixou de 1.500 para 500 chamadas; nao precisa mais de video

---

## 6. O que e possivel fazer SEM App Review

### 6.1 Modo Development — o que pode e o que nao pode

| O que funciona | O que NAO funciona |
|---------------|-------------------|
| Acessar contas de anuncio onde voce e admin | Acessar contas de terceiros fora da BM |
| Puxar insights de campanhas | Ter rate limits altos |
| Listar campanhas, ad sets, ads | Ter mais de 1 system user |
| Usar em "producao" com as suas proprias contas | Servir outros negocios/clientes fora da BM |

### 6.2 Quantos usuarios/tokens funcionam sem review

- **1 System User** (nao-admin) + **1 Admin System User**
- Ambos podem gerar tokens
- Para a JSR com ~10 clientes: **1 System User e suficiente** para comecar

### 6.3 Dou para usar em producao sem review?

**SIM, com ressalvas:**

Se todas as contas de anuncio dos clientes estao dentro da BM da JSR, o modo Development funciona em producao. Os dados sao REAIS (nao existe "sandbox" — tanto Development quanto Standard acessam dados reais de producao).

**Porem:** Os rate limits de Development sao BEM mais baixos. Para ~10 clientes com polling diario, deve funcionar. Mas se precisar puxar dados mais frequentemente ou com mais breakdowns, vai bater no limite.

**Recomendacao:**
1. **Comecar em Development** para validar toda a integracao
2. **Migrar para Standard Access** antes de ir para producao real (sao apenas 500 chamadas de teste + taxa de erro < 15%)
3. Nao precisa de Advanced Access

---

## RESUMO EXECUTIVO

### Decisoes recomendadas para o projeto JSR

#### Autenticacao
| Decisao | Escolha | Motivo |
|---------|---------|--------|
| Tipo de token | **System User Token** | Nao expira, nao depende de pessoa, ideal para automacao |
| Permissoes | **ads_read + business_management** | Somente leitura — zero risco de alterar campanhas |
| Nivel de acesso | Comecar em **Development**, migrar para **Standard** | Suficiente para ~10 clientes; Standard tem rate limits melhores |
| App Review | **NAO precisa de Advanced** | Contas dos clientes estao na BM da JSR |
| Versao da API | **v25.0** | Mais recente, garantida ate ~02/2028 |

#### Dados a puxar (polling diario via Inngest)

**Por conta de anuncio (cada cliente):**
```
fields=campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,
       actions,action_values,cost_per_action_type,cpc,cpm,ctr
```

- `time_increment=1` para dados por dia
- `level=campaign` para separar por campanha
- `date_preset=yesterday` para o polling diario
- Periodo maior (`time_range`) para o relatorio semanal

#### Seguranca
1. Token guardado APENAS em variavel de ambiente do Vercel
2. NUNCA no codigo, NUNCA no frontend
3. APENAS permissao `ads_read` (sem `ads_management`)
4. Monitorar header `X-Business-Use-Case-Usage` em toda resposta
5. Implementar backoff quando acima de 80%
6. Validar TODA resposta da API com Zod antes de salvar no banco

#### Arquitetura
1. **1 System User** na BM da JSR com acesso a todas as contas de clientes
2. **1 App** no Meta Developers vinculado a BM
3. **Inngest Function** com cron diario (6h da manha) para puxar dados
4. **Supabase (Postgres)** para armazenar historico de insights
5. **Zod schemas** para validar cada resposta da API
6. Usar `fetch` direto (nao SDK) com versao pinada `v25.0` — mais controle e menos dependencia

#### Cronograma sugerido de setup

| Passo | O que fazer | Tempo estimado | Bloqueante? |
|-------|------------|----------------|-------------|
| 1 | Criar App no Meta Developers | 30 min | Nao |
| 2 | Vincular App a BM da JSR | 10 min | Nao |
| 3 | Criar System User na BM | 15 min | Nao |
| 4 | Atribuir permissoes nas contas de clientes | 20 min | Nao |
| 5 | Gerar System User Token | 5 min | Nao |
| 6 | Iniciar Verificacao de Negocio | 10 min (mas aprovacao leva dias/semanas) | **Potencialmente** |
| 7 | Desenvolver e testar em Development mode | Dias | Nao |
| 8 | Atingir 500 chamadas e solicitar Standard Access | ~1 semana | Nao (se fizer em paralelo) |

#### Riscos e mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Rate limit em Development | Baixa (~10 clientes) | Medio | Migrar para Standard Access cedo |
| Token vazado | Baixa (se seguir boas praticas) | Alto | Env vars, nunca no codigo, revogar imediatamente |
| Meta muda API/campos | Media (acontece a cada ~4 meses) | Medio | Zod validation, monitorar changelog |
| Cliente desvincula conta da BM | Baixa | Baixo (por cliente) | Tratar erro 403 graciosamente, alertar equipe |
| Verificacao de Negocio demora | Media | Medio | Iniciar no dia 1 |

---

## Fontes

### Primarias (confianca ALTA)
- [Meta for Developers - Insights API](https://developers.facebook.com/docs/marketing-api/insights/) - campos, breakdowns, exemplos
- [Meta for Developers - Rate Limiting](https://developers.facebook.com/docs/marketing-api/overview/rate-limiting/) - limites, headers, tiers
- [Meta for Developers - Authorization](https://developers.facebook.com/docs/marketing-api/get-started/authorization) - permissoes, niveis de acesso
- [Meta for Developers - System Users](https://developers.facebook.com/docs/business-management-apis/system-users/overview/) - como criar e usar
- [Meta for Developers - Graph API Versions](https://developers.facebook.com/docs/graph-api/changelog/versions/) - datas de depreciacao
- [Meta for Developers - Insights Best Practices](https://developers.facebook.com/docs/marketing-api/insights/best-practices/) - otimizacao de queries
- [Meta for Developers - Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/) - segmentacoes disponiveis

### Secundarias (confianca MEDIA-ALTA)
- [Graph API v25.0 Changelog](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/) - mudancas v25
- [Meta Updates to Standard Access (maio/2026)](https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/) - requisitos simplificados
- [Meta Marketing API Q2 2026 Update](https://www.kitchn.io/blog/meta-marketing-api-q2-2026-update) - metricas aposentadas
- [Ryze - Insights Fields Reference](https://www.get-ryze.ai/blog/meta-ads-api-insights-endpoint-campaigns-impressions-clicks-spend-leads) - lista de campos e exemplos

### Terciarias (confianca MEDIA)
- [HyperFX - Ad Account Disabled Causes 2026](https://www.hyperfx.ai/blog/meta-ad-account-disabled-causes-2026) - riscos de ban
- [Blend AI - MCP Account Suspension Risks](https://blend-ai.com/mcp/learn/will-mcp-suspend-meta-ads-account) - riscos de automacao
- [AdManage - Meta Ads API Setup Guide](https://admanage.ai/blog/meta-ads-api) - guia pratico

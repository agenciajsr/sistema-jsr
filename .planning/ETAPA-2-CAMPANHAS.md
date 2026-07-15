# Etapa 2 do painel /campanhas — Demografia, Regiões e Objetivo oficial

**Criado em:** 2026-07-15 — handoff para nova conversa.
**Contexto:** A Etapa 1 (redesign visual, quick-260715-pmm + correção fast 47cd411) está PRONTA e em produção.

## O que a Etapa 2 deve entregar

1. **Dados Demográficos (idade × gênero)** — seção como na referência (imagem 6 de `Imagens_referencia_campanhas/`): barras por faixa etária, cores por gênero, seletor de campanha e de métrica (Impressões/Resultados/Compras/Leads/Conversas), botão "Ocultar Gênero".
2. **Regiões que mais vendem** — ranking de regiões/cidades por resultado e custo.
3. **Objetivo oficial da campanha** — sincronizar o campo `objective` real do Meta (hoje é inferido por actions/nome via `classificarObjetivo` em `src/lib/trafego/aggregate.ts` — manter como fallback). Habilita o filtro por objetivo na tabela (como na referência, imagem 4: chips VENDAS/LEADS).

## Por que exige mexer no sync (motivo de ter ficado para a Etapa 2)

O sync atual (`src/lib/meta/sync.ts`) NÃO pede breakdowns. Será preciso:
- Novas chamadas de insights com `breakdowns=age,gender` e `breakdowns=region` (janela de ~30d, como o `ad_insights` — o Meta não precisa entregar diário para isso).
- Campo `objective` na listagem de campanhas.
- Novas tabelas (ex.: `demografia_insights`, `regiao_insights`) + coluna `objective` — migration SEMPRE aplicada na mão (ver memória `migrations-aplicar-na-mao-nunca-drizzle-migrate`), NUNCA `drizzle-kit migrate`.
- Atenção ao rate limit do Meta (backoff em 429 já existe no client) e ao tempo do cron diário (`/api/cron/sync-meta`, 06h BR).

## Fatos importantes descobertos na Etapa 1 (não redescobrir)

- `campaign_insights` é DIÁRIA; `ad_insights` é JANELA agregada de ~30 dias (1 janela nova por dia de sync) — para anúncios usamos sempre a janela mais recente por `adId` (dedupe por maior `date_stop`).
- `adset_insights` está VAZIA desde sempre (sync nunca gravou) — conjuntos são derivados agrupando anúncios por `adsetId`. Se a Etapa 2 tocar no sync, avaliar passar a gravar adsets de verdade OU remover a tabela morta.
- Preferências do painel (KPIs do "Organizar" + funil) ficam em `preferencias_campanhas` (1 linha por cliente, jsonb) — migration 0024 JÁ aplicada em produção.
- Cores de gráfico: usar `--chart-1..5` definidas em `globals.css` (light + dark).
- Fonte única de parsing de actions: `src/lib/trafego/metricas.ts` (puro/testável; `aggregate.ts` reexporta).
- Dados do painel: `getPainelCampanhas` em `src/lib/trafego/painel.ts` (queries sequenciais de propósito — pool max=5; nunca Promise.all em queries pesadas).
- Futuro (não é a Etapa 2): portal do cliente — cliente loga e vê só o dashboard dele; por isso as preferências são POR CLIENTE.

## Referência visual

Prints em `Imagens_referencia_campanhas/` (raiz do projeto) — imagem 6 tem a seção de demografia.

## Como retomar

Iniciar pelo `/gsd:quick` com este arquivo como contexto. Antes de codar, inspecionar no banco o formato real das novas respostas do Meta (validar com Zod em `src/lib/meta/schemas.ts`).

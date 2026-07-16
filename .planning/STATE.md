---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Concluido quick 260716-i87 (PDF fiel ao DOCX + 2 signatarios Autentique)
last_updated: "2026-07-16T16:28:28.170Z"
last_activity: "2026-07-15 - Completed quick task 260715-la8: Relatórios configuráveis (blocos por conta, cron diário único, dialog Novo Relatório)"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 9
  completed_plans: 8
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-10)

**Core value:** Dar à equipe da JSR visibilidade em tempo real da saúde de cada cliente (verba, campanhas, contratos, financeiro) em um único painel, com alertas proativos.
**Current focus:** Fase 1 — Fundação (Acesso, Clientes e Contratos)

## Current Position

Phase: 1 of 6 (Fundação — Acesso, Clientes e Contratos)
Plan: 9 of 9 in current phase
Status: Ready to execute
Last activity: 2026-07-15 - Completed quick task 260715-la8: Relatórios configuráveis (blocos por conta, cron diário único, dialog Novo Relatório)

Progress: [████████░░] 83%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 25min | 3 tasks | 34 files |
| Phase 01 P02 | 35 | 3 tasks | 6 files |
| Phase 01 P03 | 29min | 3 tasks | 10 files |
| Phase 01 P04 | 15min | 2 tasks | 4 files |
| Phase 01 P05 | 10min | 2 tasks | 4 files |
| Phase 01 P06 | 15min | 2 tasks | 5 files |
| Phase 01 P07 | 6min | 2 tasks | 2 files |
| Phase 01 P08 | 12min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Fase 2 (integração Meta/Google Ads) entra logo após a Fundação por ser a parte mais arriscada e dependente de aprovações externas (Google Ads Basic Access, verificação de negócio da Meta) — pesquisa recomenda solicitar acesso no dia 1 da fase.
- Roadmap: Painel Geral Unificado (Fase 6) é a última fase por ser um rollup que depende de tráfego, contratos e financeiro já existirem com dados reais.
- [Phase 01]: shadcn CLI 4.13.x substituiu style/baseColor por presets nomeados; components.json escrito manualmente com valores legados new-york/neutral, validado funcionando com shadcn add
- [Phase 01]: DIRECT_URL usa o host do connection pooler na porta 5432 (session mode), nao o host classico db.<ref>.supabase.co — Host classico de conexao direta nao resolveu (ENOTFOUND) neste ambiente - limitacao conhecida do Supabase quando o endpoint direto e IPv6-only sem add-on IPv4. Host do pooler na porta 5432 suporta os mesmos recursos de sessao.
- [Phase 01]: contratoSchema usa z.coerce.number().positive() para valorMensal e refine() sobre strings YYYY-MM-DD para validar dataVencimento > dataInicio (evita ambiguidade de timezone com Date)
- [Phase 01]: Contrato vigente derivado por dataInicio (nunca por flag is_current armazenada), conforme 01-RESEARCH.md
- [Phase 01]: construirRegistroRenovacao não importa de @/lib/validations/contrato, evitando acoplamento cruzado com Plan 01-04
- [Phase 01]: tsx precisa de --env-file=.env.local para scripts standalone (nao carrega .env.local como o Next.js)
- [Phase 01]: Login usa React Hook Form + useTransition chamando a Server Action diretamente, nao useActionState, para permitir validacao client-side com Zod antes do round-trip
- [Phase 01]: createClienteComContrato usa db.transaction e .returning({ id }) para obter o id do cliente recem-criado antes de inserir o primeiro contrato
- [Phase 01]: criarUsuario chama requireAdmin() antes de validar/chamar a Admin API, bloqueando Membro o mais cedo possível na Server Action
- [Phase 01]: Tela de usuário dividida em page.tsx (Server, gate de Admin) + formulario-usuario.tsx (Client, hooks) — limite obrigatório do App Router
- [Phase 01]: z.input/z.output no useForm (3 generics do zodResolver) para resolver incompatibilidade de tipo quando o schema Zod usa .default() em um campo
- [Phase 01]: Exclusao de cliente/contrato usa Server Actions inline (form action) definidas dentro do proprio Server Component de detalhe, mantendo a checagem role === admin e a copy exata no mesmo arquivo
- [Phase 01]: ContratoForm evita o componente Dialog do shadcn (fora do Registry Safety do UI-SPEC), controlando visibilidade com useState
- [quick-260714-j92]: Status novos (aguardando_inicio, em_aviso) sao ADITIVOS — nenhuma consulta status='ativo' (dashboard, financeiro, relatorios, alertas, copilot) foi alterada. Mudar a semantica de "cliente ativo" agora alteraria numeros de outras telas sem o usuario pedir. Revisitar quando o CRM entrar.
- [quick-260714-j92]: Padrao de funcao de dados = poucas queries AGREGADAS sequenciais + merge em memoria via modulo puro testado (pool max=3, max_pipeline=0). Mesmo padrao do 260714-ita. Nada de paralelismo dentro da mesma funcao.
- [quick-260714-ita]: Matematica financeira mora em modulo puro (`@/lib/financeiro/calculos`, zero import de db/auth/react) — actions e UI so consomem. Torna os numeros testaveis sem banco e evita a mesma conta divergir entre telas.
- [quick-260714-ita]: Actions que rodam dentro de um Promise.all da pagina executam suas queries SEQUENCIALMENTE (pool max=3) — paralelizar por dentro reintroduz o travamento corrigido no 260713-usi.
- [quick-260714-qsy]: Tarefas recorrentes nascem pelo CALENDARIO, nunca pelo check — a de ontem em aberto vira `nao_realizada` e a de hoje aparece do mesmo jeito. Modelo MOLDE (eh_molde=true, nunca listado) + ocorrencias via tarefa_mae_id; a regra vive SO no molde.
- [quick-260714-qsy]: Materializacao de ocorrencias e PREGUICOSA (ao abrir /tarefas), nao por cron — os 2 slots de cron do plano Hobby da Vercel ja estao ocupados (sync-meta + relatorios-semanais). Se o plano virar Pro, um cron diario pode assumir sem reescrever: getTarefasDoDia e idempotente pelo indice unico (tarefa_mae_id, data).
- [quick-260714-qsy]: Janela de materializacao = hoje-30 .. hoje+60 (teto proposital: navegar para 2030 nao explode linhas).
- [quick-260715-0zf]: CRM segue padrao Pipedrive — ganho/perdido sao STATUS da oportunidade ('aberta'|'ganha'|'perdida'), NUNCA etapas do pipeline. Etapa com oportunidades nao pode ser excluida (action recusa + FK restrict como trava final).
- [quick-260715-0zf]: Helpers internos de log (registrarAtividadeCrm) moram em src/lib (modulo server comum), NUNCA exportados de arquivo 'use server' — todo export de arquivo 'use server' vira endpoint chamavel de fora.
- [quick-260715-0zf]: getWorkspaceAtual() retorna null tanto sem linha quanto com 'relation does not exist' — e o mecanismo de degradacao graciosa das telas do CRM enquanto a migration 0019 nao for aplicada. Multi-tenant futuro = trocar SO este helper.
- [quick-260715-1rq]: MIGRATIONS — NUNCA rodar `drizzle-kit migrate` neste projeto: a tabela drizzle.__drizzle_migrations esta VAZIA (o historico foi aplicado na mao pelo editor SQL do Supabase), entao o comando faria replay desde a 0000 sobre os dados reais. Aplicar SO o SQL da migration nova, via script Node pontual lendo DIRECT_URL, separando por '--> statement-breakpoint' e rodando dentro de sql.begin() (transacao = rollback total se falhar). SEMPRE conferir o estado REAL do banco antes (information_schema) — este STATE.md ja afirmou "0015-0019 pendentes" quando so a 0019 faltava.
- [quick-260715-1rq]: getCrmVisaoGeral() e a fonte UNICA da /crm (getKanban foi removida) — kanban + KPIs + origens numa so chamada, com GROUP BY/count no banco e queries SEQUENCIAIS (pool max=3): o numero de queries nao cresce com o numero de oportunidades.
- [quick-260715-1rq]: "Sem contato (+7d)" e o aviso "Nao contatado" saem de uma HEURISTICA (aberta ha +7d E sem tarefa comercial concluida), nao de uma coluna dedicada — usa so colunas existentes, sem migration. Trocar a heuristica = mexer so em getCrmVisaoGeral.
- [quick-260715-1rq]: Controles do mockup ainda sem backend (Lista, Calendario, periodo, filtro, engrenagem) sao PLACEHOLDERS HONESTOS (visiveis, inertes, title="Em breve") — nunca preencher com dado falso so para bater com o mockup.
- [quick-260715-0zf]: API publica de captacao (POST /api/crm/leads) NAO tem modo desprotegido (diferente dos crons): CRM_LEADS_TOKEN ausente = 401 para tudo. Dedup idempotente em 2 niveis: inbox por sha256(fonte|email-ou-telefone|dia) e contato por email (case-insensitive) OU telefone normalizado.
- [Phase quick-260715-oz9]: getCurrentUser tem withRetry (5s→8s) na revalidação completa; deslogado retorna null sem gastar retry; erro só após 2 falhas
- [Phase quick-260715-oz9]: Pool postgres.js: max=5 (era 3) para a 2ª tentativa do withRetry não disputar com queries órfãs; max_pipeline=1 e statement_timeout=12s intocados; sem global-error.tsx (root layout estático)
- [quick-260715-v6c]: LIMITAÇÃO FECHADA DA GRAPH API (medida 15/jul/2026, conta real): o Meta NÃO entrega conversões de PIXEL (compras/leads offsite) quebradas por região — privacidade pós-iOS 14. Nenhuma variação resolve (region em qualquer nível = 0; attribution windows = 0; dma = erro #100). Por região só chegam link_click, page_engagement, video_view, conversas onsite e lead de formulário instantâneo. O fallback do card de Regiões por cliques no link é a resposta honesta, NÃO um bug nosso — não reinvestigar.
- [quick-260715-v6c]: Métrica do ranking de regiões decide por COBERTURA (soma por região / total da MESMA janela 30d e MESMAS campanhas do breakdown), nunca por presença (soma > 0). Presença tinha furo comprovado: 1 onsite_conversion.purchase de 412 (0,2%) mantinha o card zerado em modo herói. Limiar LIMIAR_COBERTURA_REGIAO=0.5 exportado; separação medida (0,2% vs 100%+) torna o valor exato irrelevante. Denominador SEMPRE no mesmo recorte do numerador — período do filtro ou campanha fora do breakdown distorcem e disparam fallback falso.

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Fase 2 depende de aprovação externa do Google Ads API (Basic Access) e possivelmente Advanced Access/verificação de negócio da Meta — prazos fora do controle da equipe, solicitar o quanto antes.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260710-u8b | Redesenho visual e reorganização da navegação (incremento 1) | 2026-07-11 | 4d54960 | [260710-u8b-redesenho-visual-e-reorganizacao-da-nave](./quick/260710-u8b-redesenho-visual-e-reorganizacao-da-nave/) |
| 260710-v65 | Redesenho da Ficha do Cliente como hub com abas (incremento visual) | 2026-07-11 | 7cb6edb | [260710-v65-redesenho-da-ficha-do-cliente-incremento](./quick/260710-v65-redesenho-da-ficha-do-cliente-incremento/) |
| 260711-ejq | Elevar o design ao padrão premium (fundação + primitivos + Painel Mission Control) | 2026-07-11 | 5fe4f19 | [260711-ejq-elevar-design-ao-padrao-premium-incremen](./quick/260711-ejq-elevar-design-ao-padrao-premium-incremen/) |
| 260711-f7m | Reproduzir fielmente o dashboard de referência (sidebar+plano+perfil, 6 KPIs, painéis, tabela, card IA, 7 rotas placeholder) | 2026-07-11 | d1d86ed | [260711-f7m-reproduzir-fielmente-o-dashboard-de-refe](./quick/260711-f7m-reproduzir-fielmente-o-dashboard-de-refe/) |
| 260711-gi1 | Chat com IA (Copilot conversacional OpenAI via Vercel AI SDK) — streaming, rota protegida, chave server-only, degradação graciosa (incremento 5) | 2026-07-11 | 89f4e89 | [260711-gi1-chat-com-ia-copilot-openai-incremento-5-](./quick/260711-gi1-chat-com-ia-copilot-openai-incremento-5-/) |
| fast | Trocar logo textual "JSR" da sidebar por imagem (public/logo-jsr.png) | 2026-07-11 | e4d77ca | — (gsd:fast) |
| 260711-sv1 | Campanhas Parte 1: /campanhas repaginada — unificação por cliente, vínculo conta→cliente, leads/vendas/conversas do campo actions, ranking + gráfico, sync ampliado p/ 30 dias (dado real, sem migration) | 2026-07-11 | 019220f | [260711-sv1-campanhas-parte-1-repaginar-campanhas-co](./quick/260711-sv1-campanhas-parte-1-repaginar-campanhas-co/) |
| 260711-hik | Insights automáticos no dashboard via IA — rota GET /api/insights com streaming OpenAI, AiInsightFloat com fetch+ReadableStream reader e fallback silencioso | 2026-07-11 | d7d5a12 | [260711-hik-insights-automaticos-no-dashboard-via-ia](./quick/260711-hik-insights-automaticos-no-dashboard-via-ia/) |
| 260711-hts | Financeiro da agencia — tabela transacoes, CRUD Server Actions, MRR de contratos, tela /financeiro com dados reais | 2026-07-11 | cab8489 | [260711-hts-financeiro-da-agencia-tabelas-crud-mrr-p](./quick/260711-hts-financeiro-da-agencia-tabelas-crud-mrr-p/) |
| 260711-i9j | Alertas da agencia — alertas derivados on-demand (contratos, transacoes, clientes), tela /alertas real, dashboard real | 2026-07-11 | fa8a3ca | [260711-i9j-alertas-da-agencia-tabela-logica-avaliac](./quick/260711-i9j-alertas-da-agencia-tabela-logica-avaliac/) |
| 260711-q7a | Integracao Meta Ads — tabelas ad_accounts/campaign_insights, sync Inngest (cron+manual), tela /trafego real | 2026-07-11 | 81c9cc2 | [260711-q7a-integracao-meta-ads-tabelas-sync-inngest](./quick/260711-q7a-integracao-meta-ads-tabelas-sync-inngest/) |
| 260711-tg5 | Ficha do Cliente real — tabelas checklist_items/acompanhamentos + coluna usa_asaas (migration aditiva NÃO aplicada), cobrança editável, contas de anúncio reais + vínculo, checklist/acompanhamento persistidos, alertas do cliente; ficha 100% sem mock | 2026-07-12 | 6402a23 | [260711-tg5-ficha-do-cliente-real-ligar-a-ficha-aos-](./quick/260711-tg5-ficha-do-cliente-real-ligar-a-ficha-aos-/) |
| 260712-22h | Chat com IA ligado aos dados REAIS — buildSnapshot async (financeiro, clientes/contratos, alertas, performance de campanhas por cliente com ROAS) substitui os mocks; conserta Chat e card de Insights do dashboard | 2026-07-12 | 5e121c4 | [260712-22h-ligar-chat-com-ia-aos-dados-reais-reescr](./quick/260712-22h-ligar-chat-com-ia-aos-dados-reais-reescr/) |
| 260712-2vk | Monitoramento de Saúde de Campanhas Parte 1 — metas por cliente (meta_cpa/cpl/roas, migration 0005 aplicada), avaliação de anomalias (CPA acima da meta/subindo, queda de resultados/CTR, gastando sem converter) + Health Score 0-100, novos alertas integrados em getAlertas | 2026-07-12 | db88a2d | [260712-2vk-monitoramento-de-saude-de-campanhas-part](./quick/260712-2vk-monitoramento-de-saude-de-campanhas-part/) |
| (fast) | Sync Meta a cada 6h em horário de Brasília (00/06/12/18h) — antes 1x/dia às 06:00 UTC | 2026-07-12 | 82f06b7 | — (gsd:fast) |
| 260712-efy | Saúde de Campanhas Parte 2 — criativo rejeitado (effective_status DISAPPROVED/WITH_ISSUES) + fadiga de criativo (frequency), colunas em ad_insights (migration 0006 aplicada), sinais no health score e alertas; degradação graciosa sem os dados | 2026-07-12 | e92a38f | [260712-efy-saude-de-campanhas-parte-2-criativo-reje](./quick/260712-efy-saude-de-campanhas-parte-2-criativo-reje/) |
| 260712-f82 | Reformular cadastro de clientes completo — 7 secoes visuais, ~25 campos, 2 enums, getProfiles, checkboxes JSONB, migration 0007 (NAO aplicada) | 2026-07-12 | a46d6d1 | [260712-f82-reformular-cadastro-de-clientes-completo](./quick/260712-f82-reformular-cadastro-de-clientes-completo/) |
| 260712-fq8 | Fix: saudacao dinamica horario Brasilia, bug financeiro so contar status pago, campo linkDrive + botao Drive na ficha, migration 0008 | 2026-07-12 | 17c37ab | [260712-fq8-corrigir-saudacao-dashboard-bug-financei](./quick/260712-fq8-corrigir-saudacao-dashboard-bug-financei/) |
| 260712-g1c | Reformular modulo financeiro completo — centro de custo, recorrencia com parcelas automaticas, previsao de caixa 30 dias, 4 abas (Visao Geral/A Receber/A Pagar/Previsao), 6 KPIs, migration 0009 (NAO aplicada) | 2026-07-12 | 0a93766 | [260712-g1c-reformular-modulo-financeiro-completo-ce](./quick/260712-g1c-reformular-modulo-financeiro-completo-ce/) |
| 260712-h4y | Melhorar dashboard: grafico evolucao, atividade recente expandida, filtro periodo, campanhas saude com metas, responsividade mobile | 2026-07-12 | 200bf5c | [260712-h4y-melhorar-dashboard-grafico-evolucao-ativ](./quick/260712-h4y-melhorar-dashboard-grafico-evolucao-ativ/) |
| 260712-mro | Incorporar controle de verbas como aba em /campanhas, remover /verbas-ads placeholder | 2026-07-12 | b0cef77 | [260712-mro-incorporar-controle-de-verbas-como-aba-e](./quick/260712-mro-incorporar-controle-de-verbas-como-aba-e/) |
| 260712-nb8 | Modulo Verbas completo: pagina propria /verbas, sync funding_source, KPIs, alertas, menu lateral | 2026-07-12 | eca6309 | [260712-nb8-modulo-verbas-completo-menu-sync-funding](./quick/260712-nb8-modulo-verbas-completo-menu-sync-funding/) |
| (fast) | Reconciliar migrations 0010 duplicadas — remove orfao 0010_add_funding_source, torna 0010_calm_starbolt idempotente, commita artefatos drizzle (documentos/funding_source ja existem em prod, verificado read-only) | 2026-07-12 | 3e20038 | — (gsd:fast) |
| (fast) | Header: badge do sino com contagem real de alertas (getAlertas().length com try/catch), remove icone de Mensagens fake | 2026-07-12 | 8a88ba8 | — (gsd:fast) |
| 260712-uc1 | Integracao completa com Google Calendar (OAuth 2 duas vias): tabela google_credentials single-tenant + migration 0011 (NAO aplicada), fluxo start/callback com CSRF, refresh automatico, client REST Calendar validado por Zod (fuso Brasilia), card de agenda real, pagina /agenda (criar/editar), /integracoes Conectar/Desconectar. Pendente credenciais Google Cloud do usuario | 2026-07-12 | f8bb9fc | [260712-uc1-integracao-completa-com-google-calendar-](./quick/260712-uc1-integracao-completa-com-google-calendar-/) |
| 260713-usi | Corrigir de vez o travamento/erro intermitente do /financeiro — loading.tsx com skeleton (financeiro + generico do grupo app), helper withRetry (F5 automatico server-side, 12s → 500ms → 15s), carga em 2 lotes sequenciais de 4 queries (pool max=3); tela de erro vira ultimo recurso | 2026-07-14 | 9a5282b | [260713-usi-corrigir-de-vez-o-travamento-erro-interm](./quick/260713-usi-corrigir-de-vez-o-travamento-erro-interm/) |
| 260714-ccl | Alertas proativos persistidos — tabelas alertas/relatorios (migration 0013 NAO aplicada), avaliarEPersistirAlertas no cron sync-meta (dedup, reabertura, resolucao automatica), /alertas com abas novos/lidos/resolvidos, sininho conta novos; relatorio semanal automatico via 2o Vercel Cron (segunda 07h BR) com historico em /relatorios; funcao Inngest morta aposentada | 2026-07-14 | fef9b4c | [260714-ccl-acordar-alertas-proativos-tabela-alertas](./quick/260714-ccl-acordar-alertas-proativos-tabela-alertas/) |
| 260714-fast | Painel: olho de privacidade sem sobrepor icone, alturas uniformes e tendencias/sparklines reais nos 6 KPIs | 2026-07-14 | c764fd8 | — |
| 260714-ita | Financeiro — aba Visao Analitica (taxa de renovacao, MRR previsto, receita avulsa, lucro/cliente, despesas vs faturamento por faixa, dependencia de MRR Top5/Top10) + KPIs do Overview com "mes ant. R$X" e variacao %, chip "Dia X/Y (Z%)" no mes corrente; matematica isolada em modulo puro testado (30 testes); sem migration | 2026-07-14 | 13c66f3 | [260714-ita-financeiro-aba-visao-analitica-renovacao](./quick/260714-ita-financeiro-aba-visao-analitica-renovacao/) |
| 260714-j92 | Clientes — /clientes vira lista compacta (1 linha/cliente) com busca por nome e abas por status (Ativos/Aguardando Inicio/Em Aviso/Pausados/Inativos/Todos); N+1 removido: getClientesLista() faz 6 queries AGREGADAS sequenciais + merge em modulo puro testado (14 testes); status novos aguardando_inicio/em_aviso + migration 0014 GERADA e NAO aplicada; cliente-card.tsx removido | 2026-07-14 | 773d120 | [260714-j92-clientes-lista-compacta-com-abas-por-sta](./quick/260714-j92-clientes-lista-compacta-com-abas-por-sta/) |
| 260714-qsy | Modulo Tarefas estilo ClickUp — tabelas tarefas/tarefa_checklist_items (migration 0015 GERADA, NAO aplicada); modelo MOLDE + ocorrencias materializadas PREGUICOSAMENTE ao abrir /tarefas (sem cron novo: 2 slots do Hobby ocupados), idempotente por engine pura + indice unico (tarefa_mae_id, data) com onConflictDoNothing; engine de recorrencia PURA sob TDD (26 testes: dias uteis, dia sim/dia nao, mensal grampeando 31 jan->28 fev, anual 29/fev); getTarefasDoDia com 10 queries sequenciais agregadas; tela /tarefas (seletor de dia, blocos Atrasadas/Dia/Concluidas, sheet com checklist interno e recorrencia); D-03: ocorrencia atrasada vira nao_realizada e a do dia nasce pelo calendario; /checklist DELETADO do menu e das rotas (checklist da ficha do cliente intocado, V2) | 2026-07-14 | 88892a3 | [260714-qsy-modulo-tarefas-estilo-clickup-checklist-](./quick/260714-qsy-modulo-tarefas-estilo-clickup-checklist-/) |
| 260716-gxq | Contratos Parte 2 — tabela /contratos com 12 colunas exatas + dialogs Verificar/Editar/Excluir + seleção; template do contrato de tráfego versionado dos DOCX (3/6 meses), preview interno imprimível, PDF via @react-pdf/renderer, envio/reenvio via Autentique (GraphQL multipart), webhook + botão Atualizar status → assinado ativa o cliente; migration 0030 GERADA e NÃO aplicada (0029 também pendente — aplicar em ordem) | 2026-07-16 | 11ba0fa | [260716-gxq-fase-4-parte-2-contratos-tabela-reformad](./quick/260716-gxq-fase-4-parte-2-contratos-tabela-reformad/) |
| 260714-vy7 | Ajustes na Tarefa — FIX1: coluna subtitulo (text nullable) ponta a ponta (schema/validation/actions/dados) + migration 0018 GERADA e NAO aplicada, titulo 36px e Input de subtitulo no detalhe e na criacao (separado da descricao); FIX2: recorrencia so no dia — intervaloPadrao passa a [hoje-30, hoje] (nunca futuro por padrao), engine (ocorreEm/datasDaRegra/janelaMaterializacao) intacta, Nova Tarefa nasce em HOJE; FIX3: datas com um unico calendario nativo (CalendarDays redundante removido); 190 testes passando | 2026-07-14 | e3321d4 | [260714-vy7-ajustes-tarefa-1-titulo-maior-campo-subt](./quick/260714-vy7-ajustes-tarefa-1-titulo-maior-campo-subt/) |
| 260715-0zf | Backend completo do CRM comercial — 10 tabelas (workspaces single-tenant + crm_empresas/contatos/pipelines/etapas/oportunidades/tarefas/atividades/lead_inbox), migration 0019 GERADA c/ seed idempotente e NAO aplicada; actions padrao Pipedrive (ganho/perdido = STATUS; mover/ganhar c/ conversao opcional em cliente aguardando_inicio/perder c/ motivo obrigatorio/reabrir — tudo em crm_atividades); POST /api/crm/leads (x-crm-token, dedup sha256 por dia, inbox c/ trilha de erro); /crm kanban real (mover via select, nova oportunidade), /funil vira redirect, item CRM na sidebar; pendente: env CRM_LEADS_TOKEN | 2026-07-15 | f66ed2b | [260715-0zf-backend-completo-do-crm-comercial-worksp](./quick/260715-0zf-backend-completo-do-crm-comercial-worksp/) |
| 260715-gmf | Modal "Criar novo Lead" reformulado como Dialog central (imagens 07-11) — sistema de tags completo (crm_tags/crm_contato_tags, migration 0021 APLICADA, paleta CORES_TAG, criacao inline), 4 abas Contato/Dados Pessoais/Endereco/Anotacoes com forceMount (RHF preservado), leadSchema+criarLead persistindo perfil completo, dedup/aviso intactos; dialog.tsx entra no registry (substitui Card inline) | 2026-07-15 | c5b82f1 | [260715-gmf-reformular-modal-novo-lead-do-crm-dialog](./quick/260715-gmf-reformular-modal-novo-lead-do-crm-dialog/) |
| 260715-h9z | Card do Kanban fiel a imagem03 (avatar, linha azul servico/origem, #N, tags, WhatsApp sem brigar com o drag) + ficha do lead em DOIS paineis (foto c/ upload real no bucket publico crm-fotos, nome inline, tags, atendente, metricas/notas recolhiveis, Historico/Atividades/Informacoes do Negocio c/ Pipeline Completa) + atividades agendaveis em crm_tarefas (modal Criar atividade) — migration 0022 APLICADA (foto_url, data_inicio/fim, prioridade, bucket+policies) | 2026-07-15 | 14d77c4 | [260715-h9z-card-do-lead-estilo-imagem03-com-botao-w](./quick/260715-h9z-card-do-lead-estilo-imagem03-com-botao-w/) |
| 260715-1rq | /crm reformulada no visual do mockup definitivo (design-referencia-crm-kanban) — getCrmVisaoGeral SUBSTITUI getKanban como fonte unica (kanban + 6 KPIs + origens, tudo por GROUP BY/count no banco, queries sequenciais); colunas mostram VALOR PARADO na etapa + probabilidade; cards ganham badge de origem (VIA MANUAL/WHATSAPP/LANDING/META/INDICACAO), tempo relativo curto (helper testado, 7 casos) e aviso "Nao contatado"; barra "Origem dos leads" no rodape com % real por canal; CrmView com header, seletor de pipeline (badge Padrao), abas Kanban/Lista/Calendario e busca client-side; Lista/Calendario/periodo/filtro/config = placeholders honestos (sem dado falso); heuristica sem-contato (+7d sem tarefa concluida) usa so colunas existentes, sem migration nova; 206 testes | 2026-07-15 | 6897210 | [260715-1rq-reformular-pagina-crm-no-visual-do-mocku](./quick/260715-1rq-reformular-pagina-crm-no-visual-do-mocku/) |
| 260715-oz9 | Corrigir cascata de travamento — retry na sessão (getCurrentUser 5s→8s), error boundary de raiz em português (src/app/error.tsx), pool max 3→5 + delayMs 3s no withRetry do /financeiro; max_pipeline=1 intocado, sem migration | 2026-07-15 | 4c3ee4a | [260715-oz9-corrigir-cascata-de-travamento-retry-na-](./quick/260715-oz9-corrigir-cascata-de-travamento-retry-na-/) |
| 260715-pmm | Redesign da /campanhas no padrão do dashboard Meta Ads de referência — grade de 24 KPIs configurável (Organizar drag+switch persistido POR CLIENTE, toggle Comparar vs. período anterior c/ cor semântica), gráfico Performance multi-métrica (legenda clicável, eixos duplos, filtro por campanha), tabela campanhas/conjuntos/anúncios (busca, status badge, thumbnails, totais), Funil de Conversão 2-6 etapas; getPainelCampanhas (~3 queries sequenciais); catálogo puro c/ 14 testes; tabela preferencias_campanhas + migration 0024 GERADA e NÃO aplicada (rodar scripts/aplicar-migration-0024.ts) | 2026-07-15 | 0bddf26 | [260715-pmm-redesign-da-pagina-campanhas-kpis-config](./quick/260715-pmm-redesign-da-pagina-campanhas-kpis-config/) |
| fast-260715 | Correção pós-deploy do painel /campanhas: --chart-1..5 no CSS (gráfico Performance invisível), anúncios/criativos pela janela mais recente do ad_insights (janela ~30d, não diária), conjuntos derivados dos anúncios (adset_insights vazia), aviso na tabela de níveis | 2026-07-15 | 47cd411 | — |
| 260715-tud | Etapa 2 de /campanhas — sync com breakdowns idade×gênero e região + objective oficial (tabelas demografia_insights/regiao_insights, migration 0025 APLICADA via script manual); seção Dados Demográficos (barras empilhadas, Ocultar Gênero, seletor de campanha/métrica), ranking de Regiões pela chave-herói e chips de filtro por objetivo na tabela (objective Meta c/ classificarObjetivo como fallback); módulo puro demografia.ts sob TDD (10 testes, 1487 total); sync validado ponta a ponta em conta real (172 linhas demografia, 250 regiões) | 2026-07-15 | 2c28ee4 | [260715-tud-etapa-2-campanhas-demografia-idade-gener](./quick/260715-tud-etapa-2-campanhas-demografia-idade-gener/) |
| 260715-v6c | Card de Regiões de /campanhas com métrica adaptativa — ranking escolhe a métrica pela COBERTURA do dado (soma por região / total da mesma janela 30d e mesmas campanhas), não por presença: 1 compra onsite de 412 (0,2%) mantinha o card zerado em "Regiões que mais vendem"; agora cai para cliques no link com título "Regiões com mais tráfego" e nota citando a limitação de privacidade do Meta (motivo 'sem-cobertura'), ou nota neutra quando o cliente não teve resultado no período ('sem-resultados', não culpa o Meta); limiar 0.5 exportado e comentado com a medição; rankingDeRegioes/campanhasComRegiao puros sob TDD (19 testes, 1496 total) com regressão nomeada do caso real; validado read-only na conta Melzinho (vendas 0,2%→fallback, leads 100% e conversas 108,9%→herói); sem sync/migration | 2026-07-15 | 71bf75c | [260715-v6c-card-de-regioes-metrica-adaptativa-quand](./quick/260715-v6c-card-de-regioes-metrica-adaptativa-quand/) |
| fast-260715 | **Bug**: preferências de KPI/funil vazavam entre clientes em /campanhas — GradeKpis e FunilConversao nascem de useState a partir das props e, sem `key={cliente}`, o React reaproveitava a instância ao trocar de cliente: a grade seguia com as métricas do cliente anterior e o salvamento otimista gravava essa lista errada por cima da linha do cliente atual (o banco sempre teve 1 linha por cliente — o vazamento era de estado no React). Corrigido com key={cliente} nos dois. Preferências gravadas antes da correção estão contaminadas (Ramon com 0 KPIs ativos) — tratamento planejado na Etapa 3 | 2026-07-15 | 79b09db | [ETAPA-3-CAMPANHAS.md](./ETAPA-3-CAMPANHAS.md) |
| 260715-ibf | Tarefas visão DIÁRIA — botão único "Hoje" com calendário popover (shadcn popover+calendar) no lugar dos 2 inputs date + texto duplicado; coluna Concluídas só mostra concluídas NO dia visualizado (concluidaEm fuso BR, fallback legado data===dia) via tarefasDaVisaoDiaria pura sob TDD (10 testes novos, 237 total); ?dia= comanda a URL; sem migration | 2026-07-15 | 996030e | [260715-ibf-tarefas-corrigir-seletor-de-datas-so-bot](./quick/260715-ibf-tarefas-corrigir-seletor-de-datas-so-bot/) |
| 260716-ezd | Fase 3 do funil — Ganho no CRM converte lead em cliente: action converterOportunidadeEmCliente LEAD-FIRST idempotente em 3 níveis (oportunidade→contato→empresa, nunca duplica), dialog "Converter em cliente?" pós-ganho no kanban (cancelar não desfaz o ganho; card já convertido não reabre), módulo puro conversao.ts sob TDD (11 testes); migration 0028 aditiva (cliente_id em crm_contatos) GERADA e NÃO aplicada — snapshot do Drizzle posto em dia (0026/0027 manuais); degradação graciosa até aplicar | 2026-07-16 | 890bd66 | [260716-ezd-fase-3-do-funil-ganho-no-crm-converte-le](./quick/260716-ezd-fase-3-do-funil-ganho-no-crm-converte-le/) |
| 260716-g4h | Fase 4 Parte 1 — Contratos: conversão Ganho→Cliente coleta duração (3/6)/serviço/mensalidade e cria contrato aguardando_dados com token único (alimenta MRR via valorMensal); página pública /contrato/[token] mobile-first sem login (PJ/PF, CPF/CNPJ com dígito verificador, reenvio idempotente); /contratos com badges do fluxo + copiar link; módulos puros sob TDD (29 testes); migration 0029 aditiva GERADA e NÃO aplicada | 2026-07-16 | b92f6cf | [260716-g4h-fase-4-parte-1-contratos-dialog-com-plan](./quick/260716-g4h-fase-4-parte-1-contratos-dialog-com-plan/) |

## Session Continuity

Last session: 2026-07-16T16:28:28.165Z
Stopped at: Concluido quick 260716-i87 (PDF fiel ao DOCX + 2 signatarios Autentique)
Resume file: None

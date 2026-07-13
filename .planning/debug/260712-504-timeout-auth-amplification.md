---
status: awaiting_human_verify
trigger: "Páginas do app (Financeiro, Relatórios, Agenda) retornam intermitentemente 504 FUNCTION_INVOCATION_TIMEOUT na Vercel"
created: 2026-07-12T00:00:00Z
updated: 2026-07-12T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMADA — getCurrentUser() sem memoização, invocado ~6x por carga de página, amplifica latência de auth e estoura o timeout serverless em cold start.
test: tsc --noEmit (exit 0) + verificação em produção pós-deploy.
expecting: Após deploy, /financeiro, /relatorios e /agenda deixam de retornar 504 FUNCTION_INVOCATION_TIMEOUT.
next_action: Correções commitadas na master (3 commits atômicos). Aguardando push+deploy do usuário e confirmação em produção de que o 504 sumiu. NÃO arquivar até confirmação.

state: 2a rodada (fail-fast) commitada, aguardando verificação em produção pós-deploy.
commits_rodada_1:
  - fc2df99 fix(auth): memoizar getCurrentUser com React cache()
  - 72b2a15 fix(db): adicionar connect_timeout ao cliente postgres
  - 612b978 fix(app): adicionar maxDuration=30 nas paginas pesadas
commits_rodada_2:
  - 2499b9b fix(auth): fail-fast na revalidacao de sessao (withTimeout 8s + fail-open no proxy + error.tsx)
  - 9ba30d1 fix(db): statement_timeout de 12s no cliente postgres
  - a4d9e14 fix(app): maxDuration=25 em todas as paginas do grupo (app)

## Symptoms

expected: Páginas (/financeiro, /relatorios, /agenda) carregam rápido e confiáveis em produção na Vercel.
actual: Retornam 504 FUNCTION_INVOCATION_TIMEOUT intermitente; piora nas páginas com mais dados.
errors: "504: GATEWAY_TIMEOUT — Code: FUNCTION_INVOCATION_TIMEOUT" na rota /relatorios (e outras).
reproduction: Abrir sistema-jsr.vercel.app e navegar para /financeiro, /agenda, /relatorios. Não reproduzível localmente de forma consistente (depende de cold start / pool / DB).
started: Recente em produção; commit 486ac10 já tratou classe similar (painel travando).

## Eliminated

## Evidence

- timestamp: 2026-07-12T00:00:00Z
  checked: src/lib/auth/session.ts
  found: getCurrentUser() chama `await supabase.auth.getUser()` (round-trip que revalida contra servidor Supabase) + query de profile. Sem memoização.
  implication: Cada invocação = 1 round-trip de rede de auth. Confirma a base da hipótese.

- timestamp: 2026-07-12T00:00:00Z
  checked: src/lib/db/index.ts
  found: postgres() com prepare:false, max:3, idle_timeout:20, max_lifetime:1800. SEM connect_timeout.
  implication: Falha/lentidão de conexão trava até o default (~30s), estourando o timeout serverless.

- timestamp: 2026-07-12T00:00:00Z
  checked: src/lib/supabase/proxy.ts
  found: updateSession() chama getUser() 1x por requisição (middleware). Já é esperado.
  implication: +1 round-trip por request antes mesmo da página.

- timestamp: 2026-07-12T00:00:00Z
  checked: src/app/(app)/financeiro/page.tsx
  found: Promise.all com 8 chamadas, várias delas server actions (getResumoFinanceiro, listTransacoes, getContasAReceber, getContasAPagar, getPrevisaoCaixa, getProfiles) — cada uma chama getCurrentUser.
  implication: Amplificação de auth confirmada (~6 getUser numa carga). Sem maxDuration na página.

- timestamp: 2026-07-13T00:00:00Z
  checked: Logs de produção Vercel (pós-deploy d0d1502) + dashboard Supabase
  found: Rodada 1 resolveu financeiro/relatorios/agenda/verbas (voltaram 200). PORÉM ainda há "Vercel Runtime Timeout Error: Task timed out after 300 seconds" em /painel, /equipe, /campanhas. REVELADOR: /equipe é placeholder estático (só <EmBreve/>, zero DB) e mesmo assim travou 300s. Supabase com folga (3% CPU, 10/60 conexões) mas com incidente reportado ("investigating a technical issue"); travas começaram junto com o incidente.
  implication: Gargalo NÃO é lógica pesada de página — é o que TODA página faz: a checagem de sessão compartilhada (layout getCurrentUser + proxy updateSession), ambas chamando supabase.auth.getUser() SEM timeout. Durante o soluço do Supabase a chamada pendura e a função roda os 300s inteiros. Não é questão de plano/escala do banco.

- timestamp: 2026-07-13T00:00:00Z
  checked: Aplicação da rodada 2 (fail-fast) + npx tsc --noEmit
  found: tsc exit 0 após: withTimeout(8s) nas duas chamadas getUser, statement_timeout 12s no postgres, fail-open no proxy, error.tsx no grupo (app), maxDuration=25 em todas as 22 páginas do (app).
  implication: Caminho de auth compartilhado agora desiste em ~8-12s (nunca 300s). Erro rápido e recuperável em vez de freeze. Pendente confirmação em produção.

## Resolution

root_cause: Duas camadas. (1) Amplificação de auth: getCurrentUser() sem memoização, chamado ~6x/página → resolvido na rodada 1. (2) Sem timeout: getCurrentUser (session.ts) e updateSession (proxy.ts) chamam supabase.auth.getUser() SEM teto de tempo; queries de DB idem. Durante um soluço/incidente do Supabase a chamada fica pendurada e, como nada tem timeout curto, a função serverless roda os 300s inteiros até a Vercel matar — travando até páginas placeholder (/equipe). Não é escala/plano do banco.
fix: RODADA 1 (504 por amplificação): cache() em getCurrentUser (fc2df99), connect_timeout:10 (72b2a15), maxDuration=30 em 3 páginas (612b978). RODADA 2 (300s por falta de timeout / fail-fast): withTimeout(8s) nas duas chamadas getUser + fail-open no proxy + error.tsx no grupo (app) (2499b9b), statement_timeout:12s no postgres (9ba30d1), maxDuration=25 em todas as 22 páginas do (app), normalizando as 3 de 30→25 (a4d9e14).
verification: npx tsc --noEmit exit 0 nas duas rodadas. Verificação em produção pendente para a rodada 2 (deploy + navegar /painel, /equipe, /campanhas; confirmar que soluço do Supabase vira erro rápido/recarregável em vez de freeze de 300s).
files_changed: [src/lib/auth/session.ts, src/lib/supabase/proxy.ts, src/lib/db/index.ts, src/lib/utils/with-timeout.ts, src/app/(app)/error.tsx, src/app/(app)/*/page.tsx (22 páginas com maxDuration=25)]

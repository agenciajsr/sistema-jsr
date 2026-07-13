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

state: correções commitadas, aguardando verificação em produção pós-deploy.
commits:
  - fc2df99 fix(auth): memoizar getCurrentUser com React cache()
  - 72b2a15 fix(db): adicionar connect_timeout ao cliente postgres
  - 612b978 fix(app): adicionar maxDuration=30 nas paginas pesadas

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

## Resolution

root_cause: getCurrentUser() (src/lib/auth/session.ts) faz round-trip de rede via supabase.auth.getUser() a cada chamada, e é invocado ~6x por carga de página (layout + cada server action no Promise.all). Sem memoização, isso multiplica a latência de auth. Combinado com postgres-js max:3 sem connect_timeout, em cold start / DB acordando as chamadas empilham e estouram o timeout serverless da Vercel (504).
fix: 1) getCurrentUser envolvido em React cache() — dedupe por request colapsa ~6 getUser() para 1. 2) connect_timeout:10 adicionado ao cliente postgres — falha rápido em vez de travar ~30s. 3) export const maxDuration=30 nas páginas financeiro/relatorios/agenda como rede de segurança.
verification: npx tsc --noEmit passou com exit 0 (sem erros de tipo). Verificação em produção pendente (deploy + navegar /financeiro, /relatorios, /agenda).
files_changed: [src/lib/auth/session.ts, src/lib/db/index.ts, src/app/(app)/financeiro/page.tsx, src/app/(app)/relatorios/page.tsx, src/app/(app)/agenda/page.tsx]

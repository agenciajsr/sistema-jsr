---
phase: quick-260711-tg5
plan: 01
subsystem: ficha-cliente
tags: [ficha, cobranca, checklist, acompanhamento, contas-anuncio, alertas, drizzle-migration]
requires:
  - clientes/contratos/transacoes/adAccounts/campaignInsights (schema existente)
  - getResumoCliente (src/lib/trafego/aggregate.ts)
  - getContasNaoVinculadas / vincularContaAoCliente (src/actions/trafego.ts)
  - getAlertas (src/actions/alertas.ts)
  - getCurrentUser (src/lib/auth/session.ts)
provides:
  - tabelas checklist_items e acompanhamentos
  - coluna clientes.usa_asaas + enum frequencia_checklist
  - actions checklist (get/add/toggle/delete)
  - actions acompanhamento (get/add)
  - actions financeiro (getCobrancasDoCliente, updateTransacaoStatus, createCobranca, setUsaAsaas)
  - action trafego getContasDoCliente
  - action alertas getAlertasDoCliente
  - Ficha do cliente 100% em dados reais
affects:
  - src/app/(app)/clientes/[id]/page.tsx
  - src/actions/financeiro.ts, trafego.ts, alertas.ts
tech-stack:
  added: []
  patterns:
    - "Migration Drizzle TRIMADA manualmente: generate cru + remover objetos ja existentes no banco (snapshot dessincronizado)"
    - "Client components persistentes com useTransition + router.refresh() + toast (sonner)"
    - "KPIs derivados de dados reais no Server Component com Promise.all"
key-files:
  created:
    - src/actions/checklist.ts
    - src/actions/acompanhamento.ts
    - src/components/ficha/acompanhamento-form.tsx
    - src/components/ficha/cobranca-cliente.tsx
    - src/components/ficha/vincular-conta-ficha.tsx
    - drizzle/0001_short_vindicator.sql
  modified:
    - src/lib/db/schema.ts
    - src/actions/financeiro.ts
    - src/actions/trafego.ts
    - src/actions/alertas.ts
    - src/components/ficha/checklist-cliente.tsx
    - src/app/(app)/clientes/[id]/page.tsx
decisions:
  - "Migration 0001 gerada e TRIMADA para conter apenas objetos novos (checklist_items, acompanhamentos, usa_asaas, frequencia_checklist); NAO aplicada — orquestrador aplica depois"
  - "usa_asaas com default false para ser aditiva segura em linhas existentes"
  - "Proxima cobranca (KPI) = nao-paga futura mais proxima; fallback para nao-paga mais recente"
  - "Status da conta (KPI) derivado da primeira conta vinculada: 1=Ativa, 2/3=Com restricao, demais=Inativa"
metrics:
  duration: 10min
  completed: 2026-07-12
---

# Phase quick-260711-tg5 Plan 01: Ficha do Cliente Real Summary

Religada a Ficha do Cliente (`/clientes/[id]`) — antes 100% alimentada por `getMockDaFicha` — a dados reais do banco, tornando cobrança, contas de anúncio, checklist e acompanhamento funcionais e persistidos, e passando a exibir os alertas do cliente. Preservado integralmente o layout premium de abas e todo o comportamento real já existente (contrato, exclusões admin-only com AlertDialog).

## What Was Built

- **Schema + migration aditiva:** enum `frequencia_checklist`, tabelas `checklist_items` e `acompanhamentos`, coluna `clientes.usa_asaas` (default false). Migration `0001_short_vindicator.sql` gerada via `drizzle-kit generate` e trimada manualmente para conter apenas os objetos novos (o snapshot estava dessincronizado e o generate cru reincluía `ad_accounts`/`campaign_insights`/enum `plataforma` que já existem no banco). **Não aplicada** — deixada commitada para o orquestrador aplicar de forma controlada.
- **Server actions novas:** `checklist.ts` (get/add/toggle/delete) e `acompanhamento.ts` (get/add com autor = usuário logado), ambas com guard de sessão e `revalidatePath` da ficha.
- **Server actions estendidas:** `financeiro.ts` ganhou `getCobrancasDoCliente`, `updateTransacaoStatus`, `createCobranca`, `setUsaAsaas`; `trafego.ts` ganhou `getContasDoCliente` e passou a revalidar a ficha ao vincular conta; `alertas.ts` ganhou `getAlertasDoCliente` (filtra por clienteId).
- **Componentes client persistentes:** `checklist-cliente.tsx` reescrito para persistir; novos `acompanhamento-form.tsx`, `cobranca-cliente.tsx` (status editável, toggle Asaas, adicionar cobrança) e `vincular-conta-ficha.tsx`.
- **Página religada:** KPIs reais (MRR do contrato, próxima cobrança, verba 30 dias via `getResumoCliente`, status da conta), faixa de alertas por severidade, e as 4 abas alimentadas por dados reais. Removidos `getMockDaFicha` e todos os `MockNotice`.

## Deviations from Plan

None - plan executado exatamente como escrito.

Observação operacional (não é desvio de plano): o worktree deste agente estava baseado em um commit anterior ao trabalho `sv1` (Campanhas Parte 1). Foi feito `git merge --ff-only master` (fast-forward limpo, sem divergência) para trazer `src/lib/trafego/aggregate.ts` e o `trafego.ts` atualizado, dependências diretas deste plano. O diretório do plano tg5 não existia no worktree e foi copiado do checkout principal para acomodar PLAN.md + SUMMARY.md.

## Verification

- `npx tsc --noEmit`: limpo após cada task e no final.
- `npm run build`: `✓ Compiled successfully`; rota `/clientes/[id]` é dinâmica (ƒ), não pré-renderiza — passa mesmo sem as tabelas novas existirem no banco.
- `npm run lint`: 5 problemas (3 errors, 2 warnings), TODOS em arquivos pré-existentes e fora de escopo, nenhum nos arquivos deste plano:
  - errors: `ui/sidebar.tsx`, `hooks/use-mobile.ts`, `lib/inngest/functions/sync-meta-ads.ts` (any) — conhecidos toleráveis.
  - warnings: `app/(app)/alertas/page.tsx` (import `Alerta` não usado) e `app/(app)/financeiro/transacao-form.tsx` (React Compiler skip) — pré-existentes, arquivos não tocados por este plano.
- `drizzle/0001_*.sql`: aditivo (CREATE TYPE/TABLE + ADD COLUMN), sem `ad_accounts`/`campaign_insights`, não aplicado.
- `page.tsx` não referencia mais `getMockDaFicha` nem `MockNotice`.

## Known Stubs

None. Toda a ficha passou a consumir dados reais do banco. O arquivo `src/lib/mock/ficha-cliente.ts` continua existindo mas não é mais importado pela ficha (as rotas soltas `/checklist` e `/acompanhamento` seguem fora de escopo, conforme o plano).

## Commits

- bd371e0 feat(quick-260711-tg5): schema + migration aditiva (checklist, acompanhamentos, usa_asaas)
- 4ece20d feat(quick-260711-tg5): server actions de checklist e acompanhamento
- 17adc66 feat(quick-260711-tg5): actions de cobranca, contas e alertas do cliente
- 2b98bd7 feat(quick-260711-tg5): componentes client persistentes da ficha
- 6402a23 feat(quick-260711-tg5): religar ficha do cliente a dados reais (sem mock)

## Self-Check: PASSED

Todos os 6 arquivos-artefato confirmados no disco e os 5 commits de task confirmados no histórico git.

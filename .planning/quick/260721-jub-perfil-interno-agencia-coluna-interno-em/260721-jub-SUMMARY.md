---
quick_id: 260721-jub
title: Perfil interno (agência / perfil mãe) — ver campanhas da conta da agência
date: 2026-07-21
status: complete
---

# Quick Task 260721-jub — Summary

## Objetivo

Permitir ver as campanhas da conta de anúncio da PRÓPRIA agência (que não pertence
a nenhum cliente), reusando toda a máquina de tráfego, sem poluir as métricas do
negócio. Solução escolhida com o usuário: **cliente interno flagueado** ("perfil mãe").

## O que foi feito

**Schema / migration (0040 — aplicada em produção)**
- `clientes.interno boolean not null default false`.
- `drizzle/0040_cliente_interno.sql` + `scripts/aplicar-migration-0040.ts`.
- ⚠️ `clientes` é tabela quente: o ADD COLUMN (ACCESS EXCLUSIVE) disputava lock com
  SELECTs vivos. Uma sessão serverless TRAVADA (SELECT pendurado em ClientRead há
  ~13min, só AccessShareLock) bloqueava o DDL — diagnosticado via pg_locks +
  pg_stat_activity e resolvido com `pg_terminate_backend(pid)` (leitura morta, sem
  escrita). Coluna aplicada em seguida.

**UI / entrada de dados**
- Zod (`validations/cliente.ts`): `interno: z.boolean().default(false)`.
- `cliente-form.tsx`: checkbox "Cliente interno (a própria agência)" nos dois modos
  (criar/editar). Flui pelo `clienteParaDb` existente (`...data`) → actions NÃO
  precisaram mudar.

**Exclusão das métricas de negócio (interno some)**
- `clientes/lista.ts` — lista de clientes.
- `dashboard/data.ts` — contagem de ativos, novos clientes do mês, atividade
  recente (novos clientes) e tabela de performance (filtro no consumidor).
- `actions/financeiro.ts` — LTV/churn (getVisaoExecutiva), CAC (getCacAquisicao) e
  contagem de ativos da visão executiva.

**Mantido VISÍVEL no tráfego (é o que o usuário quer ver)**
- `listarClientesComContas` (aggregate.ts) passou a EXPOR `interno` em vez de
  filtrar — senão a agência sumiria do `/campanhas` (que usa essa função). O
  dashboard filtra no consumidor; o /campanhas e a avaliação de saúde continuam
  mostrando a agência.

**Seed (aplicado em produção)**
- `scripts/seed-perfil-interno.ts` (idempotente): criou o cliente "JSR (Agência)"
  (interno=true) e vinculou a única conta Meta sem cliente ("CA - 001 Agencia JSR",
  meta_account_id 771961185392829). Só toca contas com cliente_id NULL.

## Verificação

- `npx tsc --noEmit` → No errors found.
- `vitest run` (financeiro/cac + trafego) → PASS 104 / FAIL 0.
- Conferência no banco: 6 clientes na lista do negócio (agência NÃO conta);
  "JSR (Agência)" com interno=true; aparece no join de tráfego (conta Meta ativa)
  junto com os 5 clientes reais que têm conta.

## Notas / não incluído (baixa relevância)

- `campanhasResult` do dashboard (contadores soft "campanhas ativas" / "em N
  clientes") ainda inclui a conta da agência. É contagem de campanhas ativas —
  incluir a agência é discutível, mas de baixa visibilidade. Deixado como está;
  pode ser filtrado depois se incomodar.
- nicho do perfil interno: 'negocio_local' (arbitrário; irrelevante pois fica fora
  das métricas). Objetivo/metas do tráfego podem ser ajustados na ficha se quiser.

---
phase: quick-260714-ccl
plan: 01
subsystem: alertas-e-relatorios
tags: [alertas, relatorios, cron, vercel-cron, drizzle, persistencia]
requires:
  - Motor de avaliação de alertas existente (avaliadores puros + getAlertasCampanhas)
  - Gerador de relatório existente (gerarRelatorioCliente)
  - Cron diário /api/cron/sync-meta (Vercel Cron)
provides:
  - Tabelas `alertas` (dedup + ciclo novo/lido/resolvido) e `relatorios` (histórico) — migration 0013 NÃO aplicada
  - avaliarEPersistirAlertas() rodando automaticamente no cron diário
  - Cron semanal /api/cron/relatorios-semanais (segunda 07h BR)
  - UI de triagem em /alertas (abas por status) e Histórico em /relatorios
affects:
  - Dashboard (alertas-importantes) e Chat IA passam a ler alertas do banco (mesmo contrato)
  - Sininho do header conta só alertas com status 'novo'
tech-stack:
  added: []
  patterns:
    - Cron protegido por CRON_SECRET com try/catch isolado por etapa/cliente
    - Dedup por chave lógica estável (id do avaliador → coluna chave_dedup única)
key-files:
  created:
    - src/lib/alertas/calcular.ts
    - src/lib/alertas/persistir.ts
    - src/app/api/cron/relatorios-semanais/route.ts
    - drizzle/0013_sudden_sharon_carter.sql
  modified:
    - src/lib/db/schema.ts
    - src/actions/alertas.ts
    - src/lib/alertas/types.ts
    - src/app/(app)/alertas/page.tsx
    - src/app/(app)/alertas/alertas-client.tsx
    - src/components/layout/alertas-bell.tsx
    - src/app/api/cron/sync-meta/route.ts
    - src/actions/relatorios.ts
    - src/app/(app)/relatorios/relatorios-content.tsx
    - src/app/api/inngest/route.ts
    - vercel.json
decisions:
  - "Identidade do alerta = chaveDedup (o id estável que os avaliadores já produzem) com uniqueIndex — uma linha por problema, ciclo novo→lido→resolvido com reabertura automática"
  - "Persistência via select+branch (não onConflictDoUpdate) — a regra 'preservar status quando aberto / reabrir quando resolvido' fica explícita e legível"
  - "Colunas tipo/severidade/status como text (não pgEnum) — novos tipos de alerta não exigem migration"
  - "Relatórios semanais migrados do Inngest (nunca rodou em prod) para Vercel Cron — 2º cron do plano Hobby (segunda 10h UTC = 07h BR)"
metrics:
  duration: ~20min
  completed: 2026-07-14
---

# Quick Task 260714-ccl: Acordar Alertas Proativos + Relatório Semanal Automático — Summary

**Alertas persistidos com dedup/ciclo de vida alimentados pelo cron diário do sync-meta, e relatórios semanais gerados por um 2º Vercel Cron (segunda 07h BR) com histórico em /relatorios.**

## O que foi feito

### Tarefa 1 — Tabelas + motor de persistência + gancho no cron (commit 13ea635)
- Tabelas `alertas` (chave_dedup única, status novo/lido/resolvido, detectado_em/resolvido_em, index em status) e `relatorios` (histórico com clienteNome denormalizado) no schema Drizzle, com relations.
- `src/lib/alertas/calcular.ts`: `calcularAlertasAtuais()` — orquestração extraída de `getAlertas()` SEM checagem de sessão (recorte e cola, zero mudança de regra de negócio).
- `src/lib/alertas/persistir.ts`: `avaliarEPersistirAlertas()` — INSERT de chaves novas ('novo'), UPDATE preservando status quando aberto, REABERTURA quando resolvido volta, e resolução automática (`UPDATE ... WHERE status != 'resolvido' AND chave NOT IN (...)`). Retorna `{ novos, atualizados, reabertos, resolvidos }`.
- Cron `/api/cron/sync-meta` chama a avaliação após o sync, em try/catch PRÓPRIO — falha nos alertas não quebra a resposta do sync; resumo incluído no JSON quando dá certo.
- Migration `drizzle/0013_sudden_sharon_carter.sql` gerada via `npx drizzle-kit generate` — **100% aditiva** (2 CREATE TABLE, 2 FKs, 3 índices, nenhum DROP/ALTER em tabela existente). **NÃO aplicada ao banco** — o orquestrador aplica depois.

### Tarefa 2 — /alertas lê do banco + sininho (commit 3c771aa)
- Tipos novos: `StatusAlerta` e `AlertaPersistido extends Alerta` (dbId, status, detectadoEm, resolvidoEm) — `Alerta` intacto.
- `src/actions/alertas.ts` reescrito: `getAlertas()`/`getAlertasDoCliente()` mantêm assinatura e shape (id = chaveDedup, clienteId `''` quando nulo) mas leem da tabela; novas actions `listarAlertasPersistidos` (limit 200, abertos por severidade + resolvidos por resolvidoEm desc), `getContagemAlertasNovos` (count barato), `marcarAlertaComoLido`, `marcarTodosComoLidos` e `reavaliarAlertasAgora` (cobre a tabela vazia no primeiro deploy).
- UI `/alertas`: abas Novos/Lidos/Resolvidos com contagem, "Marcar como lido" por card (useTransition), "Marcar todos como lidos", botão "Reavaliar agora" (RefreshCw + router.refresh), badge "Resolvido em {data}" pt-BR. Todo o mecanismo de localStorage removido. Visual premium preservado (TIPO_ICON/TIPO_LABEL/SEVERIDADE_CONFIG intactos).
- Sininho do header: `getContagemAlertasNovos()` no lugar de `getAlertas().length` (padrão useEffect pós-render com catch → 0 mantido).
- Dashboard (`alertas-importantes.tsx`), Chat IA (`copilot.ts`) e ficha do cliente compilam sem mudanças.

### Tarefa 3 — Cron de relatórios semanais + histórico (commit fef9b4c)
- `/api/cron/relatorios-semanais`: mesmo padrão do sync-meta (runtime nodejs, maxDuration 60, Bearer CRON_SECRET com warn se ausente). Período explícito `dataMenosDias(7)` → `dataMenosDias(1)` (segunda→domingo anteriores). Seleção de clientes ativos com conta Meta ativa direto no banco (sem sessão). Try/catch por cliente — erro em um não interrompe os demais. Response `{ ok, periodo, total, gerados, semDados, erros }`.
- `vercel.json`: 2 crons — sync-meta `0 9 * * *` e relatorios-semanais `0 10 * * 1` (limite do Hobby respeitado).
- `gerarRelatorio()` e `gerarRelatoriosEmLote()` passam a gravar histórico tipo 'manual' via helper `persistirRelatorioManual` (try/catch próprio — falha ao salvar não impede devolver o relatório).
- Nova action `listarHistoricoRelatorios()` (limit 50, desc) + seção "Histórico" em /relatorios: badge Semanal/Manual, período dd/mm → dd/mm, gerado em pt-BR, copiar com feedback "Copiado!", expandir/recolher; recarrega após geração manual. Estado vazio: "Nenhum relatório salvo ainda — os relatórios de segunda-feira aparecem aqui automaticamente."
- `src/app/api/inngest/route.ts`: `gerarRelatoriosSemanais` removida do `serve()` (arquivo em src/lib/inngest/ mantido, `syncMetaAds` intocado).

## Deviations from Plan

Nenhum desvio de implementação — plano executado como escrito. Duas notas de execução:

1. **Verificação da Tarefa 1:** o `grep -L "DROP"` do plano retorna exit code 1 nesta versão do grep mesmo no resultado desejado (arquivo listado = sem DROP). O critério real (migration sem DROP) foi confirmado por inspeção do .sql.
2. **Verificação da Tarefa 3:** o comentário inicial em `src/app/api/inngest/route.ts` citava o nome literal da função removida, quebrando o `! grep -q "gerarRelatoriosSemanais"`. Comentário reformulado sem o nome literal.

## Pendências para o orquestrador

- **Aplicar a migration 0013** (`drizzle/0013_sudden_sharon_carter.sql`) no banco — puramente aditiva.
- Após o deploy, a tabela `alertas` fica vazia até o cron rodar (ou até alguém clicar em "Reavaliar agora" em /alertas).

## Known Stubs

Nenhum — todos os fluxos estão ligados a dados reais.

## Commits

| Tarefa | Commit | Descrição |
| ------ | ------- | --------- |
| 1 | 13ea635 | Tabelas alertas/relatorios + motor de persistência + gancho no cron sync-meta + migration 0013 |
| 2 | 3c771aa | /alertas lê do banco (abas, marcar como lido, reavaliar) + sininho conta status novo |
| 3 | fef9b4c | Cron relatorios-semanais + histórico persistido + Inngest morto aposentado |

## Verificação final

- `npx tsc --noEmit` ✅
- `npm run build` ✅ (rotas `/api/cron/relatorios-semanais` e `/alertas` compilam)
- Migration 0013 aditiva, NÃO aplicada ✅
- `vercel.json` com exatamente 2 crons ✅
- Zero `localStorage` em alertas-client.tsx ✅
- `getAlertas()` mantém `Promise<Alerta[]>` — consumidores intactos ✅

## Self-Check: PASSED

Todos os arquivos criados existem e os 3 commits (13ea635, 3c771aa, fef9b4c) estão no histórico.

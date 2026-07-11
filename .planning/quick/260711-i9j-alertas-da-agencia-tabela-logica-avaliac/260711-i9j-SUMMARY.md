---
phase: quick-260711-i9j
plan: "01"
subsystem: alertas
tags: [alertas, server-action, contratos, transacoes, clientes, dashboard]
dependency_graph:
  requires: [contratos-table, transacoes-table, clientes-table, auth-session]
  provides: [getAlertas-action, alertas-page-real, dashboard-alertas-real]
  affects: [painel-page, alertas-page]
tech_stack:
  added: []
  patterns: [derived-alerts, pure-evaluation-functions, severity-ordering]
key_files:
  created:
    - src/lib/alertas/types.ts
    - src/lib/alertas/avaliar.ts
    - src/actions/alertas.ts
  modified:
    - src/app/(app)/alertas/page.tsx
    - src/components/dashboard/alertas-importantes.tsx
decisions:
  - AlertasImportantes como Client Component (useEffect + getAlertas) porque painel/page.tsx e 'use client'
  - Threshold R$1000 para transacao vencida critico vs atencao
  - Dois queries separados para clientes pausados/encerrados (pgEnum nao suporta IN facilmente no Drizzle)
metrics:
  duration: 3min
  completed: "2026-07-11T16:15:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Quick 260711-i9j: Alertas da agencia (derivados, sem tabela extra)

Alertas reais derivados on-demand de contratos, transacoes e clientes do banco — sem tabela extra, sem cron. Server Action getAlertas() com funcoes puras de avaliacao e severidade ordenada.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Tipos + logica de avaliacao de alertas | 5e9153f | types.ts, avaliar.ts |
| 2 | Server Action + tela /alertas + dashboard real | fa8a3ca | alertas.ts, page.tsx, alertas-importantes.tsx |

## What Was Built

1. **Tipos** (`src/lib/alertas/types.ts`): TipoAlerta, SeveridadeAlerta, interface Alerta, SEVERIDADE_ORDEM
2. **Funcoes puras** (`src/lib/alertas/avaliar.ts`): avaliarContratos (<=7d/expirado=critico, <=15d=atencao, <=30d=info), avaliarTransacoes (vencido >=R$1000=critico, senao atencao), avaliarClientesInativos (pausado/encerrado=info), ordenarPorSeveridade
3. **Server Action** (`src/actions/alertas.ts`): getAlertas() consulta 3 tabelas, aplica avaliacao, retorna lista unificada ordenada por severidade
4. **Tela /alertas** (`src/app/(app)/alertas/page.tsx`): Server Component async, badges coloridas (vermelho/amber/azul), icones por tipo, estado vazio com CheckCircle
5. **Dashboard** (`src/components/dashboard/alertas-importantes.tsx`): Client Component com useEffect chamando getAlertas(), mostra top 4 alertas reais com links contextuais

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AlertasImportantes convertido para Client Component**
- **Found during:** Task 2
- **Issue:** O painel/page.tsx e 'use client', entao um componente filho async Server Component nao funciona
- **Fix:** Convertido AlertasImportantes para Client Component com useEffect + useState chamando getAlertas() diretamente
- **Files modified:** src/components/dashboard/alertas-importantes.tsx

**2. [Rule 3 - Blocking] Queries separadas para clientes pausados e encerrados**
- **Found during:** Task 2
- **Issue:** Drizzle com pgEnum nao suporta operador IN de forma simples; `inArray` com valores de enum e problematico
- **Fix:** Duas queries separadas (eq status pausado + eq status encerrado) concatenadas
- **Files modified:** src/actions/alertas.ts

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| AlertasImportantes como Client Component | Painel page.tsx e 'use client' — componentes filhos nao podem ser async Server Components |
| Threshold R$1000 para transacao critica | Valor razoavel para distinguir pagamentos urgentes de menores |
| Sem lower bound na query de contratos | Mostra todos os contratos ja vencidos (sem data minima), nao apenas os proximos |

## Verification

- `tsc --noEmit`: zero erros
- `next build`: build completo sem falhas
- /alertas renderiza dados reais do banco (ou estado vazio)
- Dashboard alertas-importantes consome getAlertas() em vez de mock

## Known Stubs

Nenhum — todos os dados vem do banco real.

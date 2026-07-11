---
phase: quick
plan: 260710-u8b
subsystem: ui-navegacao-painel
tags: [redesign, navegacao, painel, ui, mock]
requires:
  - StatCard (src/components/stat-card.tsx)
  - MockNotice (src/components/mock-notice.tsx)
  - ChartContainer/ChartTooltip (src/components/ui/chart.tsx)
  - mock de dashboard (src/lib/mock/dashboard.ts)
provides:
  - Navegação de 6 áreas de topo + Usuários admin-only
  - Sino de alertas no header com badge de contagem
  - Painel redesenhado (KPIs, alertas por severidade, saúde das contas, gráfico de barras)
  - Tokens de fundo suave por severidade (light + dark)
  - Mock estendido (status de 3 níveis, nº de contas, verba diária)
affects:
  - src/app/(app)/trafego/page.tsx (consome contaStatus — segue compilando via ternário)
tech-stack:
  added: []
  patterns:
    - recharts BarChart via shadcn ChartContainer/ChartTooltip
    - tokens de cor semântica registrados em @theme inline
key-files:
  created:
    - .planning/quick/260710-u8b-redesenho-visual-e-reorganizacao-da-nave/deferred-items.md
  modified:
    - src/components/app-sidebar.tsx
    - src/app/(app)/layout.tsx
    - src/lib/mock/dashboard.ts
    - src/app/globals.css
    - src/app/(app)/painel/page.tsx
decisions:
  - "Grupo único 'Principal' na sidebar (menu limpo), Administração/Usuários preservado sob isAdmin"
  - "Sino de alertas como Link direto para /alertas (sem dropdown), badge só quando há alertas"
  - "contaStatus ampliado para 3 níveis; trafego/page.tsx compila via ternário (atencao cai no ramo 'com problema') — ajuste visual dessa tela fica para incremento futuro"
metrics:
  duration: ~15min
  completed: 2026-07-10
---

# Quick 260710-u8b: Redesenho Visual e Reorganização da Navegação Summary

Incremento 1 do redesenho visual do Sistema JSR: navegação enxugada de 12 itens para 6 áreas de topo, Alertas movido para um sino no header, e Painel redesenhado com cor semântica, emojis nos títulos, KPIs, alertas por severidade, saúde das contas e gráfico de barras de verba.

## O que foi feito

### Task 1 — Navegação da sidebar + sino de alertas (commit 15b4563)
- `app-sidebar.tsx`: os três grupos (Clientes/Operação/Gestão) foram substituídos por um único grupo **Principal** com 6 áreas na ordem definida: Painel, Clientes, Tráfego & Performance, Financeiro da Agência, Relatórios, Funil. Grupo **Administração → Usuários** mantido sob `{isAdmin && ...}`. Imports lucide sem uso removidos (FileSignature, CircleDollarSign, ListChecks, Radar, Bell).
- Removidos do menu (rotas intactas): Contratos, Checklist, Acompanhamento, Verbas Ads, Alertas.
- `layout.tsx`: sino (Bell) à esquerda do bloco de usuário, linkando `/alertas`, com badge vermelho de contagem (`alertasMock.length`) exibido só quando > 0.

### Task 2 — Mock estendido + tokens de severidade (commit 75b155f)
- `dashboard.ts`: `contaStatus` agora `'ativa' | 'atencao' | 'problema'`; novo campo `contas: number` (Vitalis 2, Aurora 2, Cresce+ 1); Método Cresce+ passou para `atencao`. Novo export `verbaDiariaMock` (7 dias).
- `globals.css`: tokens `--alert-danger-soft`/`--alert-warning-soft` em `:root` e `.dark`, registrados em `@theme inline` como `bg-alert-danger-soft` / `bg-alert-warning-soft`.

### Task 3 — Painel redesenhado (commit b2a674a)
- `painel/page.tsx` reescrito como client component: saudação "Bom dia, JSR 👋" + resumo dinâmico; 4 KPIs (MRR Total, A receber 7 dias, Verba rodando, Contas com problema); bloco "🚩 Precisa de você hoje" com borda esquerda + fundo suave por severidade; "📊 Saúde das contas" com ponto de status de 3 cores e "N contas"; "📈 Verba dos últimos 7 dias" com BarChart recharts. MockNotice mantido.

## Deviations from Plan

Nenhuma. Plano executado exatamente como escrito.

## Deferred Issues

Dois erros de lint **pré-existentes** em arquivos gerados pelo shadcn, não tocados por esta task (confirmado via `git status`), documentados em `deferred-items.md`:
- `src/components/ui/sidebar.tsx:611` — Cannot call impure function during render
- `src/hooks/use-mobile.ts:14` — react-hooks/set-state-in-effect

Fora do escopo (SCOPE BOUNDARY): existem no baseline adb5efa e independem deste incremento.

## Known Stubs

O Painel continua alimentado por `src/lib/mock/dashboard.ts` (dados de exemplo), sinalizado ao usuário via `MockNotice`. Intencional: os dados reais chegam com a integração Meta/Google Ads (Fase 2) e o painel de tráfego (Fase 3). Não bloqueia o objetivo deste incremento (esqueleto de navegação + vitrine visual do Painel).

## Verification

- `npx tsc --noEmit`: sem erros em todo o projeto (telas que importam do mock seguem compilando).
- `npm run lint`: apenas os 2 erros pré-existentes acima; nenhum erro nos arquivos desta task.
- Sidebar: 6 áreas + Usuários (admin); rotas removidas do menu ainda acessíveis por URL.
- Header: sino com badge → /alertas.
- Painel: KPIs, alertas por severidade colorida, saúde das contas (3 cores), gráfico de barras.

## Self-Check: PASSED

Todos os arquivos criados/modificados e os 3 commits (15b4563, 75b155f, b2a674a) foram verificados no disco.

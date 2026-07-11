---
phase: quick-260711-ejq
plan: 01
subsystem: ui-design-system
tags: [design-system, premium, painel, mission-control, tokens]
requires:
  - Card/StatCard/Sidebar/Layout existentes
  - mocks de dashboard (src/lib/mock/dashboard.ts)
provides:
  - Tokens premium de gradiente e elevação (--gradient-brand, --gradient-surface, --shadow-xs/sm/md)
  - Card e StatCard elevados herdados por todas as telas
  - Primitivos ScoreRing e AiInsightCard
  - Painel reconstruído como Mission Control
affects:
  - Todas as telas que usam Card/StatCard herdam o novo tratamento premium
tech-stack:
  added: []
  patterns:
    - "Gradientes/sombras aplicados por CSS custom properties via bg-[image:var(--token)] / shadow-[var(--token)]"
    - "Anel de progresso em SVG puro (sem libs) com gradiente por faixa de score"
    - "Animações de entrada via tw-animate-css (animate-in fade-in)"
key-files:
  created:
    - src/components/premium/score-ring.tsx
    - src/components/premium/ai-insight-card.tsx
  modified:
    - src/app/globals.css
    - src/components/ui/card.tsx
    - src/components/stat-card.tsx
    - src/lib/mock/dashboard.ts
    - src/components/app-sidebar.tsx
    - src/app/(app)/layout.tsx
    - src/app/(app)/painel/page.tsx
decisions:
  - "Gradientes deliberadamente sutis (estilo Linear/Stripe); tema claro é o padrão e o .dark ganhou variação própria de gradientes/sombras"
  - "ScoreRing usa id de gradiente determinístico derivado das props (sem hooks), mantendo-o utilizável como server component"
  - "Cards do Painel deixaram de usar border-none shadow-sm para herdar o tratamento premium do Card base"
  - "Seletor de período no Painel é placeholder puramente visual (sem estado) até os filtros globais serem conectados"
metrics:
  duration: 9min
  tasks: 3
  files: 9
  completed: 2026-07-11
---

# Quick 260711-ejq: Elevar o Design ao Padrão Premium (incremento) Summary

Fundação de design system premium em tokens (gradientes suaves + elevação em camadas + raio maior), Card e StatCard elevados herdados por todas as telas, dois primitivos-assinatura (ScoreRing e AiInsightCard) e o Painel reconstruído como "Mission Control" com o hero Agency Health Score e o card de Insights da IA.

## O que foi feito

### Task 1 — Fundação de design system + Card/StatCard elevados
- `globals.css`: adicionados `--gradient-brand`, `--gradient-surface` e a escala `--shadow-xs/sm/md`; `--radius` subiu de 0.75rem para 0.9rem; hairline de borda mais sutil (`#e9eaee`) e `--muted-foreground` com contraste um pouco melhor. Todos os tokens existentes preservados; bloco `.dark` ganhou variação própria de gradientes e sombras.
- `card.tsx`: base elevada com sombra em camadas (`shadow-[var(--shadow-sm)]`), `border-border`, `py-7` e hover-lift discreto (`transition-shadow hover:shadow-[var(--shadow-md)]`). API/exports inalterados; overrides via `className` continuam funcionando.
- `stat-card.tsx`: número maior (`text-4xl tracking-tight`), chip do ícone com `ring` sutil por cor semântica, `p-6` e hover-lift. Props públicas inalteradas.

### Task 2 — Primitivos premium + refino do shell + mocks
- `score-ring.tsx` (novo): anel SVG 0-100 com gradiente por faixa de score (verde/azul/âmbar), `strokeLinecap="round"`, transição de `stroke-dashoffset` e centro com número + label/sublabel. Sem dependências novas.
- `ai-insight-card.tsx` (novo): card de Insights da IA com selo "IA", ícone Sparkles, superfície em `--gradient-surface` e animação de entrada `animate-in fade-in`.
- `dashboard.ts`: `agencyHealthMock` (score 78, 3 ativos, 1 em risco) e `insightsIaMock` (3 insights análise + ação, consistentes com os clientes existentes).
- `app-sidebar.tsx`: chip da marca JSR com `--gradient-brand` e mais respiro no header; nav de 6 áreas e grupo Administração intactos.
- `layout.tsx`: header sticky, mais alto (`h-16`), hairline + `backdrop-blur-md`; padding do `<main>` mais generoso (`p-6 lg:p-8`). Sino de alertas, avatar, Sair e lógica de auth intactos.

### Task 3 — Painel como Mission Control
- Hero "Saúde da Agência": Card com `--gradient-surface`, `ScoreRing` (score 78) à esquerda e 3 números de contexto (Receita do mês/MRR, Clientes ativos, Clientes em risco).
- Card de Insights da IA via `AiInsightCard` com `insightsIaMock`.
- Seletor de período placeholder (visual), faixa de 4 KPIs, bloco "Precisa de você hoje" com severidade colorida e grid "Saúde das contas" + gráfico de verba (recharts) — todos no tratamento premium. Cálculos derivados existentes preservados.

## Deviations from Plan

None - plan executed exactly as written. (Nota operacional: os arquivos foram editados na cópia de worktree isolada do agente; a PLAN.md foi copiada para o worktree para ficar versionada junto ao SUMMARY nesta branch.)

## Verification

- `npx tsc --noEmit`: limpo (exit 0) após cada task.
- `npm run lint`: apenas os 2 erros pré-existentes conhecidos (`src/components/ui/sidebar.tsx` — react-hooks/purity; `src/hooks/use-mobile.ts` — react-hooks/set-state-in-effect), ambos fora de escopo. Nenhum erro novo introduzido.
- Tema claro é o padrão; `.dark` recebeu variação própria de gradientes/sombras.

## Known Stubs

- Seletor de período no Painel ("Hoje / 7 dias / 30 dias") é placeholder puramente visual, sem lógica de filtro — intencional, conforme o plano; será conectado quando os filtros globais forem implementados.
- `AiInsightCard` exibe insights mockados (`insightsIaMock`) com selo "IA" deixando claro que é placeholder — a análise real de IA é escopo de fase futura.
- `agencyHealthMock` e demais mocks do dashboard permanecem dados de exemplo (Fases 2/3 conectam dados reais). O `MockNotice` no Painel comunica isso ao usuário.

## Commits

- c76f097: feat(quick-260711-ejq): fundação de design system premium + Card/StatCard elevados
- 69b9cc6: feat(quick-260711-ejq): primitivos premium (ScoreRing, AiInsightCard) + refino do shell
- 5fe4f19: feat(quick-260711-ejq): reconstruir Painel como Mission Control

## Self-Check: PASSED

Todos os arquivos criados/modificados existem e os 3 commits de task estão presentes na branch.

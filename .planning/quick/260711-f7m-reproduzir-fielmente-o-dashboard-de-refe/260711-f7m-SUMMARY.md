---
phase: quick-260711-f7m
plan: 01
subsystem: ui-dashboard
tags: [dashboard, ui, sidebar, kpi, recharts, placeholder-routes]
requires: [globals.css tokens, shadcn primitives, getCurrentUser, signOut]
provides:
  - src/lib/mock/dashboard-ref.ts (dados completos da referência)
  - src/components/dashboard/* (KpiCard, Sparkline, StatusBadge, PerformanceGeral, CampanhasSaude, AgendaHoje, ResumoFinanceiro, AlertasImportantes, AtividadeRecente, PerformanceClienteTable, AiInsightFloat)
  - src/components/premium/{plan-card,user-profile}.tsx
  - src/components/em-breve.tsx
  - Painel remontado + 7 rotas placeholder
affects: [src/app/(app)/layout.tsx, src/components/app-sidebar.tsx, src/app/(app)/painel/page.tsx]
tech-stack:
  added: []
  patterns:
    - "Mock tipado dedicado (dashboard-ref.ts) sem tocar em dashboard.ts legado"
    - "Perfil do usuário no rodapé da sidebar (não no header)"
    - "Tokens de cor semânticos roxo/WhatsApp via @theme inline (light+dark)"
key-files:
  created:
    - src/lib/mock/dashboard-ref.ts
    - src/components/dashboard/status-badge.tsx
    - src/components/dashboard/sparkline.tsx
    - src/components/dashboard/kpi-card.tsx
    - src/components/dashboard/performance-geral.tsx
    - src/components/dashboard/campanhas-saude.tsx
    - src/components/dashboard/agenda-hoje.tsx
    - src/components/dashboard/resumo-financeiro.tsx
    - src/components/dashboard/alertas-importantes.tsx
    - src/components/dashboard/atividade-recente.tsx
    - src/components/dashboard/performance-cliente-table.tsx
    - src/components/dashboard/ai-insight-float.tsx
    - src/components/premium/plan-card.tsx
    - src/components/premium/user-profile.tsx
    - src/components/em-breve.tsx
    - src/app/(app)/campanhas/page.tsx
    - src/app/(app)/tarefas/page.tsx
    - src/app/(app)/documentos/page.tsx
    - src/app/(app)/equipe/page.tsx
    - src/app/(app)/ferramentas/page.tsx
    - src/app/(app)/integracoes/page.tsx
    - src/app/(app)/chat-ia/page.tsx
  modified:
    - src/app/globals.css
    - src/components/app-sidebar.tsx
    - src/app/(app)/layout.tsx
    - src/app/(app)/painel/page.tsx
decisions:
  - "Perfil do usuário movido do header global para o rodapé da sidebar (fidelidade à referência); logout permanece acessível via dropdown do perfil"
  - "Header global vira barra enxuta (busca ⌘K, sino, mensagens, botão Novo cliente); saudação + filtros de cliente/período vivem dentro da página do Painel"
  - "dashboard-ref.ts é um mock novo e separado — dashboard.ts legado permanece intacto para as outras telas"
  - "cargo derivado do role (admin→Administrador, membro→Membro) já que getCurrentUser não expõe cargo"
metrics:
  duration: 9min
  tasks: 6
  files: 26
  completed: 2026-07-11
---

# Phase quick-260711-f7m Plan 01: Reprodução fiel do dashboard de referência Summary

Reprodução de alta fidelidade do dashboard de referência aprovado por Jacson: sidebar completa (nav da referência + card de plano + perfil no rodapé com ponto verde), top bar enxuta, header do painel com saudação e filtros, faixa de 6 KPIs com valores exatos, três painéis na linha do meio, três na de baixo, tabela Performance por Cliente, card flutuante de Insights da IA (navy, fechável) e 7 rotas placeholder "em breve" — tudo com componentes reutilizáveis, sem novas dependências e sem framer-motion.

## O que foi construído

- **Task 1 — Tokens + mock:** `--chart-purple` e `--chart-whatsapp` (light+dark) mapeados em `@theme inline`; `dashboard-ref.ts` com todos os dados tipados da referência (KPIs, performance geral, saúde de campanhas, agenda, resumo financeiro, alertas, atividades, tabela, texto da IA, plano, perfil e contadores).
- **Task 2 — Primitivos + rotas:** `StatusBadge` (tonalizado por nível), `Sparkline` (recharts sem eixos), `KpiCard` (ícone colorido + tendência + mini-visual), `EmBreve` (placeholder premium) e 7 páginas placeholder (`/campanhas`, `/tarefas`, `/documentos`, `/equipe`, `/ferramentas`, `/integracoes`, `/chat-ia`).
- **Task 3 — Sidebar + top bar:** nav completa da referência com item ativo destacado e badge "Beta" no Chat com IA, `PlanCard` e `UserProfile` no rodapé; header global reduzido a busca/sino/mensagens/Novo cliente; perfil e logout migrados para o rodapé da sidebar.
- **Task 4 — Linha do meio:** `PerformanceGeral` (seletor de cliente, 4 métricas, gráfico de linha, 5 mini-métricas), `CampanhasSaude` (lista com `StatusBadge`), `AgendaHoje` (timeline com borda colorida).
- **Task 5 — Linha de baixo + tabela:** `ResumoFinanceiro` (barras receita/despesa + mini-gráfico de lucro), `AlertasImportantes` (ícone por severidade + link), `AtividadeRecente` (feed por tipo), `PerformanceClienteTable` (4 linhas, scroll horizontal).
- **Task 6 — IA + montagem:** `AiInsightFloat` (navy, fechável no x) e `painel/page.tsx` remontado com header, 6 KPIs, painéis e tabela em grids responsivos que colapsam para 1 coluna.

## Decisões

- Perfil do usuário movido para o **rodapé da sidebar** (como na referência); logout continua acessível pelo dropdown do perfil. Header global passa a ser uma barra enxuta.
- **Mock separado** (`dashboard-ref.ts`) — `dashboard.ts` legado permanece intacto e ainda alimenta as outras telas.
- `cargo` derivado do `role` no layout, já que `getCurrentUser` não expõe cargo.

## Deviations from Plan

None - plan executado exatamente como escrito (Tasks 1-6). A Task 7 é um checkpoint de verificação visual humana e permanece pendente de aprovação do usuário.

## Known Stubs

Todos intencionais e documentados (dados de exemplo até as integrações da Fase 2):

- `src/lib/mock/dashboard-ref.ts` — dados de exemplo do dashboard; a tela exibe `<MockNotice>` avisando que os números reais chegam com a integração Meta/Google Ads (Fase 2) e o financeiro. Substituição prevista nas fases correspondentes do roadmap.
- 7 rotas placeholder (`/campanhas`, `/tarefas`, `/documentos`, `/equipe`, `/ferramentas`, `/integracoes`, `/chat-ia`) renderizam `<EmBreve>` — intencional, para eliminar 404 na nav da referência. Serão implementadas em fases futuras.
- Filtros/seletores (cliente, período, busca ⌘K) são placeholders visuais sem lógica de dados ainda.

## Verification

- `npx tsc --noEmit`: limpo (exit 0) em todas as tasks.
- `npm run lint`: apenas os 2 erros pré-existentes conhecidos (`ui/sidebar.tsx` react-hooks/purity e `hooks/use-mobile.ts` set-state-in-effect) — fora de escopo, sem regressões novas.
- Nenhuma dependência nova; `package.json` inalterado; sem framer-motion.

## Commits

- ef65c75 — feat: tokens roxo/WhatsApp + mock completo
- 5defd47 — feat: primitivos + 7 rotas placeholder
- 61d2b02 — feat: sidebar completa + top bar enxuta
- 5a0f2ce — feat: painéis da linha do meio
- 91f3c80 — feat: linha de baixo + tabela por cliente
- d1d86ed — feat: card flutuante de IA + montagem final do Painel

## Próximo passo

Task 7 (checkpoint human-verify): rodar `npm run dev`, abrir `/painel` logado e comparar lado a lado com a imagem de referência. Responder "aprovado" ou listar ajustes de fidelidade.

## Self-Check: PASSED

Todos os arquivos criados e os 6 commits de task foram verificados no disco/histórico.

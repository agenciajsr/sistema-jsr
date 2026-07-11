---
phase: quick-260711-hik
plan: 01
subsystem: dashboard/ia
tags: [ai, streaming, openai, dashboard, insights]
dependency_graph:
  requires: [quick-260711-gi1]
  provides: [insights-proativos-dashboard]
  affects: [src/components/dashboard/ai-insight-float.tsx]
tech_stack:
  added: []
  patterns: [fetch-readable-stream-reader, server-only-api-key, graceful-degradation, auth-gate]
key_files:
  created:
    - src/app/api/insights/route.ts
  modified:
    - src/components/dashboard/ai-insight-float.tsx
decisions:
  - "GET em vez de POST em /api/insights — não há body do usuário, insight é gerado internamente"
  - "Prompt interno fixo no servidor — 'top 3 insights mais prioritários para hoje', nunca vindo do client"
  - "Fallback silencioso com aiInsightMock.texto — sem crash, sem mensagem de erro visível ao usuário"
  - "Link wrapper em torno do Button para navegação para /chat-ia (Button não tem href nativo no shadcn)"
metrics:
  duration: 10min
  completed: "2026-07-11"
  tasks: 2
  files: 2
---

# Phase quick-260711-hik Plan 01: Insights Automáticos no Dashboard via IA — Summary

**One-liner:** Rota GET /api/insights com streamText + AiInsightFloat consumindo stream via fetch+ReadableStream reader, com fallback silencioso para aiInsightMock.

## What Was Built

Card de Insights da IA do dashboard deixou de ser decorativo (texto mock fixo) e passou a buscar conteúdo gerado pela OpenAI em tempo real ao carregar o dashboard.

**Rota `GET /api/insights`** (novo arquivo):
- Auth gate com `getCurrentUser()` — 401 sem sessão, antes de qualquer chamada à OpenAI
- Sem `OPENAI_API_KEY`: resposta de texto amigável em pt-BR, nunca 500
- Com chave: `streamText` usando `buildSystemMessage()` do copilot.ts + mensagem interna pedindo top 3 insights do dia
- `result.toTextStreamResponse()` — mesmo padrão do `/api/chat`
- `runtime = 'nodejs'` no topo

**Componente `AiInsightFloat`** (atualizado):
- `useEffect` ao montar: `fetch('/api/insights')` + `res.body.getReader()` + `decoder.decode(value, { stream: true })`
- Estado `carregando: true` inicial → exibe `"Analisando dados da agência..."` em itálico esmaecido
- Texto acumulado chunk a chunk via `setTexto(acumulado)` durante o stream
- Flag `cancelado` previne `setState` após desmontagem
- Fallback silencioso: `!res.ok || !res.body` ou `catch` → `setTexto(aiInsightMock.texto)`
- Botão "Ver análise completa" envolto em `<Link href="/chat-ia">` (navegação para o chat)
- Visual do card 100% inalterado: mesmas classes, gradiente, ícone Brain, badge Beta, botão fechar

## Deviations from Plan

None — plano executado exatamente como escrito.

## Known Stubs

None — o card agora busca conteúdo real da OpenAI. O `aiInsightMock.texto` permanece apenas como fallback de erro/sem-chave (comportamento intencional).

## Self-Check: PASSED

- `src/app/api/insights/route.ts` existe e exporta `GET` com `runtime = 'nodejs'`
- `src/components/dashboard/ai-insight-float.tsx` não referencia `aiInsightMock.texto` no JSX (apenas dentro do `useEffect` como fallback)
- `npx tsc --noEmit` passou sem erros em ambos os arquivos
- Commits: `42d18e8` (rota), `d7d5a12` (componente)

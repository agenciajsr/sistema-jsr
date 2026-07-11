---
phase: quick-260711-gi1
plan: 01
subsystem: ai
tags: [openai, vercel-ai-sdk, streaming, chat, copilot, next-app-router]

requires:
  - phase: quick-260711-f7m
    provides: mocks do dashboard (dashboard-ref.ts, dashboard.ts) usados no snapshot da IA
provides:
  - Copilot conversacional funcional em /chat-ia (streaming, sugestões, auto-scroll)
  - Rota protegida /api/chat (401 sem auth, server-only para a chave, graciosa sem chave)
  - Módulo src/lib/ai/copilot.ts (persona + snapshot dos mocks + modelo configurável)
affects: [chat-ia, insights-dashboard, integracoes-meta-google-ads, financeiro]

tech-stack:
  added: [ai@7.0.22, "@ai-sdk/openai@4.0.11"]
  patterns:
    - "Streaming texto-simples via toTextStreamResponse() + fetch/reader no client (sem @ai-sdk/react)"
    - "Auth gate no topo do Route Handler antes de qualquer chamada paga à OpenAI"
    - "Degradação graciosa: fallback em stream de texto pt-BR quando a chave falta (nunca 500)"

key-files:
  created:
    - src/lib/ai/copilot.ts
    - src/app/api/chat/route.ts
  modified:
    - "src/app/(app)/chat-ia/page.tsx"
    - .env.example
    - package.json

key-decisions:
  - "Não usar o hook useChat/@ai-sdk/react (fora das deps permitidas); client consome stream de texto simples via fetch+reader"
  - "Route Handler retorna toTextStreamResponse() (stream de texto puro) em vez do protocolo UI-message, simplificando o client e os fallbacks"
  - "Fallbacks (sem chave / erro) também são streams de texto, para a bolha do assistente aparecer idêntica em todos os casos"

patterns-established:
  - "IA server-only: chave lida apenas de process.env.OPENAI_API_KEY, nunca NEXT_PUBLIC, nunca hardcoded"
  - "Snapshot dos mocks montado como texto enxuto legível (não objetos crus) para economizar tokens"

requirements-completed: [QUICK-gi1-CHAT-IA]

duration: 18min
completed: 2026-07-11
---

# Phase quick-260711-gi1 Plan 01: Chat com IA (Copilot OpenAI) Summary

**Copilot conversacional em /chat-ia com streaming da OpenAI via Vercel AI SDK, rota protegida por auth, chave 100% server-only e degradação graciosa em pt-BR enquanto a OPENAI_API_KEY não é configurada.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-11T14:57:06Z
- **Completed:** 2026-07-11T15:15:04Z
- **Tasks:** 3 completed
- **Files modified:** 5 (2 criados, 3 modificados) + package-lock.json

## Accomplishments

- Página /chat-ia deixou de ser placeholder "Em breve" e virou um chat premium: estado vazio com 4 sugestões clicáveis, bolhas usuário/assistente, streaming visível, indicador de digitação e auto-scroll.
- Rota /api/chat protegida: 401 sem usuário autenticado (antes de qualquer chamada à OpenAI), streaming com chave, e mensagem-guia em pt-BR sem chave (nunca 500).
- Persona (analista sênior de tráfego pago da JSR) alimentada por um snapshot compacto dos mocks da agência (KPIs, saúde de campanhas, verba, financeiro, alertas, health score), instruída a sempre trazer análise + ação e a deixar claro que os dados são de exemplo.

## Task Commits

1. **Task 1: AI SDK + módulo copilot + .env.example** - `1ea259c` (feat)
2. **Task 2: Route Handler /api/chat protegido** - `efe3412` (feat)
3. **Task 3: UI de chat premium /chat-ia** - `89f4e89` (feat)

## Files Created/Modified

- `src/lib/ai/copilot.ts` (criado) - Persona (system prompt pt-BR), buildSnapshot() a partir dos mocks, OPENAI_MODEL configurável e buildSystemMessage() combinado. Server-only.
- `src/app/api/chat/route.ts` (criado) - Route Handler POST, runtime nodejs. Auth gate (401), tratamento sem-chave gracioso, streaming via streamText + toTextStreamResponse(), try/catch amigável.
- `src/app/(app)/chat-ia/page.tsx` (modificado) - Client component de chat premium consumindo /api/chat via fetch+reader (streaming manual), sugestões, auto-scroll, Enter-para-enviar.
- `.env.example` (modificado) - Placeholders vazios OPENAI_API_KEY= e OPENAI_MODEL=gpt-4o-mini com comentários de origem/segurança.
- `package.json` / `package-lock.json` (modificado) - Adiciona ai@7.0.22 e @ai-sdk/openai@4.0.11 (únicas deps novas).

## Verificação da versão instalada do AI SDK (Task 1)

Conforme exigido, a API foi verificada contra os pacotes REALMENTE instalados antes de codar:

- `ai` = **7.0.22**, `@ai-sdk/openai` = **4.0.11**.
- `@ai-sdk/react` (que fornece `useChat`) **não está instalado** e **não é permitido** (só `ai` + `@ai-sdk/openai`). Por isso o client NÃO usa `useChat`: consome o stream de texto via `fetch` + `ReadableStream reader`.
- `ai` v7 exporta `streamText`, `ModelMessage`, `convertToModelMessages`; o resultado de `streamText` expõe `toTextStreamResponse()`, `toUIMessageStreamResponse()`, `toTextStreamResponse()` — escolhido `toTextStreamResponse()` por casar com o client de fetch manual.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Client de chat sem `useChat`/`@ai-sdk/react`**
- **Found during:** Task 1 (verificação da API instalada)
- **Issue:** O plano sugeria usar o hook `useChat` de `@ai-sdk/react`, mas esse pacote não está instalado e as constraints permitem SOMENTE `ai` e `@ai-sdk/openai`. Adicionar `@ai-sdk/react` violaria a restrição de dependências.
- **Fix:** Servidor responde com `result.toTextStreamResponse()` (stream de texto puro) e o client consome via `fetch` + `reader`, atualizando a bolha do assistente incrementalmente. Mantém streaming, auto-scroll e sugestões sem dep extra.
- **Files modified:** src/app/api/chat/route.ts, src/app/(app)/chat-ia/page.tsx
- **Commit:** efe3412, 89f4e89

## Authentication Gates

Nenhum gate de autenticação de ferramenta durante a execução. A configuração da `OPENAI_API_KEY` é setup do usuário (documentado em `user_setup` do PLAN e no `.env.example`); enquanto ausente, o chat responde com a mensagem-guia em pt-BR (degradação graciosa, comprovada pela lógica sem-chave da rota).

## Verification Results

- `npx tsc --noEmit`: **limpo** (0 erros) após cada task.
- `npm run lint`: apenas os **2 erros pré-existentes conhecidos** (`src/components/ui/sidebar.tsx`, `src/hooks/use-mobile.ts`) — nenhum erro NOVO introduzido.
- Grep de segurança: **nenhuma** ocorrência de `NEXT_PUBLIC` ligada a OpenAI e **nenhuma** chave literal (`sk-...`). `OPENAI_API_KEY` só aparece em `process.env.OPENAI_API_KEY` no servidor.
- `.env.example`: contém apenas placeholders vazios (`OPENAI_API_KEY=` e `OPENAI_MODEL=gpt-4o-mini`).

## Known Stubs

Nenhum stub que impeça o objetivo do plano. O snapshot da IA usa dados de **exemplo (mocks)** intencionalmente — a própria persona é instruída a declarar isso, e o `<MockNotice>` avisa na UI. A troca por dados reais depende das integrações Meta/Google Ads + financeiro (fases futuras do roadmap), conforme decisão do produto.

## Nota de verificação manual

A verificação visual completa (abrir /chat-ia logado e enviar uma pergunta) depende de sessão autenticada e não foi executada interativamente neste ambiente. Toda a verificação automatizada (tsc, lint, grep de segurança) passou. Com a `OPENAI_API_KEY` ainda ausente, o comportamento esperado ao enviar é a mensagem-guia em pt-BR (degradação graciosa, sem 500).

## Self-Check: PASSED

Todos os arquivos declarados existem em disco e todos os commits de task foram encontrados no histórico (1ea259c, efe3412, 89f4e89).

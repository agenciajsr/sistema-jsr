---
quick_task: 260712-uc1
titulo: Integração completa com o Google Calendar (OAuth 2.0, duas vias)
data: 2026-07-12
status: concluído (código pronto; teste E2E pendente das credenciais do usuário)
tags: [google-calendar, oauth, integracao, agenda, single-tenant]
requires:
  - Tabela google_credentials (migration 0011 — NÃO aplicada)
  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXT_PUBLIC_APP_URL
provides:
  - Fluxo OAuth Google (start/callback) com CSRF state
  - Armazenamento de tokens single-tenant + refresh automático
  - Client REST do Google Calendar validado por Zod (fuso Brasília)
  - Card "Agenda de Hoje" com eventos reais + degradação graciosa
  - Página /agenda (próximos + criar/editar) com RHF+Zod
  - /integracoes com Conectar/Desconectar (revoga token)
key-files:
  created:
    - src/lib/google/schemas.ts
    - src/lib/google/oauth.ts
    - src/lib/google/credentials.ts
    - src/lib/google/calendar.ts
    - src/app/api/integrations/google/start/route.ts
    - src/app/api/integrations/google/callback/route.ts
    - src/actions/agenda.ts
    - src/actions/integracoes-google.ts
    - src/app/(app)/agenda/page.tsx
    - src/components/agenda/evento-form.tsx
    - drizzle/0011_sleepy_gabe_jones.sql
  modified:
    - src/lib/db/schema.ts
    - src/components/dashboard/agenda-hoje.tsx
    - src/app/(app)/integracoes/page.tsx
    - src/components/app-sidebar.tsx
    - .env.example
metrics:
  tasks: 5
  files: 15
  commits: 5
---

# Quick 260712-uc1: Integração completa com o Google Calendar — Summary

Integração de duas vias com o Google Calendar (OAuth 2.0) para o Sistema JSR (app single-tenant). O usuário conecta a conta Google uma vez; o painel passa a mostrar os eventos reais de hoje, e a nova página `/agenda` lista os próximos compromissos e permite criar/editar eventos que gravam direto no Google. Segue o mesmo padrão defensivo (nunca derruba o painel) e de validação (Zod em toda resposta externa) já usado na integração Meta.

## O que foi entregue (por tarefa)

1. **Schema + migration + Zod** — Tabela single-tenant `google_credentials` (uma linha: email, access_token, refresh_token, expiry, scope, timestamps). Migration aditiva `0011_sleepy_gabe_jones.sql` gerada (apenas `CREATE TABLE`). `.env.example` com as novas variáveis. `src/lib/google/schemas.ts` com Zod para tokens, userinfo e eventos.
2. **OAuth** — `oauth.ts` (buildAuthUrl com scope `calendar.events` + `access_type=offline` + `prompt=consent` + `state`, exchangeCode, refreshAccessToken, revokeToken, fetchUserEmail). `credentials.ts` (linha única save/get/delete + `getValidAccessToken` com refresh automático e buffer de 60s). Rotas `/api/integrations/google/start` (gera state CSRF em cookie httpOnly, redireciona ao consentimento) e `/callback` (valida CSRF, troca code por tokens, grava via saveCredentials).
3. **Calendar client + card** — `calendar.ts` (listar/criar/editar eventos, Zod em toda resposta, fuso `America/Sao_Paulo`, erro sentinela `NAO_CONECTADO`). `agenda-hoje.tsx` reescrito: eventos reais de hoje em try/catch (nunca derruba o painel), estado "Conecte sua agenda do Google" quando desconectado, link "Ver agenda" → `/agenda`, mock removido.
4. **Página /agenda** — `actions/agenda.ts` (eventoSchema com refine fim>início; criar/editar convertem datetime-local → RFC3339 com offset `-03:00`; getEventosProximos nunca lança). Página server component agrupando próximos 14 dias por dia (fuso Brasília). `evento-form.tsx` (RHF + zodResolver, cria e edita, visibilidade via useState sem Dialog). Item "Agenda" na sidebar (ícone CalendarDays).
5. **/integracoes** — `integracoes-google.ts` (desconectarGoogle revoga o refresh_token best-effort + apaga a linha). Página reescrita: card "Google Agenda" mostra "Conectado como {email}" + botão Desconectar, ou botão "Conectar Google Agenda" (→ rota `/start`); feedback via searchParams (`conectado=1` / `erro=...`).

## Commits

| Task | Descrição | Commit |
|------|-----------|--------|
| 1 | Schema google_credentials + migration 0011 + Zod schemas | a0c5400 |
| 2 | Fluxo OAuth (start/callback) + tokens com refresh automático | 54ae042 |
| 3 | Client REST do Calendar (Zod, Brasília) + card de agenda real | 93ab10f |
| 4 | Página /agenda (próximos + criar/editar) RHF+Zod + sidebar | d6d8ca7 |
| 5 | /integracoes Conectar/Desconectar (revoga token) | f8bb9fc |

## Verificação

- `npx tsc --noEmit` — limpo (0 erros).
- `npx vitest run` — 7 arquivos, 67 testes, todos passando.
- Migration `drizzle/0011_sleepy_gabe_jones.sql` contém apenas `CREATE TABLE "google_credentials"` (nenhum statement destrutivo).
- Greps de sanidade: `access_type=offline` + `prompt=consent` em oauth.ts; `America/Sao_Paulo` em calendar.ts; `agendaHojeMock` removido do card.
- `next build` não foi executado: exigiria copiar `.env.local` (segredos) para o worktree e conexão real ao Supabase. O `tsc --noEmit` já valida a compilação de todas as novas rotas/componentes.

## Deviations from Plan

### Auto-fixed (Rule 3 — blocking)

**1. Pacote `server-only` ausente**
- **Encontrado durante:** Task 2.
- **Problema:** `credentials.ts` importava `'server-only'`, que não está instalado no projeto (o codebase inteiro não o usa).
- **Correção:** Removido o import (padrão do codebase — os módulos server já são garantidos por uso de DB/Server Actions). Sem impacto funcional.
- **Commit:** 54ae042.

**2. `<form action>` exige retorno void**
- **Encontrado durante:** Task 5.
- **Problema:** `desconectarGoogle` retorna `{ ok: true } | { error }`, incompatível com o tipo de `form action` (`(formData) => void | Promise<void>`) — erro TS2322.
- **Correção:** Criado um wrapper server action inline `desconectarAction()` na página `/integracoes` que aguarda `desconectarGoogle()` e retorna void (mesmo espírito das actions inline do detalhe de cliente). A action pública mantém o retorno tipado para uso programático.
- **Commit:** f8bb9fc.

## AÇÃO NECESSÁRIA DO USUÁRIO (pendências para ligar de verdade)

### 1. Aplicar a migration (NÃO foi aplicada)
`drizzle/0011_sleepy_gabe_jones.sql` é **aditiva** (só cria a tabela `google_credentials`). Aplicar de forma controlada, por exemplo:
- Revisar o `.sql` e rodar manualmente no Supabase (SQL editor), **ou**
- `npx drizzle-kit migrate` com `DIRECT_URL` apontando para a conexão direta (porta 5432).

Enquanto a tabela não existir, o card e a página `/agenda` mostram o estado "Conecte sua agenda do Google" sem quebrar (degradação graciosa).

### 2. Variáveis de ambiente (`.env.local`)
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...        # server-only, NUNCA com prefixo NEXT_PUBLIC
NEXT_PUBLIC_APP_URL=https://seu-dominio  # em dev pode omitir (fallback http://localhost:3000)
```

### 3. Passo-a-passo no Google Cloud Console
1. **Ativar a Google Calendar API:** APIs & Services → Library → Google Calendar API → Enable.
2. **Criar OAuth Client (Web application):** APIs & Services → Credentials → Create Credentials → OAuth client ID → tipo "Web application". Copiar Client ID e Client secret para as env vars.
3. **Authorized redirect URI (exatamente igual):** `{NEXT_PUBLIC_APP_URL}/api/integrations/google/callback` (e `http://localhost:3000/api/integrations/google/callback` em dev).
4. **OAuth consent screen:** enquanto o app estiver em modo "Testing", adicionar o e-mail do usuário em **Test users**.

### 4. O que só é testável APÓS as credenciais
Está tudo pronto no código, mas o fluxo real depende dos passos acima:
- Conectar a conta em `/integracoes` (redirect ao consentimento → callback grava tokens).
- Ver eventos reais de hoje no card do painel.
- Listar próximos compromissos e criar/editar eventos (POST/PATCH gravando no Google) em `/agenda`.
- Desconectar (revoga o token no Google e apaga a linha).

## Known Stubs

Nenhum. O card de agenda e a página `/agenda` renderizam o estado "Conecte sua agenda" por **degradação graciosa** (não é stub) — passam a mostrar dados reais assim que as credenciais forem configuradas e a migration aplicada.

## Self-Check: PASSED

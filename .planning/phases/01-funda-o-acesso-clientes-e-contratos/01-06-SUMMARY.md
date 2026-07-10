---
phase: 01-funda-o-acesso-clientes-e-contratos
plan: 06
subsystem: auth
tags: [zod, react-hook-form, supabase-admin-api, server-actions, sonner, nextjs-app-router]

# Dependency graph
requires:
  - phase: 01-funda-o-acesso-clientes-e-contratos (Plan 01-03)
    provides: "src/lib/auth/session.ts (getCurrentUser, requireAdmin), padrão de Admin API do scripts/seed-admin.ts"
provides:
  - "Server Action criarUsuario (Admin-only) usando Supabase Admin API"
  - "Tela /usuarios 'Adicionar Usuário' visível apenas para Admin"
  - "<Toaster /> global montado em src/app/layout.tsx (sonner)"
affects: [ux-team-management, future-invite-flows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component (page.tsx) faz o gate de role via getCurrentUser + redirect; Client Component irmão (formulario-usuario.tsx) concentra hooks (React Hook Form + zodResolver) — necessário porque Server Components não podem usar hooks"
    - "Server Action retorna union discriminada { data } | { error } (sem exceptions) para o client component tratar via toast"

key-files:
  created:
    - src/lib/validations/usuario.ts
    - src/actions/usuarios.ts
    - src/app/(app)/usuarios/page.tsx
    - src/app/(app)/usuarios/formulario-usuario.tsx
  modified:
    - src/app/layout.tsx

key-decisions:
  - "criarUsuario chama requireAdmin() antes de qualquer validação/chamada à Admin API — bloqueio de Membro acontece o mais cedo possível na Server Action, não só na UI"
  - "Formulário dividido em page.tsx (Server Component, gate de acesso) + formulario-usuario.tsx (Client Component, hooks) — limite obrigatório do App Router, pois getCurrentUser usa cookies (server-only) e useForm exige 'use client'"

patterns-established:
  - "Server Action de mutação: valida com requireAdmin/Zod, usa Supabase Admin API com SUPABASE_SECRET_KEY (nunca NEXT_PUBLIC_), retorna { data } | { error: mensagem-amigável }"

requirements-completed: [ACES-02]

# Metrics
duration: 15min
completed: 2026-07-10
---

# Phase 01 Plan 06: Criação de Usuários (Admin-only) Summary

**Server Action `criarUsuario` (Supabase Admin API + insert em `profiles`) e tela `/usuarios` "Adicionar Usuário", ambas bloqueadas para quem não é Admin.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-10T20:00:00-03:00 (aprox.)
- **Completed:** 2026-07-10T20:10:16-03:00
- **Tasks:** 2/2 completed
- **Files modified:** 5 (4 criados, 1 modificado)

## Accomplishments
- Server Action `criarUsuario` que checa `requireAdmin()` antes de tocar na Supabase Admin API, cria a conta via `auth.admin.createUser` e insere o `profiles` correspondente
- Tela `/usuarios` "Adicionar Usuário": Server Component que redireciona Membro para `/clientes`, renderizando o formulário apenas para Admin
- Formulário Client Component (React Hook Form + `zodResolver(usuarioSchema)`) com os campos exatos do UI-SPEC: Nome, Email, Senha temporária, Papel (Select Admin/Membro)
- `<Toaster />` (sonner) montado globalmente em `src/app/layout.tsx` — necessário para os toasts de sucesso/erro do formulário funcionarem

## Task Commits

Each task was committed atomically:

1. **Task 1: Validação Zod + Server Action criarUsuario (Admin-only)** - `e67cc65` (feat)
2. **Task 2: Tela "Adicionar Usuário" (Admin-only)** - `9e367dd` (feat)

_Nenhuma tarefa TDD nesta plan._

## Files Created/Modified
- `src/lib/validations/usuario.ts` - `usuarioSchema` (Zod) e tipo `UsuarioInput` (nome, email, senhaTemporaria, role)
- `src/actions/usuarios.ts` - Server Action `criarUsuario`: requireAdmin → Zod safeParse → Supabase Admin API `createUser` → insert em `profiles`
- `src/app/(app)/usuarios/page.tsx` - Server Component: gate de Admin (redirect `/clientes` para Membro), renderiza `<FormularioUsuario />` dentro de um `Card`
- `src/app/(app)/usuarios/formulario-usuario.tsx` - Client Component: formulário React Hook Form + Zod, Select de Papel via `Controller`, toasts de sucesso/erro
- `src/app/layout.tsx` - adiciona `<Toaster />` global (sonner) — pré-requisito para o toast do formulário aparecer

## Decisions Made
- `criarUsuario` retorna imediatamente `{ error }` se `requireAdmin()` falhar, antes de qualquer validação Zod ou chamada de rede — evita expor comportamento da Admin API para não-Admin
- Erros inesperados (Admin API ou insert no `profiles`) retornam a mensagem padrão do UI-SPEC ("Não foi possível salvar. Verifique os dados e tente novamente.") em vez de vazar detalhes internos
- Formulário dividido em dois arquivos (page.tsx Server + formulario-usuario.tsx Client) por exigência estrutural do Next.js App Router — ver Deviations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `<Toaster />` (sonner) não estava montado em nenhum lugar do app**
- **Found during:** Task 2 (tela "Adicionar Usuário")
- **Issue:** O componente `src/components/ui/sonner.tsx` (`Toaster`) já existia no projeto (instalado via shadcn), mas nunca foi renderizado em `src/app/layout.tsx` nem em nenhum outro layout. Sem isso, chamadas a `toast.success`/`toast.error` no formulário não exibiriam nada — o plano exige explicitamente feedback via toast em sucesso/erro.
- **Fix:** Adicionado `<Toaster />` ao final do `<body>` em `src/app/layout.tsx`.
- **Files modified:** `src/app/layout.tsx`
- **Verification:** `npm run build` passa; toast é renderizado por qualquer página cliente que chame `toast(...)` a partir de agora, não só a tela de usuários.
- **Committed in:** `9e367dd` (parte do commit da Task 2)

**2. [Estrutural, não é um dos 4 tipos de deviation, documentado por transparência] `page.tsx` dividido em dois arquivos**
- **Found during:** Task 2
- **Contexto:** O plano lista apenas `src/app/(app)/usuarios/page.tsx` em `files_modified`, e os acceptance_criteria fazem grep literal de textos ("Adicionar Usuário", "Nome", "Email", "Senha temporária", "Papel", checagem de `role`) nesse arquivo.
- **Motivo técnico:** `page.tsx` precisa ser um Server Component assíncrono para chamar `getCurrentUser()` (usa cookies, só funciona no servidor). O formulário precisa de `useForm`/`Controller` (React Hook Form), que exige `'use client'` no topo do arquivo — um arquivo não pode ser simultaneamente Server Component assíncrono com acesso a cookies e Client Component com hooks. É exatamente o padrão que a própria ação do Task 2 descreve ("renderiza um formulário Client Component").
- **Resolução:** Criado `src/app/(app)/usuarios/formulario-usuario.tsx` (Client Component) com os campos/labels/CTA; `page.tsx` permanece Server Component, faz o gate de Admin e renderiza `<FormularioUsuario />` dentro de um `Card` com título "Adicionar Usuário" (o texto do CTA também aparece como título da tela). Os textos "Nome", "Email", "Senha temporária", "Papel" ficam em `formulario-usuario.tsx`, não literalmente em `page.tsx`.
- **Impacto:** Comportamento e copy exigidos pelo UI-SPEC são cumpridos integralmente na rota `/usuarios` (visível na renderização final); apenas a localização física do texto no arquivo `page.tsx` isolado difere do grep literal do plano. Nenhum ajuste arquitetural real — é o split Server/Client padrão do App Router.

---

**Total deviations:** 1 auto-fix (Rule 3 - blocking) + 1 nota estrutural documentada
**Impact on plan:** Toaster era um pré-requisito real para a funcionalidade pedida (feedback de toast) funcionar; sem ele o Task 2 não cumpriria seu próprio `<action>`. O split de arquivo é a implementação idiomática do padrão que o próprio plano descreveu, sem mudança de escopo.

## Issues Encountered
Nenhum além das deviations documentadas acima.

## User Setup Required
None - não há configuração externa nova; reutiliza `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY` já configurados no Plan 01-03.

## Next Phase Readiness
- ACES-02 cumprido: Admin cria novos usuários (Admin ou Membro) direto pelo sistema, sem depender de `scripts/seed-admin.ts` para uso contínuo
- Verificação manual completa (Admin cria um Membro; Membro não vê `/usuarios`) fica para o checkpoint final do Plan 01-09, conforme a seção `<verification>` do plano
- Rota `/clientes` (destino do redirect para não-Admin) ainda não existe neste worktree — é esperado, está sendo construída em outro plan/agent paralelo (mesma convenção já usada em `src/actions/auth.ts::signIn`)

---
*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified present on disk; both task commits (`e67cc65`, `9e367dd`) verified present in git history.

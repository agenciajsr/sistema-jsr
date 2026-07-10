---
phase: 01-funda-o-acesso-clientes-e-contratos
plan: 8
subsystem: ui
tags: [nextjs, react-hook-form, zod, shadcn-ui, drizzle-orm, server-actions, radix-ui]

# Dependency graph
requires:
  - phase: 01-funda-o-acesso-clientes-e-contratos
    provides: Server Actions (createClienteComContrato, updateCliente, deleteCliente, registrarContrato, deleteContrato, getContratosDoCliente), validation schemas, getCurrentUser/requireAdmin, selecionarContratoAtual
provides:
  - Formulário combinado de cadastro de cliente + primeiro contrato (/clientes/novo)
  - Lista de clientes em cards com status/nicho/MRR/vigência (/clientes)
  - Página de detalhe do cliente com contrato atual, histórico de renovações, registro de renovação e exclusão admin-only (/clientes/[id])
  - Página de edição de cliente (/clientes/[id]/editar)
affects: [fase-3-painel-trafego, fase-4-financeiro-alertas, fase-6-painel-geral]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "z.input/z.output no useForm para contornar incompatibilidade de tipo do zodResolver quando o schema usa .default() (campo opcional na entrada, obrigatório na saída)"
    - "AlertDialog de confirmação com Server Action inline (function 'use server' definida no próprio arquivo da Server Component) acionada via <form action={...}>, evitando extrair um client component só para toggle de exclusão"
    - "ClienteForm com dois modos (criar/editar) num único componente: modo criar usa schema combinado z.object({ cliente, contrato }); modo editar usa apenas clienteSchema"

key-files:
  created:
    - src/components/cliente-form.tsx
    - src/components/cliente-card.tsx
    - src/components/contrato-form.tsx
    - src/app/(app)/clientes/page.tsx
    - src/app/(app)/clientes/novo/page.tsx
    - src/app/(app)/clientes/[id]/page.tsx
    - src/app/(app)/clientes/[id]/editar/page.tsx
  modified: []

key-decisions:
  - "AlertDialogs de exclusão usam Server Actions inline (definidas dentro de clientes/[id]/page.tsx com 'use server') acionadas via <form action={...}.bind(null, id)>, mantendo a checagem role === 'admin' e a copy exata do UI-SPEC no próprio arquivo da página (requisito de acceptance_criteria), sem precisar extrair um client component."
  - "ContratoForm controla sua própria visibilidade (botão 'Registrar Contrato' vira formulário inline ao clicar), evitando introduzir o componente Dialog do shadcn, que não está na lista de blocks aprovados no UI-SPEC (Registry Safety)."
  - "Histórico de Contratos exclui o contrato vigente da lista (filtrado por id), já que ele é exibido em destaque na seção 'Contrato Atual' — evita duplicação visual (D-06)."

patterns-established:
  - "Server Components de detalhe/edição usam db.query.<tabela>.findFirst + notFound() do next/navigation para clientes inexistentes."

requirements-completed: [CLI-01, CLI-02, CLI-03, CLI-04]

# Metrics
duration: 12min
completed: 2026-07-10
---

# Phase 01 Plan 08: Interface de Clientes e Contratos Summary

**Fluxo completo de cadastro/edição/exclusão de clientes e contratos em cards, com formulário combinado cliente+contrato, histórico de renovações e exclusão restrita a Admin com AlertDialog de confirmação.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-10T23:11:59Z
- **Completed:** 2026-07-10T23:23:00Z
- **Tasks:** 3
- **Files modified:** 7 (todos criados)

## Accomplishments
- Formulário de cadastro de cliente com primeiro contrato embutido, usando um único schema Zod combinado (`z.object({ cliente, contrato })`) e React Hook Form
- Lista de clientes em cards (grid responsiva, gap 32px) exibindo badge de status com cores exatas do UI-SPEC (`#16A34A`/`#D97706`/`#71717A`), nicho, MRR do contrato atual e vigência em texto neutro
- Página de detalhe do cliente com badge "Contrato Atual", seção "Histórico de Contratos", formulário de renovação (sempre insere novo registro, nunca edita) e exclusão de cliente/contrato restrita a Admin
- Página de edição de cliente reutilizando `ClienteForm` em modo `editar`, pré-preenchida com os dados atuais

## Task Commits

Each task was committed atomically:

1. **Task 1: Formulário de cadastro de cliente + primeiro contrato** - `ad4f04f` (feat)
2. **Task 2: Lista de clientes em cards (CLI-04)** - `aa1db5e` (feat)
3. **Task 3: Detalhe do cliente — edição, histórico, renovação e exclusão admin-only** - `886e9cd` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `src/components/cliente-form.tsx` - Formulário combinado (modo criar: cliente + primeiro contrato; modo editar: apenas cliente), React Hook Form + zodResolver
- `src/components/cliente-card.tsx` - Card de cliente com badge de status, nicho, MRR e vigência
- `src/components/contrato-form.tsx` - Formulário de renovação de contrato (toggle inline, chama `registrarContrato`)
- `src/app/(app)/clientes/page.tsx` - Lista de clientes em cards + empty state
- `src/app/(app)/clientes/novo/page.tsx` - Página de cadastro (título "Cadastrar Cliente")
- `src/app/(app)/clientes/[id]/page.tsx` - Detalhe: contrato atual, histórico, renovação, exclusão admin-only
- `src/app/(app)/clientes/[id]/editar/page.tsx` - Edição de cliente

## Decisions Made
- `z.input`/`z.output` no `useForm` (3 generics do `zodResolver`) para resolver incompatibilidade de tipos causada por `clienteSchema.status` ter `.default('ativo')` (campo opcional na entrada do form, obrigatório na saída pós-validação) — ver "Deviations" abaixo.
- Exclusão via `<form action={...}>` com Server Action inline definida dentro do próprio Server Component de detalhe, ao invés de extrair um client component — permite manter a checagem `role === 'admin'` e a copy exata de confirmação diretamente em `clientes/[id]/page.tsx`, conforme exigido pelos `acceptance_criteria` do plano.
- `ContratoForm` não usa o componente `Dialog` do shadcn (não presente no Registry Safety do UI-SPEC) — em vez disso, controla sua própria visibilidade com `useState`, alternando entre botão "Registrar Contrato" e o formulário inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] z.input/z.output no useForm para corrigir erro de tipo do zodResolver**
- **Found during:** Task 1 (Formulário de cadastro de cliente)
- **Issue:** `npm run build` falhava com erro de tipo: `clienteSchema.status` usa `z.enum([...]).default('ativo')`, o que torna o tipo de entrada (pré-parse) do campo `status` opcional, mas o tipo de saída (pós-parse) obrigatório. `useForm<ClienteInput>` (tipo de saída) não é compatível com o `Resolver` gerado por `zodResolver`, que espera o tipo de entrada em `TFieldValues`.
- **Fix:** `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>(...)`, usando os 3 generics suportados por `@hookform/resolvers@5.4.x` — `TFieldValues` (entrada, usada por `defaultValues`/`register`) e `TTransformedValues` (saída, usada pelo argumento de `onSubmit`). Aplicado em `ClienteFormCriar`, `ClienteFormEditar` (cliente-form.tsx) e `ContratoForm` (contrato-form.tsx).
- **Files modified:** src/components/cliente-form.tsx, src/components/contrato-form.tsx
- **Verification:** `npm run build` finaliza com exit code 0, TypeScript sem erros
- **Committed in:** ad4f04f (Task 1), 886e9cd (Task 3, contrato-form.tsx)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Correção de tipos necessária para o build passar; não altera comportamento runtime nem escopo do plano.

## Issues Encountered
None além do deviation acima.

## User Setup Required
None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- CLI-01 a CLI-04 utilizáveis de ponta a ponta pelo navegador: /clientes (lista) → /clientes/novo (cadastro) → /clientes/[id] (detalhe/histórico/renovação/exclusão) → /clientes/[id]/editar.
- Resta o plan 01-09 (checkpoint de verificação manual — `autonomous: false`), que cobre os 5 critérios de sucesso do ROADMAP.md §Phase 1 e as verificações manual-only de ACES-01/02/03 (sessão/cookie real do Supabase Auth). A Fase 1 só deve ser considerada concluída após esse checkpoint.
- Nenhum bloqueio identificado para a próxima fase.

---
*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 7 created files verified present on disk. All 3 task commits (ad4f04f, aa1db5e, 886e9cd) verified present in git log.

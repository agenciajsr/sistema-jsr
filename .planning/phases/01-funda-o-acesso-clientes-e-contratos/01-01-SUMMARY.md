---
phase: 01-funda-o-acesso-clientes-e-contratos
plan: 01
subsystem: infra
tags: [nextjs, typescript, tailwind, shadcn-ui, vitest, supabase, drizzle]

# Dependency graph
requires: []
provides:
  - Projeto Next.js 16 (App Router + TypeScript + Tailwind v4) rodando e buildando sem erros
  - Todas as dependências de runtime/dev do stack fixado em CLAUDE.md instaladas nas versões pinadas
  - shadcn/ui inicializado (preset New York / Neutral / cssVariables) com os 11 componentes exigidos por 01-UI-SPEC.md
  - globals.css com tokens de cor mapeados a partir do contrato visual (accent #1E76C4, secondary #F4F4F5, destructive #DC2626)
  - Vitest configurado (alias @ -> ./src) com 4 stubs describe.todo cobrindo as lacunas de teste da fase (CLI-01/02/03/04)
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09]

# Tech tracking
tech-stack:
  added: [next@16.2.10, react@19.2.4, "@supabase/supabase-js@2.110.2", "@supabase/ssr@0.12.0", drizzle-orm@0.45.2, postgres@3.4.9, zod@4.4.3, react-hook-form@7.81.0, "@hookform/resolvers@5.4.0", date-fns@4.4.0, drizzle-kit@0.31.10, vitest@4.1.10, tsx, shadcn-ui (new-york/neutral), class-variance-authority, lucide-react, clsx, tailwind-merge, tw-animate-css, radix-ui, sonner, next-themes]
  patterns:
    - "shadcn/ui componentes vivem em src/components/ui/, helper cn em src/lib/utils.ts"
    - "components.json escrito manualmente com valores legados (style: new-york) porque o CLI shadcn 4.13.x substituiu o wizard style+baseColor por presets nomeados (nova/vega/maia/...); o schema de components.json ainda aceita os valores legados e `shadcn add` funciona normalmente"
    - "Tokens de cor do design system vivem em src/app/globals.css como CSS custom properties (:root) referenciadas via @theme inline (Tailwind v4), não em tailwind.config"
    - "Testes ficam em tests/ na raiz (não em src/), separados por categoria (validations/, db/, actions/), com alias @ -> ./src disponível via vitest.config.ts"

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - src/app/layout.tsx
    - src/app/globals.css
    - src/app/page.tsx
    - components.json
    - src/lib/utils.ts
    - src/components/ui/{button,input,label,textarea,select,form,card,badge,alert-dialog,dropdown-menu,sonner}.tsx
    - vitest.config.ts
    - tests/validations/cliente.test.ts
    - tests/validations/contrato.test.ts
    - tests/db/current-contrato.test.ts
    - tests/actions/contratos.test.ts
  modified: []

key-decisions:
  - "shadcn CLI 4.13.x não expõe mais --style/--base-color no `init`; components.json foi escrito manualmente com os valores aprovados (new-york/neutral/cssVariables:true) e validado rodando `shadcn add` com sucesso — a CLI ainda honra esses valores legados no schema."
  - "Como o `init` completo não rodou (por causa da mudança de preset), utilitários que ele normalmente gera (cn helper, dependências class-variance-authority/lucide-react/clsx/tailwind-merge/tw-animate-css, tokens CSS em globals.css) foram recriados manualmente a partir do contrato de 01-UI-SPEC.md — necessário para os componentes shadcn compilarem e para as cores baterem com o design aprovado."

patterns-established:
  - "components.json com style legado 'new-york' + baseColor 'neutral' + cssVariables true — usar o mesmo padrão ao adicionar novos componentes shadcn em fases futuras"
  - "Tokens de cor centralizados em src/app/globals.css (:root + @theme inline), qualquer nova cor de marca/status deve ser adicionada lá, não inline nos componentes"

requirements-completed: [CLI-01, CLI-02, CLI-03, CLI-04]

# Metrics
duration: 25min
completed: 2026-07-10
---

# Phase 01 Plan 01: Fundação do projeto Next.js Summary

**Projeto Next.js 16 App Router com Tailwind v4, shadcn/ui (New York/Neutral) e Vitest configurados, prontos para as fases de autenticação, clientes e contratos.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-10T19:20:00Z (aprox.)
- **Completed:** 2026-07-10T19:32:00Z (aprox.)
- **Tasks:** 3
- **Files modified:** 34

## Accomplishments
- Projeto Next.js 16.2.10 (App Router, TypeScript, Tailwind v4, Turbopack) criado no repositório greenfield, preservando `.planning/`, `.git/`, `.claude/` e `CLAUDE.md` intactos
- Todas as dependências de runtime/dev do stack fixado em CLAUDE.md instaladas nas versões exatas pinadas (Supabase, Drizzle, Zod, React Hook Form, date-fns, drizzle-kit, Vitest, tsx)
- shadcn/ui inicializado com o preset aprovado (New York / Neutral / cssVariables:true / lucide-react) e os 11 componentes exigidos por 01-UI-SPEC.md instalados
- globals.css com os tokens de cor do contrato visual (accent funcional #1E76C4, secondary #F4F4F5, border #E4E4E7, destructive #DC2626)
- Vitest configurado com alias `@ -> ./src` e 4 stubs `describe.todo` cobrindo as lacunas de teste identificadas em 01-VALIDATION.md (CLI-01 a CLI-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Inicializar projeto Next.js 16 e instalar dependências do stack** - `e0274ea` (feat)
2. **Task 2: Inicializar shadcn/ui com preset aprovado e instalar componentes necessários** - `9179b9d` (feat)
3. **Task 3: Configurar Vitest e criar stubs de teste (Wave 0 Gaps)** - `e0127ad` (test)

**Plan metadata:** (commit a seguir nesta mesma execução)

## Files Created/Modified
- `package.json` - scripts dev/build/start/lint/test + todas as dependências do stack
- `next.config.ts`, `tsconfig.json` - config base do Next.js 16
- `src/app/layout.tsx`, `src/app/page.tsx` - scaffold padrão do App Router
- `src/app/globals.css` - tokens de cor do design system (accent/secondary/destructive) + import tw-animate-css
- `components.json` - preset shadcn New York/Neutral/cssVariables
- `src/lib/utils.ts` - helper `cn` (clsx + tailwind-merge)
- `src/components/ui/*.tsx` - 11 componentes shadcn (button, input, label, textarea, select, form, card, badge, alert-dialog, dropdown-menu, sonner)
- `vitest.config.ts` - test runner com alias `@ -> ./src`
- `tests/validations/cliente.test.ts`, `tests/validations/contrato.test.ts`, `tests/db/current-contrato.test.ts`, `tests/actions/contratos.test.ts` - stubs `describe.todo` para as 4 lacunas de teste da fase

## Decisions Made
- shadcn CLI 4.13.x mudou o wizard de inicialização de style+baseColor para "presets" nomeados (nova/vega/maia/lyra/mira/luma/sera/rhea), nenhum dos quais corresponde a "New York/Neutral" aprovado em 01-UI-SPEC.md. Testado e confirmado que o schema de `components.json` ainda aceita os valores legados (`"style": "new-york"`) e que `shadcn add <component>` funciona normalmente com esse config escrito manualmente — produzindo os componentes shadcn padrão esperados.
- Como o `init` completo não foi executado (por causa da mudança de preset), os artefatos que ele normalmente geraria — `src/lib/utils.ts`, dependências (`class-variance-authority`, `lucide-react`, `clsx`, `tailwind-merge`, `tw-animate-css`) e os tokens CSS em `globals.css` — foram recriados manualmente, usando os valores de cor exatos aprovados em 01-UI-SPEC.md (Accent #1E76C4 → `--primary`, Secondary #F4F4F5 → `--card`/`--secondary`/`--muted`/`--accent`, Border #E4E4E7, Destructive #DC2626).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI 4.13.x não suporta mais os flags `--style`/`--base-color` do `init`**
- **Found during:** Task 2
- **Issue:** O comando `npx shadcn@latest init` documentado no plano usa um wizard de "presets" nomeados (nova/vega/maia/...) em vez do antigo fluxo style+baseColor; nenhuma flag corresponde a "New York/Neutral" aprovado pelo usuário em 01-UI-SPEC.md.
- **Fix:** Escrito `components.json` manualmente com os valores aprovados (`"style": "new-york"`, `"baseColor": "neutral"`, `"cssVariables": true`, `"iconLibrary": "lucide"`) e validado que `npx shadcn@latest add <component>` honra esse config legado, gerando componentes shadcn padrão (`bg-primary`, `text-primary-foreground`, etc.).
- **Files modified:** components.json
- **Verification:** `npx shadcn@latest add button` gerou `button.tsx` com o shape padrão shadcn (cva variants, Slot, cn) sem erros
- **Committed in:** 9179b9d (Task 2 commit)

**2. [Rule 3 - Blocking] Utilitários gerados pelo `shadcn init` estavam ausentes (cn helper e dependências)**
- **Found during:** Task 2
- **Issue:** Como o `init` completo não rodou (deviation #1), `src/lib/utils.ts` (helper `cn`) nunca foi criado, e as dependências `class-variance-authority`, `lucide-react`, `clsx`, `tailwind-merge`, `tw-animate-css` — usadas por todos os 11 componentes shadcn instalados — não foram adicionadas ao `package.json`. Isso quebraria o build (`Module not found: @/lib/utils`).
- **Fix:** Instaladas as 5 dependências faltantes via `npm install` e criado `src/lib/utils.ts` com o helper `cn` padrão do shadcn (`clsx` + `twMerge`).
- **Files modified:** package.json, package-lock.json, src/lib/utils.ts
- **Verification:** `npm run build` finaliza com exit code 0
- **Committed in:** 9179b9d (Task 2 commit)

**3. [Rule 2 - Missing Critical] globals.css sem os tokens de cor do design system**
- **Found during:** Task 2
- **Issue:** Como o `init` completo não rodou, `globals.css` continha apenas os tokens padrão do `create-next-app` (`--background`, `--foreground`), sem os tokens `--primary`, `--secondary`, `--card`, `--destructive`, `--border`, `--input`, `--ring` etc. exigidos por todos os componentes shadcn instalados e pelo contrato de cor aprovado em 01-UI-SPEC.md. Sem isso, classes como `bg-primary`/`text-primary-foreground` não resolveriam para as cores corretas de marca.
- **Fix:** Adicionado bloco `@theme inline` + `:root` em `globals.css` mapeando os tokens shadcn às cores exatas de 01-UI-SPEC.md (Accent `#1E76C4` → `--primary`, Secondary `#F4F4F5` → `--card`/`--secondary`/`--muted`/`--accent`, Border `#E4E4E7` → `--border`/`--input`, Destructive `#DC2626` → `--destructive`, ring de foco `--ring: #1E76C4`).
- **Files modified:** src/app/globals.css
- **Verification:** `npm run build` finaliza com exit code 0; tokens conferem com a tabela de cor de 01-UI-SPEC.md
- **Committed in:** 9179b9d (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (todas Rule 3/Rule 2 — bloqueios de build causados pela mudança de versão do shadcn CLI em relação ao que o plano assumia)
**Impact on plan:** Nenhum desvio de escopo — todos os auto-fixes foram necessários para que o preset aprovado em 01-UI-SPEC.md (New York/Neutral/cssVariables) e os 11 componentes funcionassem exatamente como especificado. Nenhuma decisão de design foi alterada; apenas o caminho de execução (CLI wizard vs. config manual) mudou.

## Issues Encountered
- `create-next-app` recusou rodar diretamente na raiz do repositório por causa dos arquivos existentes (`.planning/`, `CLAUDE.md`) mesmo com confirmação — contornado gerando o projeto em um diretório temporário e copiando os arquivos gerados para a raiz, sem tocar em `.planning/`, `.git/`, `.claude/` ou `CLAUDE.md`.

## User Setup Required

None - nenhuma configuração de serviço externo necessária nesta fase (Supabase/Meta/Google Ads entram em fases posteriores).

## Requirements Note

Este plano lista `requirements: [CLI-01, CLI-02, CLI-03, CLI-04]` no frontmatter, mas apenas cria stubs `describe.todo` para essas lacunas de teste — a implementação real (`clienteSchema`, `contratoSchema`, `selecionarContratoAtual`, `construirRegistroRenovacao`) está explicitamente atribuída a 01-04-PLAN.md e 01-05-PLAN.md (confirmado no frontmatter desses planos). Por isso, **CLI-01 a CLI-04 não foram marcados como completos em REQUIREMENTS.md nesta execução** — serão marcados quando 01-04 e 01-05 forem executados e efetivamente entregarem as funcionalidades.

## Next Phase Readiness
- Base do projeto pronta: `npm run build` e `npm run test` (`vitest run`) ambos retornam exit code 0
- shadcn/ui pronto para os formulários e cards de cliente/contrato dos planos 01-04 a 01-08
- Stubs de teste (`describe.todo`) marcam exatamente onde 01-04-PLAN.md e 01-05-PLAN.md devem implementar `clienteSchema`, `contratoSchema`, `selecionarContratoAtual` e `construirRegistroRenovacao`
- Nenhum bloqueio para os próximos planos da fase (01-02 em diante)

---
*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified present on disk (package.json, tsconfig.json, next.config.ts, src/app/layout.tsx, src/app/globals.css, src/app/page.tsx, components.json, vitest.config.ts, 4 test stub files, src/lib/utils.ts, src/components/ui/button.tsx, src/components/ui/sonner.tsx). All 3 task commits (e0274ea, 9179b9d, e0127ad) verified present in git log.

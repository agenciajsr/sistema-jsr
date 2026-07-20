# Deferred / Out-of-Scope Items — quick-260720-pev

Discovered during execution, NOT caused by this task's changes. Not fixed here
(out of scope: unrelated code, pre-existing environment/dependency state).

- **`npm run build` blocked by missing dependency `@react-pdf/renderer`**
  - `node_modules/@react-pdf/renderer` exists but is an **empty directory** — the
    package is declared in `package.json` (`"@react-pdf/renderer": "^4.5.1"`) but
    was never fully installed in this environment. Turbopack fails with
    `Module not found: Can't resolve '@react-pdf/renderer'` from
    `src/lib/contratos/pdf.tsx` (→ `actions/contratos.ts` → `contratos/page.tsx`
    and the `api/insights` route).
  - Untouched by this task (CAC touches none of that chain). Turbopack compiled
    every file authored by this task with **zero errors** before failing on this
    unrelated import; `tsc --noEmit` is clean for all CAC files; the full
    `src/lib/financeiro/` suite is green (80 tests).
  - Fix belongs to environment setup: `npm install` (or `npm install @react-pdf/renderer`)
    to complete the dependency tree. Then `npm run build` should pass.

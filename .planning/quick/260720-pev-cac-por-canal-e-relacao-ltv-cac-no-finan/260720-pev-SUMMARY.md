---
phase: quick-260720-pev
plan: 01
subsystem: financeiro
tags: [cac, ltv, aquisicao, financeiro, visao-executiva, tdd]
requires:
  - "src/lib/financeiro/executiva.ts (ltvMedio, ClienteVida)"
  - "clientes.origem_cliente (texto livre), contratos.data_inicio/valor_mensal"
provides:
  - "Tabela investimentos_aquisicao (migration 0039, NÃO aplicada)"
  - "Módulo puro src/lib/financeiro/cac.ts (CAC por canal, acumulado, LTV/CAC)"
  - "Actions getCacAquisicao / createInvestimentoAquisicao / listInvestimentosAquisicao"
  - "Aba Aquisição no /financeiro + cards CAC/LTV-CAC na Visão Analítica"
affects:
  - "src/actions/financeiro.ts"
  - "src/app/(app)/financeiro/page.tsx"
  - "src/app/(app)/financeiro/visao-analitica.tsx"
tech-stack:
  added: []
  patterns:
    - "Matemática em módulo puro testado (espelho de executiva.ts / calculos.ts)"
    - "Leitura da tabela nova em try/catch → null (degradação graciosa até a migration)"
    - "Fetch SEQUENCIAL fora dos Promise.all (regra do pool max=5)"
    - "Classificador heurístico texto-livre → canal canônico (origem não é enum)"
key-files:
  created:
    - "src/lib/financeiro/cac.ts"
    - "src/lib/financeiro/cac.test.ts"
    - "src/lib/validations/investimento-aquisicao.ts"
    - "drizzle/0039_investimentos_aquisicao.sql"
    - "scripts/aplicar-migration-0039.ts"
    - "src/app/(app)/financeiro/aquisicao-form.tsx"
  modified:
    - "src/lib/db/schema.ts"
    - "src/actions/financeiro.ts"
    - "src/app/(app)/financeiro/visao-analitica.tsx"
    - "src/app/(app)/financeiro/page.tsx"
decisions:
  - "CAC decoupled da migration 0038: getCacAquisicao NÃO lê clientes.data_encerramento; o LTV usado na relação aproxima a vida dos encerrados até hoje. Assim o CAC depende só da 0039."
  - "canal é uma lista canônica nossa (CANAIS_AQUISICAO); origem_cliente (texto livre) é casada por classificarCanal (keyword + fallback 'outro'), documentado em PREMISSA_CAC."
  - "CAC do canal = null (indefinido) quando 0 clientes ganhos, mesmo com investimento > 0 — nunca ÷0, nunca 0."
metrics:
  duration: "14min"
  completed: "2026-07-20T21:37:00Z"
  tasks: 3
  files: 10
---

# Phase quick-260720-pev Plan 01: CAC por canal e relação LTV/CAC Summary

Fecha a última peça da camada transversal do dashboard executivo do Financeiro: lançamento de investimento em aquisição por canal/mês, CAC por canal (mês + acumulado 3m/6m) e relação LTV/CAC, com toda a matemática num módulo puro testado (TDD) e degradação graciosa enquanto a migration 0039 não é aplicada.

## What Was Built

- **Fundação de dado (Task 1):** tabela `investimentos_aquisicao` (`canal`, `competencia 'YYYY-MM'`, `valor numeric(12,2)`, `notas`) com índice único `(canal, competencia)` para upsert 1-lançamento-por-canal/mês. Validator Zod `investimentoAquisicaoSchema` (canal ∈ `CANAIS_AQUISICAO`, `valor ≥ 0`, competência `AAAA-MM`). Migration `drizzle/0039_investimentos_aquisicao.sql` escrita à mão + `scripts/aplicar-migration-0039.ts` (molde do 0038) — **NÃO aplicada**.
- **Módulo puro `cac.ts` sob TDD (Task 2):** `CANAIS_AQUISICAO`/`ROTULO_CANAL`/`PREMISSA_CAC`, `classificarCanal` (origem texto livre → canal, acento/case-insensível, fallback `outro`), `cacPorCanal` / `cacAcumulado` (janela 3m/6m, espelho de `churnAcumulado`) e `relacaoLtvCac`. CAC indefinido (`null`) quando 0 clientes ganhos; todos os canais canônicos sempre presentes no resultado (o número não some). Zero import de db/auth/react. **19 testes** (RED antes, GREEN depois).
- **Ligação dado → cálculo → UI (Task 3):** `getCacAquisicao` (SEQUENCIAL fora dos `Promise.all`, `try/catch` → `null` se 0039 pendente, cálculo 100% delegado a `cac.ts`, LTV reusando `ltvMedio`), `createInvestimentoAquisicao` (upsert), `listInvestimentosAquisicao`. Aba **"Aquisição"** com tela dedicada (seletor de competência + valor por canal + histórico). Cards **"CAC — {canal}"** (valor do mês, helper `3m … · 6m …`, `—` + "sem cliente ganho no período") e card **"LTV/CAC"** (verde ≥3 / amarelo 1–3 / vermelho <1) na seção da Visão Analítica; aviso apontando `scripts/aplicar-migration-0039.ts` quando a migration está pendente.

## Verification

- `npx tsc --noEmit`: limpo para todos os arquivos deste plano (única exceção é um erro pré-existente e não relacionado — ver Deferred Issues).
- `npx vitest run src/lib/financeiro/cac.test.ts`: **19/19 verdes**. Suíte `src/lib/financeiro/`: **80/80 verdes**.
- Leitura manual: `getCacAquisicao()` é `await` SEQUENCIAL após o Lote 2, **fora** de qualquer `Promise.all` em `page.tsx`. Confirmado.
- Migration 0039 e `scripts/aplicar-migration-0039.ts` existem e **NÃO foram aplicados/executados**.

## Deviations from Plan

### Ambiente / Bloqueios (não causados por este plano)

**1. [Rule 3 - Blocking, out of scope] `npm run build` bloqueado por dependência ausente `@react-pdf/renderer`**
- **Found during:** Task 3 (verificação `npm run build`).
- **Issue:** `node_modules/@react-pdf/renderer` existe mas está **vazio** — o pacote é declarado em `package.json` (`^4.5.1`) porém não foi instalado neste ambiente. Turbopack falha com `Module not found` em `src/lib/contratos/pdf.tsx` (cadeia contratos/insights), arquivo **não tocado** por este plano.
- **Fix:** Nenhum aplicado — fora do escopo (SCOPE BOUNDARY): a falha é de setup de ambiente e não do código do CAC. Turbopack compilou **todos** os arquivos deste plano com zero erros antes de falhar nesse import; `tsc` limpo para os arquivos do CAC; 80 testes de financeiro verdes. Registrado em `deferred-items.md`.
- **Ação necessária no ambiente:** `npm install` (ou `npm install @react-pdf/renderer`) e então `npm run build` deve passar.

**2. [Setup] Worktree desalinhado com master no início**
- **Found during:** início da execução.
- **Issue:** o worktree isolado estava no commit `fcc45ca` (quick-260714-vy7), sem nenhuma das dependências que este plano exige (executiva.ts, `getVisaoExecutiva`, data_encerramento, transacao-form Dialog). O contexto do plano referencia o estado de master.
- **Fix:** `git reset --hard master` (worktree limpo, operação segura) para alinhar ao commit `22d6caf` antes de qualquer edição.

## Known Stubs

Nenhum. Todos os cards consomem dados reais (`getCacAquisicao`) ou degradam com aviso honesto quando a migration 0039 está pendente — nunca número inventado.

## Deferred Issues

Ver `deferred-items.md` nesta pasta: build depende de `npm install` do `@react-pdf/renderer` (pré-existente, ambiente).

## Follow-ups / Lembretes

- **Aplicar a migration 0039** (não aplicada por este plano):
  `npx tsx --env-file=.env.local scripts/aplicar-migration-0039.ts`
- A migration 0038 (`clientes.data_encerramento`, do quick-260719-wwm) segue pendente; não é pré-requisito do CAC, mas melhora a precisão do LTV usado na relação LTV/CAC quando aplicada.

## Commits

- `00412b2` test(quick-260720-pev): testes RED do CAC (classificador, cacPorCanal, acumulado, LTV/CAC)
- `2df63ac` feat(quick-260720-pev): módulo puro cac.ts (GREEN, 19 testes)
- `5cbbfcb` feat(quick-260720-pev): tabela investimentos_aquisicao + validação + migration 0039
- `5d1ba6d` feat(quick-260720-pev): actions CAC + aba Aquisição + cards CAC/LTV-CAC

## Self-Check: PASSED

Todos os 6 arquivos criados existem em disco; os 4 commits (`00412b2`, `2df63ac`, `5cbbfcb`, `5d1ba6d`) existem no histórico.

---
phase: quick-260714-ita
plan: 01
subsystem: financeiro
tags: [financeiro, analitica, kpis, renovacao, mrr, vitest]
requires:
  - src/components/stat-card.tsx
  - src/lib/date-br.ts
  - src/actions/financeiro.ts (getResumoFinanceiro)
provides:
  - "@/lib/financeiro/calculos (funcoes puras: variacao %, faixa despesa/faturamento, taxa de renovacao, dependencia de MRR, lucro/cliente, periodo do mes anterior, progresso do mes)"
  - "getVisaoAnalitica(mes, ano) — Server Action"
  - "VisaoAnaliticaData — tipo compartilhado action/UI"
  - "Aba 'Visao Analitica' em /financeiro"
affects:
  - src/app/(app)/financeiro/page.tsx
tech-stack:
  added: []
  patterns:
    - "Matematica financeira isolada em modulo puro (zero import de db/auth/react) => testavel sem banco; action e UI apenas consomem"
    - "Queries sequenciais dentro de action que ja roda em Promise.all (pool max=3)"
key-files:
  created:
    - src/lib/financeiro/calculos.ts
    - src/lib/financeiro/calculos.test.ts
    - src/app/(app)/financeiro/visao-analitica.tsx
  modified:
    - src/actions/financeiro.ts
    - src/app/(app)/financeiro/page.tsx
decisions:
  - "Divisao por zero nunca vira NaN/Infinity: variacao com anterior=0 => null; despesa/faturamento com receita=0 => null; renovacao 0/0 => 100%; lucro/cliente com 0 clientes => 0"
  - "Datas 'YYYY-MM-DD' comparadas como string (ISO lexicografico) e ancoradas em UTC (Date.UTC) — sem drift de fuso"
  - "VISAO_ANALITICA_VAZIA nao e exportada: 'use server' exige que todo export seja funcao async"
metrics:
  duration: ~18min
  tasks: 3
  files: 5
  completed: 2026-07-14
---

# Quick 260714-ita: Financeiro — Aba Visao Analitica + KPIs comparativos Summary

Aba "Visao Analitica" no /financeiro (taxa de renovacao, MRR previsto, receita avulsa, lucro/cliente, despesas vs faturamento por faixa e dependencia de MRR Top 5/Top 10) mais KPIs do Overview comparando com o mes anterior — tudo sobre dados que ja existiam, sem migration.

## O que foi feito

O /financeiro respondia "quanto entrou e quanto saiu neste mes". Agora responde tambem "isso e melhor ou pior que o mes passado?", "estou renovando contratos?", "quanto do meu faturamento depende de 5 clientes?" e "estou gastando demais em relacao ao que faturo?".

### Task 1 — Funcoes puras + testes (TDD) — commit `3428da5`

`src/lib/financeiro/calculos.ts` concentra toda a matematica: `calcularVariacaoPercentual`, `calcularDespesasVsFaturamento`, `contarRenovados`, `calcularTaxaRenovacao`, `calcularLucroPorCliente`, `calcularDependencia`, `periodoMesAnterior`, `progressoDoMes`. Zero import (nem db, nem auth, nem react) — verificado por grep.

Testes escritos ANTES da implementacao (RED confirmado: modulo inexistente => suite falhou; GREEN: 30/30). Cobrem os 4 casos de borda exigidos e mais: bordas exatas das faixas (60% ja e atencao, 80% ja e critico), virada de ano em `periodoMesAnterior(1, 2026)`, ano bissexto (`2024-02-29`), ordenacao desc da dependencia.

### Task 2 — Action `getVisaoAnalitica(mes, ano)` — commit `9e0e89e`

Segue o padrao das actions existentes: `getCurrentUser()` no topo, retorna estrutura zerada sem sessao, nunca lanca. Delega 100% da matematica ao modulo puro.

**Queries sequenciais de proposito** (sem `Promise.all` interno): o pool e `max=3` e a action roda dentro do `Promise.all` do lote 2 da pagina — paralelizar por dentro reintroduziria o travamento corrigido no quick 260713-usi. Verificado: as unicas ocorrencias de "Promise.all" no arquivo sao o comentario que explica isso.

Otimizacoes de round-trip: receita + despesa + receita avulsa do mes saem numa unica query agregada; a query de contratos posteriores so roda `if (vencidos.length > 0)`; o mes anterior reusa `getResumoFinanceiro` em vez de duplicar SQL.

### Task 3 — UI — commit `13c66f3`

`visao-analitica.tsx` e Server Component puro (sem `'use client'`, sem hooks). Design 100% reaproveitado — `StatCard`/`Card`/`Tabs` existentes e so cores semanticas (`chart-success`/`chart-warning`/`destructive`).

Em `page.tsx`: `getVisaoAnalitica(mes, ano)` entrou no `Promise.all` do LOTE 2 ja existente (continuam 2 lotes — nenhum lote 3 criado, `withRetry` e a tela de erro de ultimo recurso intactos). KPIs Receita Paga / Despesas Pagas / Lucro ganharam "mes ant. R$X" + variacao %; em Despesas o trend inverte a semantica (subir = vermelho) via `positive: variacao < 0`. "A Receber" mostra a contagem de cobrancas pendentes. Chip "Dia X/Y (Z%)" aparece so no mes corrente em Brasilia.

## Deviations from Plan

None - plan executed exactly as written.

Ajuste de contexto (nao de escopo): o worktree estava em `d0d1502`, atras do master. Confirmado ancestral limpo (`git merge-base --is-ancestor` => sim) e sem alteracoes pendentes, entao `git merge --ff-only master` alinhou em `f6869c2` antes de comecar — conforme a constraint do usuario.

## Verificacao

| Checagem | Resultado |
|---|---|
| `npx tsc --noEmit` | zero erros |
| `npx vitest run` | 97/97 (8 arquivos), incl. 30 de calculos.test.ts |
| `npm run build` | build de producao limpo, /financeiro compilada |
| `grep -c "Promise.all"` em page.tsx | 2 (lote 1 e 2 — sem lote 3) |
| `getVisaoAnalitica(mes, ano)` no LOTE 2 | presente (linha 77) |
| `Promise.all` dentro de getVisaoAnalitica | ausente (so o comentario) |
| `'use client'` em visao-analitica.tsx | ausente |
| imports de db/auth/react em calculos.ts | ausentes |
| `git status --short drizzle/` | vazio — zero migration |

## Known Stubs

Nenhum. Todos os numeros da aba vem do banco (contratos, transacoes, clientes).

## Notas para o futuro

- `getVisaoAnalitica` acrescenta ~5 queries sequenciais ao carregamento do /financeiro. Com ~10 clientes isso e irrelevante, mas se a pagina voltar a ficar lenta, ela e a primeira candidata a virar carregamento sob demanda (a aba so e vista quando clicada).
- A taxa de renovacao considera renovado o contrato vencido que tem um contrato do mesmo cliente comecando depois do vencimento. Um cliente que renova com atraso de meses ainda conta como renovado — proposital, mas vale revisar se a equipe quiser uma janela de tolerancia.

## Commits

| Task | Commit | Descricao |
|---|---|---|
| 1 | `3428da5` | funcoes puras de calculo financeiro + testes |
| 2 | `9e0e89e` | action getVisaoAnalitica(mes, ano) |
| 3 | `13c66f3` | aba Visao Analitica + KPIs com mes anterior |

## Self-Check: PASSED

Os 5 arquivos do plano + o SUMMARY existem em disco; os 3 commits existem no historico.

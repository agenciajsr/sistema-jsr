---
phase: quick-260717-dyb
plan: 01
subsystem: agenda, cobrancas, asaas
tags: [agenda, calendario, popover, cobranca-duplicada, asaas, sandbox]
requires: []
provides:
  - "Popover '+x mais' no calendario mensal com lista completa do dia"
  - "Geracao de cobrancas imune a duplicata quando ja existe cobranca manual"
  - "cancelarCobranca (DELETE /payments/:id) no client Asaas"
affects: [/agenda, cron sync-meta (gerarCobrancasMensais), fluxo de assinatura]
tech-stack:
  added: []
  patterns: ["Popover shadcn controlado por estado unico (popoverDiaAberto)", "ne(status,'cancelada') como trava primaria de competencias"]
key-files:
  created:
    - scripts/cancelar-cobranca-duplicada.ts
  modified:
    - src/components/agenda/agenda-calendario.tsx
    - src/lib/cobrancas/gerar.ts
    - src/lib/cobrancas/regras.test.ts
    - src/lib/asaas/client.ts
decisions:
  - "Competencia coberta por QUALQUER cobranca nao cancelada (manual ou automatica) — filtro criadoVia='automatico' removido das queries de gerar.ts; cancelada volta a ser gerada"
  - "onConflictDoNothing do indice unico parcial (so automaticas) permanece como segunda trava do fluxo automatico"
metrics:
  duration: "~25min"
  completed: "2026-07-17"
  tasks: 3
  files: 5
---

# Quick 260717-dyb: Agenda "+x mais" e visual do calendário + fix cobrança duplicada — Summary

**One-liner:** Popover clicável no "+x mais" do calendário (todos os compromissos do dia abrindo o dialog de edição) + polimento visual com dark mode; queries de geração de cobrança passam a considerar cobranças manuais (fim da duplicata do cron); duplicata real cba003b1 cancelada no Asaas sandbox e no banco.

## O que foi feito

### Task 1 — /agenda: Popover no "+x mais" e polimento visual (f434879)
- Chip "+x mais" virou `PopoverTrigger`; o `PopoverContent` (w-72) mostra o cabeçalho com a data por extenso em pt-BR e a lista de TODOS os compromissos do dia (horário + título + local), cada item clicável chamando o mesmo `abrirEvento` dos chips — abre o Dialog de edição existente. Estado único `popoverDiaAberto` fecha o Popover ao clicar num item.
- Visual: hoje com `bg-primary/5 dark:bg-primary/10`; hover `hover:bg-muted/40` na célula; chips com `border-l-2 border-primary`, `bg-primary/10 hover:bg-primary/15` + variantes `dark:`; células mensais `min-h-28`; faixa "Nenhum compromisso neste período." quando a grade está vazia.

### Task 2 — Fix cobrança duplicada (897721d)
- `gerarPrimeiraCobranca` e `gerarCobrancasMensais`: `eq(cobrancas.criadoVia, 'automatico')` → `ne(cobrancas.status, 'cancelada')`. Competência coberta por QUALQUER cobrança não cancelada; cancelada volta a ser gerada.
- Comentário de `gerarCobrancaDoMes` atualizado: índice único parcial segue como segunda trava.
- Regressão em `regras.test.ts` ("competência coberta por cobrança manual — regressão da duplicata de 2026-07") documentando que a query alimenta `competenciasPendentes` com todas as não canceladas. Suíte: 21 testes verdes.

### Task 3 — Cancelamento real da duplicata (3b9e2e9)
- `src/lib/asaas/client.ts`: `requisicao` aceita `DELETE`; nova export `cancelarCobranca(paymentId)`.
- `scripts/cancelar-cobranca-duplicada.ts` executado de verdade (`npx tsx --env-file=.env.local ...`), com guarda contra `ASAAS_ENV=production`.

**Saída do script:**

```
Ambiente Asaas: sandbox — baseUrl https://api-sandbox.asaas.com/v3
Cobrança encontrada: cliente="Jacson Ribeiro Sandbox" competência=2026-07 status=pendente payment=pay_alt9pinbxw0rlwaq
Asaas: payment pay_alt9pinbxw0rlwaq cancelado (DELETE ok).
Status final no banco: cancelada
```

**SELECT de confirmação no banco:** `status='cancelada'`, `asaas_payment_id='pay_alt9pinbxw0rlwaq'`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Worktree desatualizado (fcc45ca, 14/jul) sem os arquivos do plano**
- **Found during:** Início da execução
- **Fix:** `git merge --ff-only master` no worktree (agora em 7a1df23) antes de qualquer edição.
- **Commit:** — (operação git, sem diff)

Fora isso, plano executado exatamente como escrito.

## Verificação
- `npx vitest run src/lib/cobrancas` — 21 verdes.
- `npx tsc --noEmit` — limpo (após cada task).
- Nenhum `eq(cobrancas.criadoVia, 'automatico')` restante em gerar.ts.
- SELECT confirma `cancelada` na cobrança cba003b1.

## Known Stubs

Nenhum.

## Self-Check: PASSED
- src/components/agenda/agenda-calendario.tsx: FOUND
- src/lib/cobrancas/gerar.ts (ne status cancelada): FOUND
- src/lib/asaas/client.ts (cancelarCobranca): FOUND
- scripts/cancelar-cobranca-duplicada.ts: FOUND
- Commits f434879, 897721d, 3b9e2e9: FOUND

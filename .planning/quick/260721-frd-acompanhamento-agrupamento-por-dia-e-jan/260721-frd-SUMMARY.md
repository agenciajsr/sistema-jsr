---
quick_id: 260721-frd
title: Acompanhamento — agrupamento por dia e janela de período no fuso de Brasília
date: 2026-07-21
status: complete
---

# Quick Task 260721-frd — Summary

## O que foi feito

`src/app/(app)/acompanhamento/page.tsx`:

1. **`rotuloDia`** agora calcula o dia no fuso `America/Sao_Paulo`:
   compara `toLocaleDateString('en-CA', { timeZone })` do item contra `hojeBrasilia()`
   e `dataMenosDias(1)` para "Hoje"/"Ontem"; o rótulo completo é montado com
   `toLocaleDateString('pt-BR', { timeZone })` mantendo o formato `dd/MM/yyyy (EEEE)`.
2. **`resolverJanela`** ancora `inicioHoje` em `${hojeBrasilia()}T00:00:00-03:00`
   em vez de `new Date()`/getFullYear (que eram fuso do processo = UTC na Vercel).
   Brasil sem DST desde 2019, e a branch de `dia` explícito já usava `-03:00`.
3. Removidos imports não usados do date-fns (`format`, `isToday`, `isYesterday`,
   `ptBR`); adicionados `hojeBrasilia`/`dataMenosDias` de `@/lib/date-br` e a
   const `TZ`.

Resultado: o cabeçalho de dia e os filtros de período agora batem com o horário já
corrigido no 260721-fkj — um item de ~22h de Brasília não vaza mais para o dia seguinte.

## Verificação

- `npx tsc --noEmit -p tsconfig.json` → **No errors found** (exit 0).

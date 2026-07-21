---
quick_id: 260721-frd
title: Acompanhamento — agrupamento por dia e janela de período no fuso de Brasília
date: 2026-07-21
---

# Quick Task 260721-frd

## Contexto

Continuação do 260721-fkj. O horário do feed já foi corrigido para Brasília, mas o
**cabeçalho de dia** (`rotuloDia` → isToday/isYesterday/format do date-fns) e a
**resolução de janela de período** (`resolverJanela` com `new Date()`/getFullYear...)
ainda usavam o fuso do processo Node — UTC na Vercel. Efeito: itens de fim de noite
(BRT) caíam no dia seguinte no cabeçalho, e as janelas "hoje/ontem/7d/30d" tinham as
bordas deslocadas em 3h.

## Tarefas

### Tarefa única — mover cálculo de dia/janela para o fuso de Brasília
- **files:** `src/app/(app)/acompanhamento/page.tsx`
- **action:**
  1. `rotuloDia`: comparar a data do item em `America/Sao_Paulo` (`toLocaleDateString('en-CA', { timeZone })`) contra `hojeBrasilia()` e `dataMenosDias(1)` (helpers de `@/lib/date-br`); rótulo completo montado com `toLocaleDateString('pt-BR', { timeZone })` preservando o formato `dd/MM/yyyy (EEEE)`.
  2. `resolverJanela`: ancorar `inicioHoje` em `new Date(\`${hojeBrasilia()}T00:00:00-03:00\`)` (Brasil sem DST desde 2019; a branch de `dia` explícito já usava `-03:00`).
  3. Remover imports agora não usados de date-fns (`format`, `isToday`, `isYesterday`, `ptBR`); adicionar `hojeBrasilia`/`dataMenosDias`.
- **verify:** `npx tsc --noEmit` limpo; item de ~22h BRT agrupa no dia correto; filtros de período batem com o dia de Brasília.
- **done:** Agrupamento e janela no fuso de Brasília, consistentes com o horário exibido.

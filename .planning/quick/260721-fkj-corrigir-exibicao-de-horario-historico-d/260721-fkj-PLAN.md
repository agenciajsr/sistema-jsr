---
quick_id: 260721-fkj
title: Corrigir exibição de horário — histórico do card do lead (CRM) e fuso Brasília no acompanhamento
date: 2026-07-21
---

# Quick Task 260721-fkj

## Contexto

Dois ajustes de exibição de horário reportados pelo usuário:

1. **Card do lead (CRM)** — o histórico (timeline) mostrava só a data no cabeçalho
   do dia + tempo relativo ("3h"), sem o horário do relógio. Combinado que o horário
   de chegada deveria aparecer.
2. **Página de acompanhamento** — horário exibido em UTC (3h adiantado), não em
   horário de Brasília.

## Tarefas

### Tarefa 1 — Histórico do card do lead exibe horário
- **files:** `src/components/crm/ficha-lead.tsx`
- **action:** Na timeline do histórico, exibir `formatarHora(h.createdAt)` (helper já
  existente) empilhado com o tempo relativo no canto direito de cada item. Componente
  é `'use client'`, então `getHours()` usa o fuso do navegador (Brasília) — correto.
- **verify:** Cada item do histórico mostra HH:mm (ex.: 13:39) acima do tempo relativo.
- **done:** Horário visível por item.

### Tarefa 2 — Horário do acompanhamento em fuso de Brasília
- **files:** `src/app/(app)/acompanhamento/page.tsx`
- **action:** Substituir `format(item.quando, 'HH:mm')` (date-fns usa o fuso do
  processo Node = UTC na Vercel) por `item.quando.toLocaleTimeString('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })`, seguindo o
  padrão do projeto (`toLocale*` com `timeZone: 'America/Sao_Paulo'`).
- **verify:** `npx tsc --noEmit` limpo; horário exibido corresponde ao de Brasília.
- **done:** Horário no fuso correto.

## Notas / caveat

- O cabeçalho de dia da página de acompanhamento (`rotuloDia` → isToday/isYesterday/
  format) tem a MESMA raiz UTC e pode agrupar itens de fim de noite no dia seguinte.
  Fora do escopo deste fix (usuário reportou só o horário) — sinalizado para decisão.

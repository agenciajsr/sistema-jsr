---
quick_id: 260721-fkj
title: Corrigir exibição de horário — histórico do card do lead (CRM) e fuso Brasília no acompanhamento
date: 2026-07-21
status: complete
---

# Quick Task 260721-fkj — Summary

## O que foi feito

1. **`src/components/crm/ficha-lead.tsx`** — timeline do histórico agora exibe o
   horário (`formatarHora(h.createdAt)`, HH:mm) empilhado acima do tempo relativo em
   cada item. Reaproveitou o helper já existente. Componente `'use client'`, então o
   horário sai no fuso do navegador (Brasília).

2. **`src/app/(app)/acompanhamento/page.tsx`** — troca de `format(item.quando,'HH:mm')`
   (date-fns → fuso do processo Node = UTC na Vercel) por
   `toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', ... })`. Corrige o
   horário que aparecia 3h adiantado. Import de `format` mantido (ainda usado em
   `rotuloDia`).

## Verificação

- `npx tsc --noEmit -p tsconfig.json` → **No errors found** (exit 0).

## Caveat pendente (não corrigido — fora do escopo reportado)

- O cabeçalho de dia do acompanhamento (`rotuloDia`) e a resolução da janela
  (`resolverJanela` com `new Date()`) usam o fuso do processo (UTC na Vercel). Mesma
  raiz do bug do horário; pode agrupar/rotular itens de fim de noite no dia errado.
  Não tocado porque o usuário reportou apenas o horário. Sinalizado para decisão.

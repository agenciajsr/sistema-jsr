---
quick_id: 260721-ufb
title: Seção "Interno / Agência" na lista de clientes (perfil mãe editável)
date: 2026-07-21
status: complete
---

# Quick Task 260721-ufb — Summary

## Objetivo

O perfil interno (JSR Agência) estava escondido da lista de clientes (filtro
interno=false do quick 260721-jub), então não havia como editá-lo pela tela — o
usuário precisa ajustar objetivo/nicho/metas que alimentam o Tráfego/Campanhas.
Decisão do usuário: **Opção A** — seção "Interno" na própria lista de clientes.

## O que foi feito

- **`src/lib/clientes/lista.ts`** — nova `getClientesInternos()`: busca leve e
  separada (id, nome) dos perfis interno=true. Não lança (degrada p/ []).
- **`src/app/(app)/clientes/page.tsx`** — busca os internos SEQUENCIALMENTE (fora de
  qualquer Promise.all — pool max=5) e passa para a lista.
- **`clientes-lista.tsx`** — nova seção "Interno / Agência" no rodapé, renderizada só
  quando há internos, com badge "Interno" + botão Editar por perfil. Fica FORA das
  abas/contagens do negócio (contarPorStatus/filtrarClientes seguem só sobre os
  clientes interno=false). Empty-state só quando não há nem negócio nem internos.
- **`clientes/[id]/editar/page.tsx`** — defaultValues passa a incluir `interno`.
  ⚠️ Correção de bug latente: sem isto, o campo caía no `default(false)` do Zod e
  salvar o perfil mãe o DESMARCARIA (voltaria à lista de negócio + métricas).

## Verificação

- `npx tsc --noEmit -p tsconfig.json` → No errors found.
- `npx vitest run` → 649 pass / 0 fail.

## Contexto (parte de um trio de ajustes do perfil mãe, 2026-07-21)

1. ✅ Objetivo do perfil mãe corrigido p/ Leads (update direto no banco — não é code).
2. ✅ ESTE: seção Interno + edição do perfil mãe.
3. ⏳ PENDENTE (maior): forma de pagamento nas Verbas (funding_source do Meta vem
   null p/ todas as contas — precisa migrar p/ funding_source_details{type} + re-sync).

Ponto sobre "Performance geral não mostra todos os clientes": diagnosticado como
NÃO-bug — a Maiane não aparece por não ter conta de anúncio (cliente só de CRM);
o perfil interno é excluído de propósito. Aguardando o usuário confirmar.

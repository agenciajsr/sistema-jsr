---
phase: quick-260720-re3
plan: 01
subsystem: financeiro
tags: [cac, crm, atribuicao-de-canal, dialog, tdd]
requires:
  - src/lib/financeiro/cac.ts (classificarCanal, agregar, CanalAquisicao)
  - src/lib/crm/origem.ts (valores canônicos de origem do CRM)
  - crm_oportunidades / crm_contatos (colunas cliente_id, origem, updated_at, created_at)
  - src/app/(app)/financeiro/transacao-form.tsx (padrão de Dialog)
provides:
  - canalDaOrigemCrm (mapa CRM→canal)
  - resolverCanalCliente (cadeia CRM→reserva de texto livre→'outro')
  - PREMISSA_CAC_ATRIBUICAO (documentação da cadeia)
  - getCacAquisicao atribuindo canal pela origem estruturada do CRM
  - aba Aquisição com formulário em Dialog centralizado
affects:
  - CAC por canal na Visão Analítica do Financeiro
  - Painel (chips derivados do CAC, indiretamente)
tech-stack:
  added: []
  patterns:
    - Cadeia de atribuição híbrida (origem estruturada do CRM → reserva de texto livre)
    - Queries de CRM SEQUENCIAIS fora do Promise.all em try/catch de degradação
key-files:
  created: []
  modified:
    - src/lib/financeiro/cac.ts
    - src/lib/financeiro/cac.test.ts
    - src/actions/financeiro.ts
    - src/app/(app)/financeiro/aquisicao-form.tsx
decisions:
  - Instagram no CRM é ORGÂNICO (o Meta pago é meta_lead_ad); Google não existe como origem no CRM, só chega pela reserva de texto livre
  - Origens CRM não-pagas (landing_page/whatsapp/evento/parceria/manual/outro) → null, deixando a reserva decidir
  - Keyword 'indica' ampliada para 'indic' para captar "Amigo indicou" no texto livre
metrics:
  duration: 12min
  completed: 2026-07-20
  tasks: 3
  files: 4
---

# Phase quick-260720-re3 Plan 01: CAC via origem do CRM + form Dialog na aba Aquisição Summary

Atribuição de canal do CAC agora é híbrida: descobre o canal PRIMEIRO pela origem estruturada do CRM (oportunidade vinculada → contato vinculado, mapeadas por `canalDaOrigemCrm`), com reserva no texto livre `clientes.origem_cliente` quando não há vínculo ou a origem estruturada não identifica um canal pago; e o formulário da aba Aquisição virou um Dialog centralizado no padrão de `transacao-form.tsx`, com o histórico de lançamentos permanecendo visível fora do Dialog.

## What Was Built

### Frente 1 — Lógica pura (TDD)
- `canalDaOrigemCrm(origemCrm)`: mapa explícito CRM→canal — `meta_lead_ad`→`meta_ads`, `indicacao`→`indicacao`, `prospeccao_fria`→`prospeccao`, `instagram`→`organico`. Qualquer outra origem (landing_page, whatsapp, evento, parceria, manual, outro, null, desconhecida) → `null`.
- `resolverCanalCliente(origemCrm, origemTextoLivre)` = `canalDaOrigemCrm(origemCrm) ?? classificarCanal(origemTextoLivre)` — a cadeia/reserva, com fallback final `'outro'` garantido pelo classificador.
- `ClienteGanho.origemCrm?` opcional (preserva os 19 testes antigos que passam só `origem`); `agregar()` passou a usar `resolverCanalCliente`.
- `PREMISSA_CAC_ATRIBUICAO` exportada documentando a cadeia.

### Frente 1 — Wiring
- `getCacAquisicao` lê `crm_oportunidades` e `crm_contatos` em queries SEQUENCIAIS (fora do Promise.all da página, regra do pool max=5), agregadas por cliente pela origem MAIS RECENTE (`updatedAt desc, createdAt desc`), dentro de um try/catch de degradação graciosa (CRM ausente → mapas vazios → cai 100% na reserva).
- `origemCrm` resolvido pela cadeia de vínculo (oportunidade → contato → null) é injetado em cada `ClienteGanho`. Nenhuma migration nova.

### Frente 2 — UI Dialog
- Botão "Lançar investimento" abre um Dialog centralizado (`sm:max-w-2xl`, scroll) com competência + inputs por canal e footer Cancelar/Salvar; `onSalvar` fecha o Dialog no sucesso.
- O Card "Histórico de lançamentos" permanece visível na aba, fora do Dialog. Lógica de valores/competência intacta.

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Lógica pura — canalDaOrigemCrm + resolverCanalCliente sob TDD | 9132e4f |
| 2 | Wiring — getCacAquisicao resolve canal via origem do CRM (sequencial) | da2cdb6 |
| 3 | UI — aquisicao-form vira Dialog centralizado, histórico fora | ca136a0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Keyword 'indica' não captava "Amigo indicou"**
- **Found during:** Task 1 (GREEN)
- **Issue:** O must-have truth do plano exige que "'Amigo indicou' vira indicação", mas a keyword existente `'indica'` não é substring de "indicou" (i-n-d-i-c-o-u), fazendo `classificarCanal('Foi um amigo que indicou')` retornar `'outro'`.
- **Fix:** Ampliada a keyword de `'indica'` para `'indic'`, que captura indicação/indicado/indicou.
- **Files modified:** src/lib/financeiro/cac.ts
- **Commit:** 9132e4f
- **Regressão:** Os 19 testes anteriores usam "indicação"/"indicado", ambos ainda casam com `'indic'` — seguem verdes.

## Verification

- `npx vitest run src/lib/financeiro/cac.test.ts` — 27 testes verdes (19 antigos + 8 novos: 3 de `canalDaOrigemCrm`, 5 de `resolverCanalCliente`).
- `npx tsc --noEmit` — sem erros em cac.ts, financeiro.ts, aquisicao-form.tsx.
- Revisão manual: queries do CRM em `getCacAquisicao` são SEQUENCIAIS (fora do Promise.all) e em try/catch de degradação; nenhuma migration nova criada.

## Known Stubs

Nenhum. As funções recebem origens já lidas do banco; o módulo puro não importa db/crm/react.

## Self-Check: PASSED

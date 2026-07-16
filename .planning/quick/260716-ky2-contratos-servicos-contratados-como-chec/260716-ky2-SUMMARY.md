---
phase: quick-260716-ky2
plan: 01
subsystem: contratos
tags: [contratos, servicos, checklist, jsonb, pdf, autentique, mrr]
requires: [quick-260716-i87]
provides:
  - "Coluna contratos.servicos (jsonb nullable, migration 0031 aditiva)"
  - "Módulo puro servicos-contratados.ts (schema Zod, soma, rótulos, objeto)"
  - "Checklist de serviços com valor individual nos dois dialogs"
  - "Texto/PDF do contrato dinâmico por serviços; badges em /contratos"
affects: [crm-conversao, contratos-tabela, contratos-pdf, financeiro-mrr-futuro]
tech-stack:
  added: []
  patterns: ["jsonb estruturado com fallback legado", "degradação graciosa por migration pendente"]
key-files:
  created:
    - drizzle/0031_contratos_servicos.sql
    - scripts/aplicar-migration-0031.ts
    - src/lib/contratos/servicos-contratados.ts
    - src/lib/contratos/servicos-contratados.test.ts
    - src/components/contratos/servicos-checklist.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/validations/contrato.ts
    - src/actions/crm.ts
    - src/actions/contratos.ts
    - src/components/crm/converter-cliente-dialog.tsx
    - src/components/contratos/editar-contrato-dialog.tsx
    - src/lib/contratos/variaveis.ts
    - src/lib/contratos/variaveis.test.ts
    - src/lib/contratos/template-trafego.ts
    - src/lib/contratos/pdf.tsx
    - src/app/(app)/contratos/preview/[id]/page.tsx
    - src/app/(app)/contratos/tabela-contratos.tsx
decisions:
  - "Checklist + plataformas (NÃO pacotes) — decisão travada do usuário"
  - "valorMensal SEMPRE recalculado no servidor como soma dos serviços"
  - "servico (text legado) sincronizado com o 1º serviço marcado — compat com telas antigas"
  - "Título dinâmico: multi-serviço = 'MARKETING DIGITAL'; só-tráfego/legado mantém o original"
  - "Coluna Serviços adicionada à tabela /contratos (extensão da ordem LOCKED da Fase 4)"
metrics:
  duration: ~45min
  completed: 2026-07-16
---

# Quick 260716-ky2: Serviços contratados como checklist no contrato — Summary

Serviços do contrato estruturados em jsonb `[{servico, valor, plataformas?}]` com checklist (valor por serviço, Meta/Google obrigatórios no tráfego pago), total = soma calculada no servidor, cláusula do objeto e composição de valor dinâmicas no texto/PDF, badges em /contratos — dado pronto para MRR por serviço.

## O que foi feito

1. **Migration 0031 + módulo puro (TDD)** — `ALTER TABLE contratos ADD COLUMN IF NOT EXISTS servicos jsonb` (100% aditiva, nullable = legado). Módulo `servicos-contratados.ts`: `servicosContratadosSchema` (min 1, sem duplicado, plataformas 1+ só no tráfego pago), `somaServicos` (2 casas), `rotuloPlataformas`, `descricaoObjetoServicos`, rótulos pt-BR acentuados p/ UI. 15 testes (RED→GREEN commitados).
2. **Checklist nos dialogs** — componente compartilhado `ServicosChecklist` usado na conversão Ganho→Cliente e na edição de contrato. Conversão grava `servicos` + `valorMensal = soma` + `servico = servicos[0]`. Edição: contrato estruturado abre fiel; legado pré-popula 1 item e, se o usuário NÃO tocar, nada muda (retrocompatível).
3. **Texto/PDF + listagem** — `montarVariaveisContrato` expõe `servicos` e `linhasValorPorServico`; cláusula 1ª numera 1.1.N por serviço (itens operacionais de tráfego só quando há tráfego pago), 2.2 traz a composição com 2+ serviços; título dinâmico em preview/PDF/HTML; `/contratos` ganhou coluna Serviços com badges (dark: ok). Legado gera texto IDÊNTICO ao atual (testado).

## Verificação

- `npx vitest run` → **402 testes verdes** (24 novos deste plano)
- `npx tsc --noEmit` → sem erros

## Pendências (para o orquestrador)

- **Aplicar a migration 0031 no banco de produção** (NÃO executada aqui, por instrução): `npx tsx --env-file=.env.local scripts/aplicar-migration-0031.ts` (confere 0029/0030 antes; nunca `drizzle-kit migrate`).
- **Ordem de deploy**: aplicar a 0031 ANTES do deploy — `getContratosDoCliente` usa `findMany` (seleciona todas as colunas do schema, incluindo `servicos`) e quebraria com a coluna ausente. Os demais pontos (listagem, preview, envio, conversão) têm degradação graciosa.

## Desvios do plano

1. **[Rule 3 - Bloqueio] node_modules ausente no worktree** — `tsc` falhava (`@react-pdf/renderer` não encontrado); rodado `npm install`. Sem mudança de código.
2. **Migration não aplicada** — o passo 6 da Task 1 pedia aplicar; a constraint do orquestrador determinou deixar o script pronto e a aplicação manual depois. Registrado acima.
3. **Coluna nova na tabela /contratos** — a ordem de colunas era "LOCKED" (Fase 4); o próprio plano exige exibir serviços, então a coluna "Serviços" foi inserida após "Tipo" (comentário atualizado).

## Known Stubs

Nenhum — sem placeholders; contratos legados usam fallback intencional (`servico` + `valorMensal`), resolvido pela própria estrutura ao editar.

## Commits

- f6139ff `test(quick-260716-ky2)` — testes falhando do módulo (RED)
- a4df3eb `feat(quick-260716-ky2)` — módulo puro de serviços contratados (GREEN)
- 11f4b4b `feat(quick-260716-ky2)` — migration 0031 aditiva + script + schema
- 666b382 `feat(quick-260716-ky2)` — checklist nos dialogs + actions
- 901f1bb `feat(quick-260716-ky2)` — texto/PDF dinâmico + badges na tabela

## Self-Check: PASSED

Arquivos criados e 5 commits confirmados no repositório (16/07/2026).

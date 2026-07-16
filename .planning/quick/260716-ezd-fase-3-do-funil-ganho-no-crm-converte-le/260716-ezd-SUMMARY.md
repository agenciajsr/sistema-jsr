---
phase: quick-260716-ezd
plan: 01
subsystem: crm
tags: [crm, funil, conversao, clientes, drizzle]
requires: [quick-260715-0zf, quick-260715-e8w]
provides:
  - Conversão Ganho → Cliente lead-first (action converterOportunidadeEmCliente)
  - Dialog "Converter em cliente?" no fluxo de Ganho do kanban
  - Migration 0028 aditiva (cliente_id em crm_contatos) — GERADA, NÃO aplicada
affects: [/crm, /clientes]
key-files:
  created:
    - src/lib/crm/conversao.ts
    - src/lib/crm/conversao.test.ts
    - src/components/crm/converter-cliente-dialog.tsx
    - drizzle/0028_crm_contatos_cliente_id.sql
  modified:
    - src/lib/db/schema.ts
    - src/actions/crm.ts
    - src/lib/crm/dados.ts
    - src/components/crm/kanban-crm.tsx
    - drizzle/meta/_journal.json
    - drizzle/meta/0023_snapshot.json
decisions:
  - "Conversão é action SEPARADA (converterOportunidadeEmCliente), não flag em ganharOportunidade — o ganho já aconteceu quando o dialog roda; cancelar não desfaz nada"
  - "Idempotência em 3 níveis: oportunidade.clienteId → contato.clienteId → empresa.clienteId; nunca duplica cliente"
  - "Degradação graciosa: enquanto a migration 0028 não for aplicada, o select/update de crm_contatos.cliente_id falha com warn e a conversão segue (idempotência por contato só após aplicar)"
metrics:
  duration: ~15min
  completed: 2026-07-16
  tasks: 2 de 3 (task 3 é checkpoint humano)
---

# Quick 260716-ezd: Fase 3 do funil — Ganho no CRM converte lead em cliente — Summary

**One-liner:** Conversão lead-first Ganho → Cliente: action idempotente em 3 níveis + dialog de oferta pós-ganho no kanban, com migration aditiva 0028 (cliente_id em crm_contatos) gerada e pendente de aplicação manual.

## O que foi feito

### Task 1 — Backend lead-first (TDD)
- **Commits:** `4ba9fee` (testes RED), `90d4ceb` (implementação GREEN)
- Módulo puro `src/lib/crm/conversao.ts` (zero import de db/auth/react):
  - `clienteExistenteDe({ contato, empresa })` — prioriza contato.clienteId sobre empresa.clienteId
  - `dadosClienteDe({ contato, empresa })` — nome = empresa ?? contato; status `aguardando_inicio`; nicho `negocio_local`; null se sem contato nem empresa
  - 11 testes em `conversao.test.ts` (lead-first, contato+empresa, já convertido, empresa já cliente, inválido)
- Coluna `clienteId` em `crmContatos` (schema) + migration `drizzle/0028_crm_contatos_cliente_id.sql` — APENAS `ALTER TABLE ... ADD COLUMN` + FK, **NÃO aplicada**
- Action `converterOportunidadeEmCliente(oportunidadeId)` em `src/actions/crm.ts`:
  - auth + workspace + recusa se status !== 'ganha'
  - idempotente em 3 níveis; vincula cliente_id em oportunidade/contato/empresa com updates SEQUENCIAIS (nunca Promise.all)
  - degradação graciosa enquanto a coluna não existe em produção (warn + segue)
  - atividade na timeline ('Convertido em cliente da carteira' / 'Vinculado a cliente existente da carteira') + revalidatePath /crm e /clientes
- `ganharOportunidade(id, opts)` mantida intacta (compatibilidade)

### Task 2 — UI (dialog no kanban)
- **Commit:** `890bd66`
- `converter-cliente-dialog.tsx`: título "Negócio ganho! Converter em cliente?", preview dos dados do lead (nome/empresa/telefone), botões "Agora não" e "Converter em cliente" (useTransition), toasts com ação "Abrir ficha" → `/clientes/{id}`; `jaExistia` → "Este lead já é cliente."
- `kanban-crm.tsx`: estado `conversaoPendente`; após `moverParaGanho` com sucesso abre o dialog — **só se o card ainda não tem clienteId**; drop nunca fica condicionado ao dialog
- `OportunidadeCard.clienteId` adicionado em `src/lib/crm/dados.ts` (CAMPOS_CARD/LinhaCard/montarCard) — sem query extra

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Migration gerada veio contaminada pelo snapshot desatualizado do Drizzle**
- **Found during:** Task 1 (npx drizzle-kit generate)
- **Issue:** o snapshot do Drizzle estava atrás das migrations manuais 0026/0027 — o SQL gerado incluía `CREATE TABLE automacoes` e `ADD COLUMN produtos` (já existem em produção)
- **Fix:** SQL editado para conter APENAS o ALTER aditivo de crm_contatos; arquivo renomeado para `0028_crm_contatos_cliente_id.sql` (convenção do projeto) e tag do `_journal.json` ajustada; o snapshot novo (`drizzle/meta/0023_snapshot.json`) foi mantido — ele apenas põe o estado do Drizzle em dia com a realidade
- **Commit:** 90d4ceb

**2. Worktree atrasado em relação ao master** — fast-forward `fcc45ca..9aa1821` antes de começar (o plano referencia código dos commits 260715-*).

## Task 3 — CHECKPOINT HUMANO (pendente, para o dono)

A migration **0028 NÃO foi aplicada** (regra do projeto: nunca drizzle-kit migrate/push). Passos manuais:

1. **Aplicar o SQL** de `drizzle/0028_crm_contatos_cliente_id.sql` no banco — padrão do projeto: script Node pontual com DIRECT_URL dentro de `sql.begin()` (modelo: `scripts/aplicar-migration-0024.ts`) ou editor SQL do Supabase. Conferir antes no information_schema que `crm_contatos.cliente_id` ainda não existe.
2. **Deploy:** `git push origin master` (após merge do worktree).
3. **Validar na /crm:** arrastar negócio de teste para Ganho → dialog aparece → confirmar → toast com "Abrir ficha" → cliente em /clientes com status "Aguardando início" e dados do lead.
4. **Idempotência:** ganhar outro negócio do MESMO contato → não cria segundo cliente; mostra "Este lead já é cliente."

Obs.: o código funciona ANTES da migration (degradação graciosa) — mas a idempotência por contato só vale depois de aplicá-la.

## Verificação

- `npx vitest run` — suíte inteira verde (inclui os 11 novos de conversao.test.ts)
- `npx tsc --noEmit` — limpo
- Migration 0028 contém apenas ALTER TABLE aditivo; NÃO aplicada
- Nenhum Promise.all novo em actions; UI 100% em português com tokens do tema

## Known Stubs

Nenhum — não há dados mockados nem placeholders neste plano.

## Self-Check: PASSED

- src/lib/crm/conversao.ts — FOUND
- src/lib/crm/conversao.test.ts — FOUND
- src/components/crm/converter-cliente-dialog.tsx — FOUND
- drizzle/0028_crm_contatos_cliente_id.sql — FOUND
- Commits 4ba9fee, 90d4ceb, 890bd66 — FOUND

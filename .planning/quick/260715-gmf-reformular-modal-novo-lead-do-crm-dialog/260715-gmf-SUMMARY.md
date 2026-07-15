---
phase: quick-260715-gmf
plan: 01
subsystem: crm
tags: [crm, tags, dialog, lead, migration]
requires: [quick-260715-e8w]
provides:
  - Sistema de tags do CRM (crm_tags + crm_contato_tags, paleta CORES_TAG)
  - Dialog centralizado "Criar novo Lead" com 4 abas (imagens 07-11)
  - leadSchema/criarLead persistindo perfil completo (site, nascimento, endereço, notas, tags)
affects: [crm]
tech-stack:
  added: []
  patterns:
    - "Cor de tag = CHAVE da paleta no banco; classes Tailwind resolvidas na UI (classesCorTag)"
    - "TabsContent forceMount + data-[state=inactive]:hidden preserva o estado do RHF entre abas"
key-files:
  created:
    - drizzle/0021_crm_tags_lead_endereco.sql
    - scripts/aplicar-migration-0021.ts
    - src/lib/crm/tags.ts
    - src/actions/crm-tags.ts
    - src/components/ui/dialog.tsx
    - src/components/crm/tags-select.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/validations/crm.ts
    - src/lib/validations/crm.test.ts
    - src/actions/crm-lead.ts
    - src/components/crm/novo-lead-dialog.tsx
decisions:
  - "dialog.tsx entrou no registry (Radix via pacote radix-ui, estilo do sheet) — SUBSTITUI a decisão antiga de Card inline para o Novo Lead"
  - "cor da tag salva como chave ('violet', 'green'...) e nunca classe/hex — trocar o visual não exige migration"
  - "dataNascimento usa opcionalDataReal (refine de dia real do calendário): '2000-13-99' passa no regex mas é rejeitada"
metrics:
  duration: ~25min
  tasks: 3
  files: 11
  completed: 2026-07-15
---

# Quick 260715-gmf: Reformular modal Novo Lead do CRM (Dialog) Summary

Dialog centralizado "Criar novo Lead" fiel às imagens 07-11, com sistema de tags completo (criação inline, badges coloridas) e 4 abas persistindo o perfil rico do lead em crm_contatos/crm_contato_tags — migration 0021 aplicada na mão em transação.

## O que foi feito

### Task 1 — Schema + migration 0021 (commit 6e245b8)
- `crmTags` (workspace, nome, cor = chave da paleta, unique workspace+nome) e `crmContatoTags` (junção N:N, unique contato+tag) no schema.
- Colunas nullable `pais`, `numero`, `complemento`, `bairro` em `crm_contatos` (cep/endereco/cidade/estado/site/notas/documento/dataNascimento já existiam).
- SQL manual idempotente (`IF NOT EXISTS`) em `drizzle/0021_crm_tags_lead_endereco.sql`; aplicado via `scripts/aplicar-migration-0021.ts` (DIRECT_URL, `sql.begin()`, aborta se crm_tags já existir, confirma via information_schema). **NUNCA drizzle-kit migrate.** Confirmado: 2 tabelas + 4 colunas no banco.

### Task 2 — Validação + actions, sob TDD (commits de1fa74 RED, 7eda307 GREEN)
- `leadSchema` ampliado: site, dataNascimento (com `opcionalDataReal` — rejeita dia inexistente), pais/cep/endereco/numero/complemento/bairro/cidade/estado, notas, `tagIds: uuid[] default []`. Refine "email OU telefone" intacto.
- `tagSchema` + paleta `CORES_TAG` (8 cores) em `src/lib/crm/tags.ts` (módulo comum, não 'use server').
- `src/actions/crm-tags.ts`: `listarTags` (ordem alfabética) e `criarTag` (trim, dedup case-insensitive antes do insert, cor validada contra a paleta), padrão `{data}|{error}` + revalidatePath.
- `criarLead`: insert do contato novo com todos os campos; merge conservador (só preenche null) para lead existente; vínculos em `crm_contato_tags` numa query com `onConflictDoNothing`; `getFichaLead` devolve os 4 campos novos.
- 5 testes novos no `crm.test.ts` — suíte: 1172 testes verdes.

### Task 3 — UI Dialog (commit c5b82f1)
- `src/components/ui/dialog.tsx` escrito manualmente sobre `Dialog` do pacote `radix-ui` (mesmo estilo do sheet.tsx) — substitui a decisão antiga de Card inline.
- `tags-select.tsx`: trigger tipo select com badges das escolhidas, painel com "Pesquisar...", lista de badges coloridas (clique alterna), link "Criar" que cria a tag inline com o texto da busca e cor ciclada; clique-fora fecha; `listarTags` na primeira abertura.
- `novo-lead-dialog.tsx` reescrito: título "Criar novo Lead", X (close nativo do DialogContent), Nome + Tags no topo, Tabs com `forceMount` + `data-[state=inactive]:hidden` (trocar de aba NÃO perde valores), abas Contato (🇧🇷 +55 prefixo fixo + máscara, E-mail, Site) / Dados Pessoais (Documento mascarado, Empresa, Origem, Data de Nascimento) / Endereço (País default Brasil, CEP, Endereço/Número/Complemento, Bairro/Cidade/UF) / Anotações (textarea); seção Negócio (Serviço/Valor/Tipo de receita/Etapa) após Separator; aviso de lead existente, onInvalid do refine, reset ao fechar, router.refresh() e botão azul "Confirmar" preservados. `crm-view.tsx` não precisou mudar (mesmas props).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] opcionalData aceitava data inexistente ('2000-13-99')**
- **Found during:** Task 2 (teste RED exigido pelo plano falhou por isso)
- **Issue:** o helper existente só valida o FORMATO YYYY-MM-DD, não o dia real
- **Fix:** novo `opcionalDataReal` (refine round-trip via Date UTC) usado só em dataNascimento — `opcionalData` intacto para os usos existentes
- **Files modified:** src/lib/validations/crm.ts
- **Commit:** 7eda307

Fora isso, plano executado como escrito (shadcn CLI foi pulado de propósito: o plano previa fallback manual e o padrão `radix-ui` do repo difere do que o CLI geraria).

## Known Stubs

- Select de País tem só "Brasil" e "Outro" — intencional: o mockup mostra default Brasil e a JSR atende só o Brasil; ampliar a lista é trivial se um dia precisar.

## Verificação

- `npm test`: 1172 testes verdes (5 novos do leadSchema).
- `npx tsc --noEmit`: limpo. `npm run build`: sucesso.
- Migration 0021 confirmada no banco via information_schema (crm_tags, crm_contato_tags, pais/numero/complemento/bairro).
- Fluxo manual (criar lead com abas + tags, repetir email → aviso) fica para verificação visual do usuário na próxima abertura do /crm.

## Self-Check: PASSED

- Arquivos criados existem (dialog.tsx, tags-select.tsx, crm-tags.ts, tags.ts, 0021.sql, script).
- Commits 6e245b8, de1fa74, 7eda307, c5b82f1 presentes no log.

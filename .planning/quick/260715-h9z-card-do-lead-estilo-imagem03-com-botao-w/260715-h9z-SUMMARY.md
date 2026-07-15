---
phase: quick-260715-h9z
plan: 01
subsystem: crm
tags: [crm, kanban, lead, whatsapp, ficha, atividades, supabase-storage]
requires:
  - quick-260715-e8w (CRM lead-first, board drag-and-drop)
  - quick-260715-gmf (tags crm_tags/crm_contato_tags, dialog.tsx)
provides:
  - Card do Kanban fiel a imagem03 com botao WhatsApp e tags
  - Ficha completa do lead em dois paineis (imagens 04-06)
  - Atividades agendaveis em crm_tarefas (inicio/fim/prioridade)
  - Foto do lead com upload real (bucket publico crm-fotos)
  - Eventos de tag no historico (tag_adicionada/tag_removida)
affects: [/crm]
tech-stack:
  added: []
  patterns:
    - "uploadFile de storage/client aceita opts { bucket, path, upsert } (retrocompativel)"
    - "#N do negocio = row_number por workspace por created_at — sem coluna nova"
key-files:
  created:
    - drizzle/0022_crm_ficha_lead.sql
    - scripts/aplicar-migration-0022.ts
    - src/actions/crm-atividades.ts
    - src/components/crm/criar-atividade-dialog.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/crm/dados.ts
    - src/lib/validations/crm.ts
    - src/lib/storage/client.ts
    - src/actions/crm-lead.ts
    - src/actions/crm-tags.ts
    - src/components/crm/card-oportunidade.tsx
    - src/components/crm/ficha-lead.tsx
decisions:
  - "Bucket crm-fotos e PUBLICO de proposito: avatar nao pode depender de signed URL que expira; foto_url guarda a URL publica com ?v=timestamp p/ furar cache na troca"
  - "Atividades agendaveis usam crm_tarefas (colunas novas data_inicio/data_fim/prioridade); dataVencimento = dataFim para nao quebrar a heuristica 'sem contato +7d'"
  - "#N do negocio derivado por row_number por workspace (board) / count correlacionado (ficha) — numero estavel sem migration"
  - "Eventos de tag so para vinculos REALMENTE inseridos/removidos (returning do onConflictDoNothing) — sem evento duplicado"
metrics:
  duration: ~35min
  completed: 2026-07-15
---

# Quick 260715-h9z: Card do lead estilo imagem03 + ficha completa — Summary

**Card do Kanban reproduz a imagem03 (avatar, linha azul de serviço/origem, #N, WhatsApp que não briga com o drag, tags) e a ficha do lead virou o painel duplo das imagens 04-06 com foto real, edição inline, histórico, atividades agendáveis e Pipeline Completa.**

## O que foi feito

### Task 1 — Backend (commit bdd0d59)
- **Migration 0022 APLICADA no banco** via `scripts/aplicar-migration-0022.ts` (DIRECT_URL, transação, conferência prévia por information_schema — nunca `drizzle-kit migrate`): `crm_contatos.foto_url`, `crm_tarefas.data_inicio/data_fim/prioridade`, bucket `crm-fotos` público + 3 policies de storage. **Tudo aplicou com sucesso, inclusive as policies** (sem fallback necessário). Confirmação pós-aplicação: 4 colunas + bucket public=true.
- `OportunidadeCard` ganhou `telefoneNormalizado`, `numero` (#N por row_number no workspace) e `tags` do contato — 2 queries agregadas SEQUENCIAIS a mais em getCrmVisaoGeral (numeração + tags por inArray), nunca N+1 por card.
- `getFichaLead` ampliada: foto, dono/atendente, tags, atendentes (profiles), atividades (crm_tarefas do lead/negócios), etapas do pipeline por negócio, `numero` por negócio e métricas (ticket médio/total/ciclo/última compra derivadas dos GANHOS, em TS).
- Actions novas: `atualizarFotoLead` (imagem ≤2MB, path fixo `leads/{id}.{ext}` com upsert, URL pública), `renomearLead`, `salvarNotasLead`, `atualizarAtendenteLead`, `criarAtividadeCrm`/`concluirAtividadeCrm` (arquivo novo `crm-atividades.ts`), `vincularTagLead`/`desvincularTagLead` com eventos `tag_adicionada`/`tag_removida` (também no criarLead, só para vínculos realmente inseridos).
- `uploadFile` (storage/client) aceita `opts { bucket, path, upsert }` — retrocompatível com documentos.

### Task 2 — Card imagem03 (commit 1f31f0d)
- Avatar com inicial (emerald), nome semibold, linha AZUL `"{Serviço} - [{ORIGEM}]"`, `#N` no canto.
- Linhas com ícone: atendente ("Sem atendente"), valor BRL (oculto se null), data dd/MM/yyyy, "Sem atividades"/"N atividade(s)".
- Badge de mensalidade/projeto REMOVIDO (`ROTULO_RECEITA` apagada).
- Botão WhatsApp (glifo SVG inline) com `stopPropagation` em **click E pointerdown** — não arrasta, não abre ficha; `wa.me/55...` sem duplicar DDI; oculto sem telefone.
- Tags no rodapé (paleta CORES_TAG); preservados "Não contatado", motivo da perda e estilo fantasma.

### Task 3 — Ficha dupla + modal (commit 14d77c4)
- Sheet largo (`sm:max-w-5xl`) em grid 340px + flex, scroll independente.
- Esquerda: faixa suave + avatar grande com lápis→input file→`atualizarFotoLead`; nome inline (blur/Enter salva, Escape cancela); tags com "+" reusando `TagsSelect` (diff → vincular/desvincular); Select de atendente; Métricas e Notas recolhíveis (notas salvam no blur com "Salvando..."); abas Perfil/Endereço/Campos adicionais com o form RHF (forceMount), telefone com 🇧🇷 + copiar.
- Direita: **Histórico** (timeline agrupada por dia, ícone por tipo, rótulos com tags), **Atividades** (botão "+ Atividade", lista por dia com horário/prioridade/atendente/concluir), **Informações do Negócio** (seletor do negócio, 3 cards coloridos #N/Valor/Data, Pipeline Completa com etapas reais + Ganho/Perdido e a etapa atual marcada). Sem "Produtos e Valores", automação ou anexos (placeholders falsos excluídos de propósito).
- `criar-atividade-dialog.tsx` fiel a cria_atividade.png: título, atendente (default usuário logado), lead fixo + negócio opcional, data/hora início-fim com duração calculada ("30m"), tipo, prioridade, descrição, botão azul largo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Funcionalidade crítica] Aba Endereço não persistia país/número/complemento/bairro**
- **Found during:** Task 3
- **Issue:** `leadPerfilSchema`/`atualizarLead` não cobriam as 4 colunas de endereço (existentes desde a 0021) — a aba Endereço salvaria silenciosamente só metade dos campos.
- **Fix:** campos adicionados ao schema e ao UPDATE.
- **Files modified:** src/lib/validations/crm.ts, src/actions/crm-lead.ts
- **Commit:** 14d77c4

**2. [Rule 3 - Bloqueio] `atividadeSchema.innerType().pick()` não compila no Zod 4**
- **Found during:** Task 3
- **Issue:** API do Zod 3 usada no rascunho do dialog quebrava o type-check.
- **Fix:** schema local do form no dialog; a action revalida tudo com `atividadeSchema` completo (inclusive fim > início).
- **Files modified:** src/components/crm/criar-atividade-dialog.tsx
- **Commit:** 14d77c4

### Notas
- `kanban-crm.tsx` estava listado nos arquivos do plano mas **não precisou de mudança**: o contrato do card (onAbrirFicha + drag) foi preservado e o stopPropagation vive no próprio botão do card.
- `usuarioId` adicionado ao retorno de `getFichaLead` (default do atendente no modal de atividade).

## Known Stubs

Nenhum stub novo. A foto do lead não aparece no CARD do Kanban (só na ficha) — fora do escopo por decisão do plano ("se houver fotoUrl no card futuramente não é escopo").

## Verificação

- `npx tsc --noEmit` ✅ · `npx vitest run` ✅ (1172 testes) · `npx next build` ✅ (0 erros/0 warnings)
- Migration 0022 conferida no banco ANTES (foto_url ausente) e DEPOIS (4 colunas + bucket public=true)

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 | bdd0d59 | backend da ficha — migration 0022 aplicada, foto, atividades, eventos de tag |
| 2 | 1f31f0d | card do Kanban fiel à imagem03 com WhatsApp e tags |
| 3 | 14d77c4 | ficha completa em dois painéis + modal Criar atividade |

## Self-Check: PASSED

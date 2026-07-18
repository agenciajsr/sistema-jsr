---
phase: quick-260718-gp5
plan: 01
subsystem: tarefas-processos
tags: [tarefas, processos, onboarding, retencao, saida, alertas, quadro]
requires:
  - Modulo Tarefas (tarefas/tarefa_checklist_items, quick 260714-qsy)
  - Modelo de processos (processo_modelo_itens, Fase 6)
provides:
  - Processos (onboarding/retencao/saida) criam TAREFA como fonte unica do checklist
  - Coluna derivada "Atrasadas" (vermelha) no quadro /tarefas
  - Alerta onboarding_parado alimentado pelo checklist da tarefa
affects:
  - /tarefas (quadro com 5 colunas)
  - Ficha do cliente (abas Onboarding/Retencao/Saida)
  - Alertas (onboarding_parado)
tech-stack:
  added: []
  patterns:
    - Idempotencia por jsonb containment em tarefas.etiquetas (processo:{tipo}) — sem migration
    - Coluna derivada no client a partir de modulo puro (colunaDaTarefa)
key-files:
  created:
    - src/lib/processos/gerar.test.ts
  modified:
    - src/lib/tarefas/quadro.ts
    - src/lib/tarefas/quadro.test.ts
    - src/app/(app)/tarefas/tarefas-quadro.tsx
    - src/app/(app)/tarefas/[id]/tarefa-detalhe.tsx
    - src/app/(app)/tarefas/nova/nova-tarefa-form.tsx
    - src/app/(app)/tarefas/nova/page.tsx
    - src/lib/processos/gerar.ts
    - src/actions/processos.ts
    - src/components/ficha/processos-cliente.tsx
    - src/app/(app)/clientes/[id]/page.tsx
    - src/lib/alertas/calcular.ts
decisions:
  - "'atrasada' e coluna DERIVADA (ColunaQuadro = TarefaStatus | 'atrasada') — nunca vira status novo no banco/enum"
  - "Idempotencia do processo por etiqueta tecnica processo:{tipo} em tarefas.etiquetas (jsonb @>) — zero migration"
  - "processo_itens abandonado na leitura/escrita (0 linhas em producao); tabela permanece no schema, sem drop"
  - "STATUS_ORDEM separado de COLUNAS_ORDEM: selects de status (detalhe/nova) nunca oferecem 'atrasada'"
metrics:
  duration: ~25min
  completed: 2026-07-18
  tasks: 3
  tests: 535 (suite completa verde)
---

# Quick 260718-gp5: Processos criam TAREFA como fonte unica + coluna Atrasadas

**One-liner:** Ativar onboarding/retencao/saida cria UMA tarefa "Onboarding — {nome}" (alta, hoje BR) com o checklist do modelo, idempotente por etiqueta `processo:{tipo}`; a ficha e o alerta onboarding_parado leem esse checklist, e o quadro /tarefas ganhou a coluna derivada "Atrasadas" (vermelha).

## O que foi feito

### Task 1 — Coluna "Atrasadas" no quadro (TDD)
- `ColunaQuadro = TarefaStatus | 'atrasada'`; `colunaDaTarefa` compara strings 'YYYY-MM-DD' (regra de fuso do projeto).
- `COLUNAS_ORDEM` agora tem 5 colunas com 'atrasada' PRIMEIRO; LABEL/HELPER/PONTO/BARRA estendidos so com tokens `destructive` existentes.
- `agruparPorColuna(tarefas, dia)` e `estatisticasDoQuadro(tarefas, dia)` (porColuna com 5 chaves; percentualConclusao inalterado).
- Barra de stats: grid `lg:grid-cols-7`; "Adicionar tarefa" da coluna atrasada linka sem param status.
- Commits: 659a844 (testes RED), 51a4d97 (GREEN).

### Task 2 — gerarProcessoParaCliente cria TAREFA (TDD)
- Assinatura e try/catch preservados (chamadores em cobrancas/clientes/processos/webhook Asaas/assinatura intocados).
- Helpers puros exportados e testados: `tituloDoProcesso`, `etiquetaDoProcesso`, `grupoDoProcesso`, `itensParaChecklist` (sufixo ' (opcional)'), `hojeBrasilia`.
- Idempotencia: count de tarefas do cliente (ehMolde=false) com `etiquetas @> '["processo:{tipo}"]'::jsonb` — segunda ativacao retorna 0.
- Tarefa: prioridade alta, status a_fazer, data hoje BR, etiquetas `[grupo legivel, chave tecnica]`; checklist com grupo = nome do processo.
- Commits: 36cad52 (testes RED), 5ac446f (GREEN).

### Task 3 — Ficha + alerta leem a tarefa do processo
- page.tsx: 2 queries sequenciais (tarefas de processo com OR dos 3 containments + checklist por inArray); monta `ProcessoDaFicha` por tipo com degradacao graciosa.
- `ChecklistProcesso` binario (removidos 'nao_se_aplica'/'Reativar'), opera via `alternarItemProcesso` (wrapper que chama `toggleChecklistItemTarefa` e revalida a ficha) + botao "Abrir tarefa" para `/tarefas/{id}`.
- `calcular.ts`: onboarding_parado agrega `count FILTER (WHERE NOT concluido)` do checklist da tarefa com etiqueta `processo:onboarding`; `avaliarOnboardingParado` puro intocado.
- Limpeza: `atualizarStatusProcessoItem` e import de `processoItens` removidos de actions/processos.ts. `grep processoItens` → so o schema.
- Commit: 4d08540.

## Desvios do plano

**1. [Rule 3 - Bloqueio] Worktree desatualizado**
- **Encontrado em:** carga inicial
- **Problema:** o worktree estava em fcc45ca (14/jul); os arquivos-alvo (gerar.ts, processos-cliente.tsx etc.) so existem no master recente.
- **Correcao:** `git merge --ff-only master` antes de executar (sem commit proprio).

**2. [Rule 1 - Bug evitado] STATUS_ORDEM separado**
- **Encontrado em:** Task 1
- **Problema:** `COLUNAS_ORDEM` era usado pelos selects de STATUS em `/tarefas/[id]` e `/tarefas/nova` — virar `ColunaQuadro[]` ofereceria "atrasada" como status de criacao/edicao.
- **Correcao:** novo export `STATUS_ORDEM: TarefaStatus[]` e troca nos 3 consumidores.
- **Arquivos:** tarefa-detalhe.tsx, nova-tarefa-form.tsx, nova/page.tsx (commit 51a4d97).

## Verificacao

- `npx vitest run` → 535 testes verdes (inclui regressoes do quadro e dos avaliadores).
- `npx tsc --noEmit` → sem erros.
- `npm run lint` → exit 0 (warnings pre-existentes em arquivos nao tocados).
- `npm run build` → exit 0 (logs ECONNREFUSED no prerender = sem banco local, degradacao graciosa esperada).
- `grep -rn "processoItens" src` → apenas `src/lib/db/schema.ts` (sem leitura/escrita em runtime).

## Verificacao manual (pos-deploy)

1. Ativar um cliente de teste → tarefa "Onboarding — {nome}" aparece em /tarefas e na aba Processos da ficha.
2. Repetir a ativacao (webhook + baixa manual) → nao duplica.
3. Tarefa de ontem em a_fazer → aparece so na coluna "Atrasadas" (vermelha) e continua concluivel.

## Known Stubs

Nenhum — sem stubs; todos os fluxos ligados a dados reais.

## Self-Check: PASSED

- Commits 659a844, 51a4d97, 36cad52, 5ac446f, 4d08540: FOUND
- src/lib/processos/gerar.test.ts: FOUND
- Suite vitest, tsc, lint e build verdes

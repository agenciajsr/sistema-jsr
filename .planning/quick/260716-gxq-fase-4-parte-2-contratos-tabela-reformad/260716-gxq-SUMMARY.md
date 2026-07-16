---
phase: quick-260716-gxq
plan: 01
subsystem: contratos
tags: [autentique, assinatura-eletronica, pdf, react-pdf, webhook, contratos]
requires: [quick-260716-g4h]
provides:
  - Tabela /contratos com as 12 colunas exatas (decisão LOCKED)
  - Template do contrato de tráfego versionado (fiel aos DOCX 3/6 meses)
  - Preview interno /contratos/preview/[id] imprimível
  - Envio/reenvio para assinatura via Autentique (PDF gerado serverless)
  - Webhook /api/webhooks/autentique + botão Atualizar status (fallback)
  - Assinado → statusFluxo 'assinado' + cliente ativado
affects: [/contratos, /clientes/[id], fluxo de conversão do CRM]
tech-stack:
  added: ["@react-pdf/renderer"]
  patterns:
    - Template de contrato versionado em TS (sem docxtemplater em runtime)
    - Cliente GraphQL multipart da Autentique em src/lib (não 'use server')
    - Webhook valida pela API (fonte da verdade), nunca pelo payload
key-files:
  created:
    - drizzle/0030_contratos_assinatura.sql
    - scripts/aplicar-migration-0030.ts
    - src/lib/contratos/variaveis.ts (+ .test.ts, 7 testes)
    - src/lib/contratos/template-trafego.ts
    - src/lib/contratos/pdf.tsx
    - src/lib/contratos/assinatura.ts
    - src/lib/autentique/client.ts
    - src/app/api/webhooks/autentique/route.ts
    - src/app/(app)/contratos/preview/[id]/page.tsx (+ botao-imprimir.tsx)
    - src/app/(app)/contratos/tabela-contratos.tsx
    - src/components/contratos/{verificar-dados-dialog,editar-contrato-dialog,excluir-contrato-alert}.tsx
  modified:
    - src/lib/db/schema.ts (4 colunas nullable em contratos)
    - src/lib/contratos/fluxo.ts (rotuloTipoDocumento)
    - src/lib/validations/contrato.ts (contratoEdicaoSchema)
    - src/actions/contratos.ts (3 actions novas + listarTodosContratos em cadeia)
    - src/app/(app)/contratos/page.tsx (delega à TabelaContratos)
decisions:
  - Um template só parametrizado por duracaoMeses — os DOCX de 3 e 6 meses diferem APENAS nas cláusulas 2.1 e 5.1
  - Valor mensal sem extenso no v1 (numérico BRL), documentado no código
  - Reenvio cria NOVO documento na Autentique e sobrescreve o id (PDF regenerado com dados atuais)
  - Webhook sempre responde 200 e confirma assinatura CONSULTANDO a API (payload não é fonte da verdade)
metrics:
  duration: ~55min
  tasks: 3
  files: 22
completed: 2026-07-16
---

# Quick 260716-gxq: Fase 4 Parte 2 — Contratos (tabela reformada + Autentique) Summary

Tabela /contratos reformada com as 12 colunas exatas e ciclo completo do contrato: template dos DOCX versionado em TS, preview interno imprimível, PDF via @react-pdf/renderer, envio/reenvio para assinatura na Autentique (GraphQL multipart) e retorno assinado → cliente ativo, com webhook + botão de atualização manual como fallback.

## O que foi feito

### Tarefa 1 — Migration 0030 + módulos puros (TDD)
- Colunas ADITIVAS nullable em `contratos`: `tipo_documento`, `autentique_documento_id`, `enviado_para_assinatura_em`, `assinado_em`. SQL escrito à mão (snapshot do drizzle contaminado, mesmo caso da 0029) — **NÃO aplicada**.
- `montarVariaveisContrato` (módulo puro, 7 testes): qualificação PJ/PF, CPF/CNPJ formatados de dígitos crus ou mascarados, BRL, datas sem `Date`, duração restrita a 3/6 meses, `{ error }` quando dados ausentes/incompletos.
- `template-trafego.ts`: texto integral do contrato extraído dos DOCX (via unzip do document.xml). Diff entre os dois arquivos confirmou: só "3 meses"/"6 meses" muda (cláusulas 2.1 e 5.1).

### Tarefa 2 — Preview, PDF, Autentique, actions e webhook
- `/contratos/preview/[id]` (autenticada): contrato preenchido em tipografia serifada com botão imprimir; sem dados → aviso com copiar link; migrations pendentes → mensagem amigável.
- `gerarPdfContrato` com @react-pdf/renderer (Helvetica padrão; nada de puppeteer no Hobby).
- `src/lib/autentique/client.ts`: `criarDocumento` (mutation multipart com FormData/Blob) e `consultarDocumento` (todas as assinaturas SIGN concluídas?). Token ausente → erro tipado.
- Actions: `enviarParaAssinatura` (envio e reenvio; sem token → "Configure o token da Autentique (AUTENTIQUE_API_TOKEN na Vercel)."), `atualizarStatusAssinatura` (fallback manual), `atualizarDadosContrato` (edição completa, admin).
- Webhook POST público `/api/webhooks/autentique`: extrai o id defensivamente de vários formatos de payload, confirma pela API e chama `confirmarAssinatura` (contrato assinado + cliente ativo, updates sequenciais). Sempre 200.

### Tarefa 3 — Tabela com 12 colunas + dialogs
- Ordem exata: Cliente | Tipo | Valor | Status | Início | Fim | Verificar | Enviar/Reenviar | Preview | Editar | Excluir | Selecionar.
- Copiar link continua junto do badge quando `aguardando_dados` (funcionalidade da Parte 1 preservada).
- Verificar/Editar/Excluir via dialogs (tooltips lucide, dark mode ok); seleção com "N selecionados" (base para ações em lote futuras — sem ação falsa).
- `listarTodosContratos` com degradação em CADEIA: completa (0029+0030) → só 0029 → antiga.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Worktree desatualizada e PLAN ausente**
- **Found during:** Início da execução
- **Issue:** A worktree estava em commit antigo (pré-g4h) e o PLAN só existia no repo principal (untracked)
- **Fix:** `git merge --ff-only master` + cópia do PLAN para a worktree
- **Commit:** (setup, sem commit próprio)

**2. [Rule 1 - Bug] Refine do Zod não aceita path readonly**
- **Found during:** Tarefa 2
- **Issue:** `path: ['dataVencimento'] as const` quebrou o tsc ao compartilhar o objeto de refine
- **Fix:** removido o `as const`
- **Commit:** b554232

Sem outros desvios — plano executado como escrito.

## Known Stubs

- Coluna "Selecionar": apenas seleção + contagem, sem ação em lote — INTENCIONAL por decisão do plano ("base p/ ações em lote futuras — por ora só seleção/contagem, sem ação falsa").

## Checkpoint humano (fazer na mão, em ordem)

1. **Aplicar as migrations em produção (em ordem):**
   - `npx tsx --env-file=.env.local scripts/aplicar-migration-0029.ts`
   - `npx tsx --env-file=.env.local scripts/aplicar-migration-0030.ts`
2. **Configurar `AUTENTIQUE_API_TOKEN` na Vercel** (Painel da Autentique → Configurações → API).
3. **Cadastrar o webhook no painel da Autentique:** URL `https://<dominio>/api/webhooks/autentique`.
4. **Testar ponta a ponta em produção:** ganhar negócio no CRM → link público → preencher dados → Verificar → Preview → Enviar → assinar → conferir status "Assinado" e cliente ativo (usar o botão Atualizar status se o webhook demorar).

## Commits

- cd0cd4d — test(quick-260716-gxq): testes de montarVariaveisContrato (RED)
- 4f062a8 — feat(quick-260716-gxq): variáveis do contrato + template tráfego + migration 0030 (GREEN)
- b554232 — feat(quick-260716-gxq): preview interno, PDF, cliente Autentique, envio/atualização e webhook
- 11ba0fa — feat(quick-260716-gxq): tabela /contratos reformada — 12 colunas + dialogs + seleção

## Verificação

- `npx vitest run`: 369 testes verdes (7 novos de variaveis)
- `npx tsc --noEmit`: limpo; `npm run build`: exit 0 (ECONNREFUSED de prerender sem banco é pré-existente)
- drizzle/0030 contém APENAS `ADD COLUMN IF NOT EXISTS`
- Nenhum `Promise.all` novo com queries; única rota pública nova: `/api/webhooks/autentique`
- UI toda em português; badges/cores com variantes `dark:`

## Self-Check: PASSED

Todos os arquivos criados e todos os commits (cd0cd4d, 4f062a8, b554232, 11ba0fa) confirmados no repositório.

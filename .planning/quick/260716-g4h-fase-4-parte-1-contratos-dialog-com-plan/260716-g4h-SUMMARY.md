---
phase: quick-260716-g4h
plan: 01
subsystem: contratos
tags: [funil-fase-4, contratos, pagina-publica, cpf-cnpj, tdd]
requires: [quick-260716-ezd]
provides:
  - Conversão Ganho→Cliente cria contrato aguardando_dados com token único
  - Página pública /contrato/[token] (PJ/PF, sem login, mobile-first)
  - /contratos com fluxo, badges e copiar link
affects: [crm, contratos, financeiro-mrr]
tech-stack:
  added: []
  patterns:
    - Validação CPF/CNPJ por dígito verificador em módulo puro
    - Schema Zod compartilhado client+action pública (nunca confiar só no client)
    - Degradação graciosa quando migration pendente (try/catch + fallback)
key-files:
  created:
    - drizzle/0029_contratos_fluxo.sql
    - src/lib/validations/documentos.ts (+ .test.ts)
    - src/lib/contratos/fluxo.ts (+ .test.ts)
    - src/lib/validations/contratante.ts
    - src/actions/contrato-publico.ts
    - src/app/contrato/[token]/page.tsx
    - src/app/contrato/[token]/formulario-contratante.tsx
    - src/components/contratos/copiar-link-botao.tsx
  modified:
    - src/lib/db/schema.ts
    - src/actions/crm.ts
    - src/components/crm/converter-cliente-dialog.tsx
    - src/actions/contratos.ts
    - src/app/(app)/contratos/page.tsx
decisions:
  - status_fluxo é text + união TS (não pgEnum) — Parte 2 adiciona estados sem migration de enum
  - Token = randomBytes(32).toString('base64url') — 256 bits, seguro p/ URL
  - Reenvio do formulário público sobrescreve o jsonb mas NUNCA regride status avançado (aguardando_assinatura/assinado)
  - Idempotência da conversão: cliente que já tem contrato do fluxo reaproveita o token (nunca duplica contrato)
metrics:
  duration: ~40min
  completed: 2026-07-16
---

# Quick 260716-g4h: Fase 4 Parte 1 — Contratos (dialog + link público) Summary

Conversão Ganho→Cliente agora coleta duração (3/6 meses), serviço e mensalidade e gera contrato `aguardando_dados` com token único; o cliente preenche os dados PJ/PF pelo link público /contrato/[token] no celular, sem login.

## Tarefas

| Task | Nome | Commit |
|------|------|--------|
| 1 (RED) | Testes falhando CPF/CNPJ + fluxo | 111ad73 |
| 1 (GREEN) | Schema aditivo + migration 0029 + módulos puros + conversão estendida + dialog | 94631b0 |
| 2 | Página pública /contrato/[token] + action pública idempotente | c5cb977 |
| 3 | /contratos reformada (badges, copiar link, 4 StatCards) | b92f6cf |

## O que foi feito

- **Schema/migration**: 6 colunas novas em `contratos` (token unique, status_fluxo, duracao_meses, servico, dados_contratante jsonb, dados_recebidos_em) — migration `drizzle/0029_contratos_fluxo.sql` **GERADA e NÃO aplicada**, editada à mão (veio contaminada pelo snapshot defasado, mesmo caso do 260716-ezd).
- **Módulos puros (TDD, 29 testes)**: `validarCpf/validarCnpj` com dígito verificador (máscara, todos-iguais, tamanho) + `STATUS_FLUXO` (rótulos pt-BR, badges com dark:), `montarDadosContrato` (addMonths grampeando fim de mês), `gerarToken`.
- **Conversão**: `converterOportunidadeEmCliente(id, {duracaoMeses, servico, mensalidade})` valida com Zod, cria contrato sequencialmente após o cliente, retorna `contratoToken`; idempotente (reaproveita token existente) e degrada graciosamente sem a 0029 (conversão segue sem contrato). `valorMensal` alimenta o MRR existente do /financeiro.
- **Dialog**: campos duração (botões 3/6), serviço (Select com SERVICOS_JSR) e mensalidade (RHF+Zod, obrigatórios); estado de sucesso mostra o link completo com botão Copiar; sem token (degradação) mostra sucesso sem o bloco do link.
- **Página pública**: fora do grupo (app), mobile-first, logo JSR, PJ/PF alternando blocos, pré-preenchimento (dados do cliente e do reenvio), máscara progressiva de CPF/CNPJ; action pública valida token + MESMO schema Zod no server, grava jsonb + `dados_recebidos`, reenvio sobrescreve, token inválido → tela amigável.
- **/contratos**: cliente linkado, serviço, duração, badge do fluxo (legado = "Manual" neutro), início/fim, mensalidade, copiar link; StatCards de vigentes/MRR/aguardando dados/dados recebidos; fallback à consulta antiga quando a 0029 não existe.

## Desvios do plano

**1. [Rule 2 - arquivo extra] `src/lib/validations/contratante.ts`**
- **Motivo:** o plano pede "o MESMO schema Zod" no client e na action pública, mas arquivos 'use server' só exportam funções async — o schema compartilhado precisa de um módulo puro próprio.
- **Commit:** c5cb977

**2. [Rule 3 - ambiente] Worktree desatualizada**
- **Motivo:** a branch da worktree estava em fcc45ca (sem a Fase 3/CRM da qual este plano depende). Fast-forward seguro (`git merge --ff-only`) para d46bea1 (master) antes de começar.

## Verificação

- `npx vitest run` — 362 testes verdes (incl. 29 novos)
- `npx tsc --noEmit` — limpo
- `npm run build` — compila; erros de ECONNREFUSED no prerender são pré-existentes (build sem banco) e o fallback logou como projetado
- Migration 0029 contém APENAS ADD COLUMN + unique do token; nenhum Promise.all novo; nenhuma rota pública além de /contrato/[token] + action

## Checkpoint humano pendente

1. **Aplicar a migration 0029 na mão** (script com DIRECT_URL em `sql.begin`, modelo `scripts/aplicar-migration-0024.ts`). Obs.: conferir se a 0028 já foi aplicada — rodam em ordem.
2. `git push origin master` (após integrar a branch da worktree).
3. Testar o fluxo completo em produção: ganhar negócio → converter com duração/serviço/mensalidade → copiar link → abrir no celular sem login → enviar dados → conferir badge "Dados recebidos" em /contratos.

## Self-Check: PASSED

- Arquivos criados conferidos em disco; commits 111ad73/94631b0/c5cb977/b92f6cf existentes no log.

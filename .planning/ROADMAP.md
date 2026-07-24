# Roadmap: Sistema JSR (Agência JSR)

## Overview

O sistema nasce de dentro para fora: primeiro a base (login, cadastro de clientes e contratos), depois a integração com as plataformas de anúncio (Meta Ads e Google Ads) — a parte mais arriscada e dependente de aprovações externas, por isso entra cedo. Em seguida, o painel diário de tráfego pago substitui a conferência manual das contas de anúncio, e o módulo de contratos/financeiro traz alertas de vencimento e visão de MRR. O relatório semanal automático elimina a montagem manual enviada toda segunda-feira. Por fim, o painel geral unifica tudo numa única tela que destaca o que precisa de atenção imediata — a peça final que depende de todas as anteriores já existirem com dados reais.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

> **Nota de reconciliação (2026-07-24):** as 6 fases foram entregues na prática via ~90 quick tasks, não pelo fluxo formal fase-a-fase. Os checkboxes abaixo refletem o **estado real do código** (ver `REQUIREMENTS.md` e `v1.0-MILESTONE-AUDIT.md`), não a execução formal de PLAN/VERIFICATION.

- [x] **Phase 1: Fundação — Acesso, Clientes e Contratos** — ✅ entregue (ficha do cliente redesenhada em 260723-v8z)
- [x] **Phase 2: Integração com Meta Ads e Google Ads** — ✅ Meta completo · 🟡 Google no ar, faltando validar métricas com campanha real (PASSO B)
- [x] **Phase 3: Painel de Tráfego Pago e Alertas de Verba** — ✅ entregue · 🟡 ALRT-01 (limiar de verba) ainda fixo, não configurável por cliente
- [x] **Phase 4: Contratos e Financeiro** — ✅ entregue e superado (contratos c/ assinatura, cobrança Asaas, CAC/LTV, previsão de caixa)
- [x] **Phase 5: Relatório Semanal Automático** — ✅ entregue · 🔴 REL-04 (comparação semana-vs-semana) ainda ausente no texto
- [x] **Phase 6: Painel Geral Unificado** — ✅ entregue (painel + atenção imediata + modo apresentação)

## Phase Details

### Phase 1: Fundação — Acesso, Clientes e Contratos
**Goal**: Equipe da JSR consegue acessar o sistema com segurança e manter o cadastro de clientes e contratos, base para todas as demais funcionalidades
**Depends on**: Nothing (first phase)
**Requirements**: ACES-01, ACES-02, ACES-03, CLI-01, CLI-02, CLI-03, CLI-04
**Success Criteria** (what must be TRUE):
  1. Usuário faz login com email e senha e permanece logado entre acessos
  2. Múltiplos usuários da equipe da JSR conseguem acessar o sistema com suas próprias contas
  3. Usuário cadastra um cliente com nome e objetivo/nicho (e-commerce, negócio local, infoproduto)
  4. Usuário registra e edita o contrato de um cliente (data de início, vencimento, valor)
  5. Usuário vê a lista de todos os clientes ativos com status resumido
**Plans**: 9 plans (6 waves)

Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js 16 + shadcn/ui + Vitest
- [x] 01-02-PLAN.md — Schema Drizzle (profiles/clientes/contratos) + projeto Supabase + migração
- [x] 01-03-PLAN.md — Supabase Auth SSR (proxy.ts, login, sessão) + bootstrap do primeiro Admin
- [x] 01-04-PLAN.md — TDD: validação Zod de cliente e contrato (CLI-01, CLI-02)
- [x] 01-05-PLAN.md — TDD: derivação do contrato atual + histórico de renovação (CLI-02, CLI-03, CLI-04)
- [x] 01-06-PLAN.md — Provisionamento de usuários (Admin-only) (ACES-02)
- [x] 01-07-PLAN.md — Server Actions de Cliente e Contrato
- [x] 01-08-PLAN.md — UI: formulários, lista em cards, detalhe do cliente
- [ ] 01-09-PLAN.md — Checkpoint de verificação manual final da fase
**UI hint**: yes

### Phase 2: Integração com Meta Ads e Google Ads
**Goal**: Sistema sincroniza automaticamente, sem intervenção manual, os dados das contas de anúncio de cada cliente a partir do Meta Ads e do Google Ads
**Depends on**: Phase 1
**Requirements**: TRAF-01, TRAF-02, TRAF-06
**Success Criteria** (what must be TRUE):
  1. Sistema puxa automaticamente os dados das contas de anúncio de cada cliente no Meta Ads (via conta da agência)
  2. Sistema puxa automaticamente os dados das contas de anúncio de cada cliente no Google Ads (via conta MCC da agência)
  3. Usuário consegue ver a data/hora da última sincronização bem-sucedida por cliente
  4. Falha ou atraso de sincronização fica identificável (dado desatualizado é sinalizado, não escondido)
**Plans**: TBD

### Phase 3: Painel de Tráfego Pago e Alertas de Verba
**Goal**: Equipe acompanha diariamente a saúde das contas de anúncio de cada cliente dentro do próprio sistema, substituindo a conferência manual diária
**Depends on**: Phase 2
**Requirements**: TRAF-03, TRAF-04, TRAF-05, ALRT-01, ALRT-02, ALRT-05
**Success Criteria** (what must be TRUE):
  1. Usuário vê, por cliente, o status da conta de anúncios (ativa, com problema) e a verba disponível
  2. Usuário vê, por cliente, a lista de campanhas ativas/pausadas com verba gasta e restante
  3. Usuário vê quais criativos/anúncios estão performando bem ou mal por cliente
  4. Usuário configura um limiar de verba mínima por cliente e recebe alerta dentro do sistema quando ele é cruzado
  5. Sistema alerta quando há queda brusca de performance em relação à semana anterior
**Plans**: TBD
**UI hint**: yes

### Phase 4: Contratos e Financeiro
**Goal**: Equipe recebe alertas proativos de vencimento de contrato e enxerga a saúde financeira consolidada da agência
**Depends on**: Phase 1
**Requirements**: ALRT-03, ALRT-04, FIN-01, FIN-02, FIN-03
**Success Criteria** (what must be TRUE):
  1. Usuário recebe alerta dentro do sistema quando o contrato de um cliente está próximo do vencimento
  2. Alerta de vencimento de contrato mostra junto o valor de MRR em risco
  3. Usuário vê a data de cobrança de cada cliente
  4. Usuário vê o MRR total calculado automaticamente a partir dos contratos ativos
  5. Usuário vê receita e clientes ativos num painel financeiro consolidado
**Plans**: TBD
**UI hint**: yes

### Phase 5: Relatório Semanal Automático
**Goal**: O relatório semanal por cliente é gerado automaticamente pelo sistema, pronto para copiar e colar, eliminando a montagem manual feita toda segunda-feira
**Depends on**: Phase 1, Phase 2
**Requirements**: REL-01, REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. Sistema gera automaticamente o relatório semanal de cada cliente com dados das campanhas
  2. Conteúdo do relatório muda conforme o objetivo do cliente (e-commerce, negócio local, infoproduto)
  3. Relatório sai em formato de texto pronto para copiar e colar (ex: WhatsApp)
  4. Relatório traz comparação com o período anterior (semana vs. semana anterior)
**Plans**: TBD

### Phase 6: Painel Geral Unificado
**Goal**: Equipe enxerga, numa única tela, a saúde de todos os clientes ativos e o que precisa de atenção imediata, sem precisar entrar cliente por cliente
**Depends on**: Phase 3, Phase 4
**Requirements**: DASH-01, DASH-02
**Success Criteria** (what must be TRUE):
  1. Usuário vê um painel único com visão consolidada de todos os clientes ativos (verba, contrato, performance)
  2. Painel destaca automaticamente o que precisa de atenção imediata (verba baixa, contrato vencendo, queda de performance)
**Plans**: TBD
**UI hint**: yes

## Progress

**Reconciliado com o código real em 2026-07-24.** A execução real foi via quick tasks (não plans formais por fase), então "Plans Complete" abaixo não se aplica; a coluna Status reflete o produto em produção.

| Phase | Status | Observação |
|-------|--------|-----------|
| 1. Fundação — Acesso, Clientes e Contratos | ✅ Concluída | Ficha do cliente redesenhada (260723-v8z) |
| 2. Integração com Meta Ads e Google Ads | 🟡 Quase | Meta 100%; Google no ar, falta validar dado real (PASSO B) |
| 3. Painel de Tráfego Pago e Alertas de Verba | 🟡 Quase | Completo; falta ALRT-01 (limiar de verba por cliente) |
| 4. Contratos e Financeiro | ✅ Concluída | Superou o escopo (assinatura, Asaas, CAC/LTV) |
| 5. Relatório Semanal Automático | 🟡 Quase | Gera e segmenta; falta REL-04 (comparação c/ período anterior) |
| 6. Painel Geral Unificado | ✅ Concluída | Painel + atenção imediata + modo apresentação |

**Placar v1:** 29/32 requisitos concluídos (~95%). 3 pendências para 100%: TRAF-02, ALRT-01, REL-04.

**Milestone v1:** aberto — restam as 3 pendências acima. Ao fechá-las, rodar o encerramento formal e abrir o v2 (enriquecer Google, envio automático do relatório, novas plataformas).

# Roadmap: Sistema JSR (Agência JSR)

## Overview

O sistema nasce de dentro para fora: primeiro a base (login, cadastro de clientes e contratos), depois a integração com as plataformas de anúncio (Meta Ads e Google Ads) — a parte mais arriscada e dependente de aprovações externas, por isso entra cedo. Em seguida, o painel diário de tráfego pago substitui a conferência manual das contas de anúncio, e o módulo de contratos/financeiro traz alertas de vencimento e visão de MRR. O relatório semanal automático elimina a montagem manual enviada toda segunda-feira. Por fim, o painel geral unifica tudo numa única tela que destaca o que precisa de atenção imediata — a peça final que depende de todas as anteriores já existirem com dados reais.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fundação — Acesso, Clientes e Contratos** - Equipe consegue logar e manter o cadastro de clientes/contratos como base de tudo
- [ ] **Phase 2: Integração com Meta Ads e Google Ads** - Sistema sincroniza automaticamente dados das contas de anúncio dos clientes
- [ ] **Phase 3: Painel de Tráfego Pago e Alertas de Verba** - Equipe acompanha diariamente a saúde das contas de anúncio sem entrar manualmente no gerenciador
- [ ] **Phase 4: Contratos e Financeiro** - Equipe recebe alertas de vencimento de contrato e enxerga a saúde financeira da agência
- [ ] **Phase 5: Relatório Semanal Automático** - Relatório por cliente é gerado automaticamente, pronto para copiar e colar
- [ ] **Phase 6: Painel Geral Unificado** - Equipe enxerga, numa única tela, o que precisa de atenção imediata em todos os clientes

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
- [ ] 01-06-PLAN.md — Provisionamento de usuários (Admin-only) (ACES-02)
- [ ] 01-07-PLAN.md — Server Actions de Cliente e Contrato
- [ ] 01-08-PLAN.md — UI: formulários, lista em cards, detalhe do cliente
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

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação — Acesso, Clientes e Contratos | 5/9 | In Progress | - |
| 2. Integração com Meta Ads e Google Ads | 0/TBD | Not started | - |
| 3. Painel de Tráfego Pago e Alertas de Verba | 0/TBD | Not started | - |
| 4. Contratos e Financeiro | 0/TBD | Not started | - |
| 5. Relatório Semanal Automático | 0/TBD | Not started | - |
| 6. Painel Geral Unificado | 0/TBD | Not started | - |

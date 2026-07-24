# Sistema JSR (Agência JSR)

## What This Is

Sistema interno de gestão para a JSR, uma agência de marketing digital focada em tráfego pago (que também presta serviços de landing pages, CRM, estruturação e estratégia). Unifica em um só lugar a visão geral do negócio, a gestão de clientes (contratos, tráfego pago, social, mídia, relatórios) e a operação diária (verba, checklists, acompanhamento), substituindo hoje uma combinação dispersa de ferramentas (ClickUp, planilhas, conferência manual de contas de anúncio) e processos manuais.

## Core Value

Dar à equipe da JSR visibilidade em tempo real da saúde de cada cliente (verba, campanhas, contratos, financeiro) em um único painel, com alertas proativos — eliminando o risco de "descobrir tarde demais" (verba zerada, contrato vencido) e o tempo gasto montando relatórios manualmente.

## Requirements

### Validated

Entregues e em produção (reconciliado com o código em 2026-07-24 — ver `REQUIREMENTS.md`):

- [x] Dashboard geral com visão de clientes ativos, valores e briefing do negócio
- [x] Painel de tráfego pago por cliente: status das contas de anúncio (Meta 100%; Google no ar, validando dado real), verba disponível, campanhas ativas/pausadas
- [x] Visão de performance de campanhas e criativos por cliente (o que está performando bem vs. mal)
- [x] Alertas de contratos (vencimento/renovação) + MRR em risco + queda de performance
- [x] Geração automática de relatório semanal por cliente, segmentado por objetivo, pronto para copiar/colar (WhatsApp)
- [x] Módulo de clientes com registro de contratos (datas, valores, vigência) — ficha redesenhada
- [x] Camada financeira: data de cobrança por cliente, receita, MRR de ativos (+ previsão, churn, LTV, CAC — além do v1)
- [x] Múltiplos usuários internos (equipe da JSR) com acesso ao sistema

### Active — as 3 pendências para fechar o v1 em 100%

- [ ] **Alerta de verba com limiar configurável por cliente** (hoje o alerta existe mas o limiar é fixo no código)
- [ ] **Relatório com comparação semana-vs-semana** no texto (hoje só números absolutos)
- [ ] **Validar métricas do Google Ads com campanha real** e então liberar Google em Relatórios/Saúde/Alertas

### Out of Scope

- Portal para os clientes finais acessarem — v1 é uso interno da equipe JSR apenas
- Execução de otimizações de campanha dentro do sistema (pausar/ajustar verba direto pela ferramenta) — otimização continua no gerenciador de anúncios nativo; o sistema é de visibilidade, não de operação
- Envio automático do relatório direto para o WhatsApp do cliente via integração — v1 gera o conteúdo pronto, o envio/colagem final continua manual
- Processamento de pagamentos/faturamento automatizado — v1 é visibilidade de datas e valores, não cobrança automatizada
- Decisão sobre substituir ou complementar o ClickUp — em aberto, revisar depois que o core estiver validado

## Context

- Agência de marketing digital com foco principal em tráfego pago; também oferece landing pages, CRM, estruturação e estratégia
- Equipe pequena, ~10 clientes ativos hoje, com expectativa de crescimento
- Clientes distribuídos em nichos com objetivos diferentes: e-commerce, negócio local, infoprodutos — isso afeta o que entra no relatório de cada um
- Hoje a operação usa ClickUp e ferramentas variadas, mais processos manuais (planilhas, conferência manual diária de contas de anúncio, montagem manual de relatório semanal enviado por WhatsApp)
- Rotina atual: toda segunda-feira envia relatório semanal por cliente; diariamente revisa contas de anúncio (verba, campanhas ativas, performance); otimização de campanhas é feita manualmente no gerenciador de anúncios
- Contratos hoje ficam registrados de forma dispersa em ferramentas como ClickUp, sem um módulo dedicado
- Integrações de anúncios prioritárias: Meta Ads e Google Ads (outras plataformas podem ser adicionadas depois)
- Há um MCP de Meta Ads disponível no ambiente Claude, mas ainda não autorizado — pode ser relevante para a integração futura

## Constraints

- **Escala inicial**: Poucos clientes ativos (~10) e equipe pequena — não é preciso projetar para alta escala desde o v1
- **Integrações**: Depende de acesso a APIs externas (Meta Ads, Google Ads) para dados de campanha e verba — sujeito a limites/autenticação dessas plataformas
- **Uso interno**: v1 não precisa de portal externo para clientes, o que simplifica autenticação/permissões no início

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1 é uso interno da equipe, sem portal de cliente | Reduz escopo inicial, foco na dor real (visibilidade interna) | ✅ Confirmado — sistema interno em produção |
| Financeiro (MRR, cobrança) entra já no v1, não fica pra depois | Usuário confirmou que quer isso desde já, não é um "nice to have" futuro | ✅ Entregue e superado (Asaas, CAC, LTV, previsão) |
| Relatório semanal automático gera conteúdo pronto para copiar/colar, não envia sozinho | Reduz complexidade de integração com WhatsApp no v1 | ✅ Entregue (envio automático fica p/ v2 — REL-05) |
| Relação com ClickUp fica em aberto | Usuário ainda não decidiu se substitui ou complementa | 🟡 Em aberto — na prática o sistema já cobre tarefas/checklist/CRM |
| Limiar de alerta de verba é configurável por cliente, não fixo | Clientes têm portes diferentes de verba; um valor único não serve pra todos | 🔴 PENDENTE (ALRT-01) — hoje o limiar está fixo; falta tornar configurável |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-24 — reconciliação do histórico com a realidade (v1 ~95% entregue, 29/32 requisitos concluídos, 3 pendências ativas). Antes: 2026-07-10 (initialization).*

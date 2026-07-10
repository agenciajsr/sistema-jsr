# Sistema JSR (Agência JSR)

## What This Is

Sistema interno de gestão para a JSR, uma agência de marketing digital focada em tráfego pago (que também presta serviços de landing pages, CRM, estruturação e estratégia). Unifica em um só lugar a visão geral do negócio, a gestão de clientes (contratos, tráfego pago, social, mídia, relatórios) e a operação diária (verba, checklists, acompanhamento), substituindo hoje uma combinação dispersa de ferramentas (ClickUp, planilhas, conferência manual de contas de anúncio) e processos manuais.

## Core Value

Dar à equipe da JSR visibilidade em tempo real da saúde de cada cliente (verba, campanhas, contratos, financeiro) em um único painel, com alertas proativos — eliminando o risco de "descobrir tarde demais" (verba zerada, contrato vencido) e o tempo gasto montando relatórios manualmente.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Dashboard geral com visão de clientes ativos, valores e briefing do negócio
- [ ] Painel de tráfego pago por cliente: status das contas de anúncio (Meta Ads e Google Ads), verba disponível, campanhas ativas/pausadas
- [ ] Visão de performance de campanhas e criativos por cliente (o que está performando bem vs. mal)
- [ ] Alertas dentro do sistema para verba baixa, com limiar configurável por cliente
- [ ] Alertas de contratos (vencimento/renovação)
- [ ] Geração automática de relatório semanal por cliente, com dados puxados das APIs de anúncios, segmentado pelo objetivo do cliente (e-commerce, negócio local, infoproduto), em formato pronto para copiar/colar (ex: WhatsApp)
- [ ] Módulo de clientes com registro de contratos (datas, valores, vigência)
- [ ] Camada financeira: data de cobrança por cliente, receita, MRR de clientes ativos
- [ ] Múltiplos usuários internos (equipe da JSR) com acesso ao sistema

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
| v1 é uso interno da equipe, sem portal de cliente | Reduz escopo inicial, foco na dor real (visibilidade interna) | — Pending |
| Financeiro (MRR, cobrança) entra já no v1, não fica pra depois | Usuário confirmou que quer isso desde já, não é um "nice to have" futuro | — Pending |
| Relatório semanal automático gera conteúdo pronto para copiar/colar, não envia sozinho | Reduz complexidade de integração com WhatsApp no v1; ainda economiza o trabalho manual de montar o relatório | — Pending |
| Relação com ClickUp fica em aberto | Usuário ainda não decidiu se o sistema substitui ou complementa o ClickUp; decisão adiada para não travar o core | — Pending |
| Limiar de alerta de verba é configurável por cliente, não fixo | Clientes têm portes diferentes de verba; um valor único não faz sentido pra todos | — Pending |

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
*Last updated: 2026-07-10 after initialization*

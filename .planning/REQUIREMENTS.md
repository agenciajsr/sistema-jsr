# Requisitos: Sistema JSR

**Definido em:** 2026-07-10
**Valor Principal:** Dar à equipe da JSR visibilidade em tempo real da saúde de cada cliente (verba, campanhas, contratos, financeiro) em um único painel, com alertas proativos.

## Requisitos v1

Requisitos da primeira versão. Cada um será mapeado para uma fase do roadmap.

### Acesso (ACES)

- [ ] **ACES-01**: Usuário pode fazer login no sistema com email e senha
- [ ] **ACES-02**: Sistema suporta múltiplos usuários internos da equipe da JSR
- [ ] **ACES-03**: Sessão do usuário permanece ativa entre acessos

### Clientes e Contratos (CLI)

- [ ] **CLI-01**: Usuário pode cadastrar um cliente com nome e objetivo/nicho (e-commerce, negócio local, infoproduto)
- [x] **CLI-02**: Usuário pode registrar o contrato do cliente (data de início, data de vencimento/renovação, valor)
- [x] **CLI-03**: Usuário pode editar dados de cliente e contrato
- [x] **CLI-04**: Usuário pode ver lista de todos os clientes ativos com status resumido

### Tráfego Pago (TRAF)

- [ ] **TRAF-01**: Sistema sincroniza dados das contas de anúncio dos clientes a partir do Meta Ads (via conta da agência)
- [ ] **TRAF-02**: Sistema sincroniza dados das contas de anúncio dos clientes a partir do Google Ads (via conta MCC da agência)
- [ ] **TRAF-03**: Usuário pode ver, por cliente, o status da conta de anúncios (ativa, com problema, verba disponível)
- [ ] **TRAF-04**: Usuário pode ver, por cliente, a lista de campanhas ativas/pausadas com verba gasta e restante
- [ ] **TRAF-05**: Usuário pode ver, por cliente, quais criativos/anúncios estão performando bem ou mal
- [ ] **TRAF-06**: Sistema exibe data/hora da última sincronização de dados por cliente (para identificar falha de integração)

### Alertas (ALRT)

- [ ] **ALRT-01**: Usuário pode configurar um limiar de verba mínima por cliente
- [ ] **ALRT-02**: Sistema exibe alerta dentro do sistema quando a verba de um cliente cruza o limiar configurado
- [ ] **ALRT-03**: Sistema exibe alerta quando o contrato de um cliente está próximo do vencimento
- [ ] **ALRT-04**: Alerta de vencimento de contrato exibe junto o valor de MRR em risco
- [ ] **ALRT-05**: Sistema detecta e alerta quedas bruscas de métricas de performance em relação à semana anterior

### Relatórios (REL)

- [ ] **REL-01**: Sistema gera automaticamente relatório semanal por cliente com dados das campanhas
- [ ] **REL-02**: Conteúdo do relatório é segmentado conforme o objetivo do cliente (e-commerce, negócio local, infoproduto)
- [ ] **REL-03**: Relatório é gerado em formato de texto pronto para copiar e colar (ex: WhatsApp)
- [ ] **REL-04**: Relatório inclui comparação com o período anterior (semana vs. semana anterior)

### Financeiro (FIN)

- [ ] **FIN-01**: Usuário pode ver a data de cobrança de cada cliente
- [ ] **FIN-02**: Sistema calcula e exibe o MRR total (soma dos contratos ativos)
- [ ] **FIN-03**: Usuário pode ver receita e clientes ativos num painel financeiro consolidado

### Painel Geral (DASH)

- [ ] **DASH-01**: Usuário vê painel geral com visão consolidada de todos os clientes ativos (verba, contrato, performance) em uma única tela
- [ ] **DASH-02**: Painel geral destaca o que precisa de atenção imediata (verba baixa, contrato vencendo, queda de performance)

## Requisitos v2

Adiados para versão futura. Não fazem parte do roadmap atual.

### Alertas (ALRT)

- **ALRT-06**: Alertas escalonados por estágio (ex: contrato a 90/60/30 dias do vencimento; verba a 80%/50%/20%)

### Tráfego Pago (TRAF)

- **TRAF-07**: Suporte a outras plataformas de anúncio além de Meta Ads e Google Ads (ex: TikTok Ads, LinkedIn Ads)

### Relatórios (REL)

- **REL-05**: Envio automático do relatório direto para o WhatsApp do cliente (via API), sem precisar copiar/colar manualmente

## Fora de Escopo

Exclusões explícitas. Documentadas para evitar retrabalho e discussões repetidas.

| Funcionalidade | Motivo |
|---|---|
| Portal de acesso para os clientes finais | v1 é uso interno da equipe JSR apenas; sem demanda validada de cliente pedindo autoatendimento |
| Otimização de campanhas dentro do sistema (pausar, ajustar verba direto pela ferramenta) | Exigiria acesso de escrita nas contas de anúncio e trava de segurança extra; sistema é de visibilidade, não de operação — otimização continua no gerenciador nativo |
| Processamento de pagamentos/faturamento automatizado | Traria complexidade de compliance e integração com gateway de pagamento; v1 é apenas visibilidade de datas e valores |
| CRM de pipeline de vendas completo (funil de leads, etapas de negociação) | Todos os clientes já são contas ativas e assinadas; não há necessidade de pipeline de novos negócios hoje |
| Integração com dezenas de fontes de dados (SEO, email, social orgânico) | Necessidade real hoje é só Meta Ads e Google Ads; cada fonte extra é manutenção sem demanda validada |
| Decisão sobre substituir ou complementar o ClickUp | Ainda em aberto; revisar depois que o core do sistema estiver validado |
| Inteligência artificial para insights preditivos | Com poucos clientes, alertas de limiar simples resolvem o mesmo problema com muito menos complexidade |

## Rastreabilidade

Quais fases cobrem quais requisitos. Preenchido durante a criação do roadmap.

| Requisito | Fase | Status |
|---|---|---|
| ACES-01, ACES-02, ACES-03 | Fase 1 | Pendente |
| CLI-01, CLI-02, CLI-03, CLI-04 | Fase 1 | Pendente |
| TRAF-01, TRAF-02, TRAF-06 | Fase 2 | Pendente |
| TRAF-03, TRAF-04, TRAF-05 | Fase 3 | Pendente |
| ALRT-01, ALRT-02, ALRT-05 | Fase 3 | Pendente |
| ALRT-03, ALRT-04 | Fase 4 | Pendente |
| FIN-01, FIN-02, FIN-03 | Fase 4 | Pendente |
| REL-01, REL-02, REL-03, REL-04 | Fase 5 | Pendente |
| DASH-01, DASH-02 | Fase 6 | Pendente |

**Cobertura:**
- Requisitos v1: 27 no total (correção: contagem anterior de 26 estava incorreta — TRAF possui 6 itens, não 5)
- Mapeados para fases: 27
- Não mapeados: 0 ✓

---
*Requisitos definidos em: 2026-07-10*
*Última atualização: 2026-07-10 após criação do roadmap*

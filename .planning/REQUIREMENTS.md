# Requisitos: Sistema JSR

**Definido em:** 2026-07-10
**Valor Principal:** Dar à equipe da JSR visibilidade em tempo real da saúde de cada cliente (verba, campanhas, contratos, financeiro) em um único painel, com alertas proativos.

## Requisitos v1

Requisitos da primeira versão. Cada um será mapeado para uma fase do roadmap.

### Acesso (ACES)

- [x] **ACES-01**: Usuário pode fazer login no sistema com email e senha
- [x] **ACES-02**: Sistema suporta múltiplos usuários internos da equipe da JSR
- [x] **ACES-03**: Sessão do usuário permanece ativa entre acessos

### Clientes e Contratos (CLI)

- [x] **CLI-01**: Usuário pode cadastrar um cliente com nome e objetivo/nicho (e-commerce, negócio local, infoproduto)
- [x] **CLI-02**: Usuário pode registrar o contrato do cliente (data de início, data de vencimento/renovação, valor)
- [x] **CLI-03**: Usuário pode editar dados de cliente e contrato
- [x] **CLI-04**: Usuário pode ver lista de todos os clientes ativos com status resumido

### Tráfego Pago (TRAF)

- [x] **TRAF-01**: Sistema sincroniza dados das contas de anúncio dos clientes a partir do Meta Ads (via conta da agência)
- [~] **TRAF-02**: Sincroniza Google Ads via MCC da agência — **no ar** (OAuth + sync + telas + abas por plataforma). ⚠️ Métricas (spend/leads/roas/ctr) ainda não validadas contra campanha real (PASSO B).
- [x] **TRAF-03**: Usuário pode ver, por cliente, o status da conta de anúncios (ativa, com problema, verba disponível)
- [x] **TRAF-04**: Usuário pode ver, por cliente, a lista de campanhas ativas/pausadas com verba gasta e restante
- [x] **TRAF-05**: Usuário pode ver, por cliente, quais criativos/anúncios estão performando bem ou mal
- [x] **TRAF-06**: Sistema exibe data/hora da última sincronização de dados por cliente (para identificar falha de integração)

### Alertas (ALRT)

- [~] **ALRT-01**: Limiar de verba mínima por cliente — **PARCIAL**: alerta de saldo baixo funciona, mas o limiar é fixo no código (R$50/R$100 p/ todos); falta torná-lo configurável por cliente.
- [x] **ALRT-02**: Sistema exibe alerta dentro do sistema quando a verba de um cliente cruza o limiar (hoje o limiar fixo — ver ALRT-01)
- [x] **ALRT-03**: Sistema exibe alerta quando o contrato de um cliente está próximo do vencimento
- [x] **ALRT-04**: Alerta de vencimento de contrato exibe junto o valor de MRR em risco
- [x] **ALRT-05**: Sistema detecta e alerta quedas bruscas de métricas de performance em relação à semana anterior

### Relatórios (REL)

- [x] **REL-01**: Sistema gera automaticamente relatório semanal por cliente com dados das campanhas
- [x] **REL-02**: Conteúdo do relatório é segmentado conforme o objetivo do cliente (e-commerce, negócio local, infoproduto)
- [x] **REL-03**: Relatório é gerado em formato de texto pronto para copiar e colar (ex: WhatsApp)
- [~] **REL-04**: Comparação com o período anterior — **FALTA**: o relatório mostra números absolutos; a base de janelas "anterior" existe na engine, mas o texto ainda não traz "semana vs. semana anterior".

### Financeiro (FIN)

- [x] **FIN-01**: Usuário pode ver a data de cobrança de cada cliente
- [x] **FIN-02**: Sistema calcula e exibe o MRR total (soma dos contratos ativos)
- [x] **FIN-03**: Usuário pode ver receita e clientes ativos num painel financeiro consolidado

### Painel Geral (DASH)

- [x] **DASH-01**: Usuário vê painel geral com visão consolidada de todos os clientes ativos (verba, contrato, performance) em uma única tela
- [x] **DASH-02**: Painel geral destaca o que precisa de atenção imediata (verba baixa, contrato vencendo, queda de performance)

### Contratos (CONT) — adicionado em 2026-07-10 (feedback do usuário)

- [x] **CONT-01**: Aba própria "Contratos" com todos os contratos numa lista/tabela única — **entregue** (inclui PDF + assinatura via Autentique)

### Checklist (CHK) — adicionado em 2026-07-10 (feedback do usuário)

- [x] **CHK-01**: Checklist operacional recorrente por cliente — **entregue** (evoluiu para o módulo de Tarefas estilo ClickUp com recorrência; a aba Checklist da ficha foi consolidada no redesign 260723-v8z)

### Acompanhamento (ACOMP) — adicionado em 2026-07-10 (feedback do usuário)

- [x] **ACOMP-01**: Acompanhamento/histórico de interações por cliente — **entregue** (feed de atividades; no redesign passou a viver no card "Atividades recentes" + registro dentro de Observações na ficha)

### Verbas Ads (VBA) — adicionado em 2026-07-10 (feedback do usuário)

- [x] **VBA-01**: Tela dedicada de controle de verbas de anúncio por cliente — **entregue** (/verbas com saldo, status e forma de pagamento manual)

### Funil (FUN) — adicionado em 2026-07-10 (feedback do usuário; reverte exclusão original)

- [x] **FUN-01**: Funil/pipeline de clientes/oportunidades — **entregue e superado** (CRM comercial completo estilo Pipedrive + prospecção fria)

> **Legenda:** `[x]` entregue · `[~]` parcial/a validar (ver as 3 pendências abaixo na Rastreabilidade)

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
| Integração com dezenas de fontes de dados (SEO, email, social orgânico) | Necessidade real hoje é só Meta Ads e Google Ads; cada fonte extra é manutenção sem demanda validada |
| Decisão sobre substituir ou complementar o ClickUp | Ainda em aberto; revisar depois que o core do sistema estiver validado |
| Inteligência artificial para insights preditivos | Com poucos clientes, alertas de limiar simples resolvem o mesmo problema com muito menos complexidade |

## Rastreabilidade

Status reconciliado com o **código real** em 2026-07-24 (o produto foi entregue via ~90 quick tasks, não pelo fluxo formal de fases — por isso a coluna reflete evidência de código, não VERIFICATION.md por fase).

| Requisito | Fase | Status |
|---|---|---|
| ACES-01, ACES-02, ACES-03 | Fase 1 | ✅ Concluído |
| CLI-01, CLI-02, CLI-03, CLI-04 | Fase 1 | ✅ Concluído (ficha redesenhada em 260723-v8z) |
| TRAF-01, TRAF-06 | Fase 2 | ✅ Concluído (Meta) |
| TRAF-02 | Fase 2 | 🟡 No ar; validar métricas com campanha real (PASSO B) |
| TRAF-03, TRAF-04, TRAF-05 | Fase 3 | ✅ Concluído |
| ALRT-01 | Fase 3 | 🟡 Parcial — limiar fixo no código, falta ser configurável por cliente |
| ALRT-02, ALRT-05 | Fase 3 | ✅ Concluído |
| ALRT-03, ALRT-04 | Fase 4 | ✅ Concluído |
| FIN-01, FIN-02, FIN-03 | Fase 4 | ✅ Concluído |
| REL-01, REL-02, REL-03 | Fase 5 | ✅ Concluído |
| REL-04 | Fase 5 | 🔴 Falta — comparação semana-vs-semana no texto |
| DASH-01, DASH-02 | Fase 6 | ✅ Concluído |
| CONT-01, CHK-01, ACOMP-01, VBA-01, FUN-01 | Entregue via quick tasks | ✅ Concluído (funcionais, com dados reais — não são mais scaffold) |

**Cobertura (2026-07-24):**
- Requisitos v1: 32 no total
- ✅ Concluídos: 29
- 🟡/🔴 Pendentes: 3 — **TRAF-02** (validar dado real), **ALRT-01** (limiar configurável), **REL-04** (comparação no relatório)
- Percentual v1: **~95%** (essencialmente entregue e em produção)

**Escopo ALÉM do v1 já construído (bônus):** CRM comercial + prospecção fria, agenda (Google Calendar), assinatura de contratos (Autentique), cobrança automática (Asaas), chat com IA, CAC/LTV, ferramentas. Ver `v1.0-MILESTONE-AUDIT.md`.

**As 3 pendências para fechar o v1 em 100%:**
1. **TRAF-02** — subir campanha Google real, sincronizar e conferir spend/leads/roas/ctr; depois liberar Google em Relatórios/Saúde/Alertas.
2. **ALRT-01** — adicionar limiar de verba configurável por cliente (hoje `THRESHOLD_CRITICO_SALDO=50` / `THRESHOLD_ATENCAO_SALDO=100` fixos em `src/lib/alertas/avaliar.ts`).
3. **REL-04** — puxar a comparação com o período anterior para o texto do relatório (janelas "anterior" já existem em `src/lib/relatorios/engine.ts`).

---
*Requisitos definidos em: 2026-07-10*
*Última atualização: 2026-07-24 — rastreabilidade reconciliada com o código real (29/32 concluídos; 3 pendências mapeadas). Antes: 2026-07-10 (scope expandido + priorização Meta-first).*

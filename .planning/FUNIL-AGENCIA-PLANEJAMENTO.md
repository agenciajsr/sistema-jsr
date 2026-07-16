# Planejamento — Reformular o Sistema JSR em torno do FUNIL da agência

**Criado em:** 2026-07-16. Documento vivo — captura a visão completa do funil (do comercial ao sucesso do cliente) e a quebra em FASES/PARTES priorizáveis.
**Origem:** conversa do usuário descrevendo o passo a passo real da agência para transformar o sistema num "sistema único" que acompanha o lead da captação até virar cliente ativo.
**Regra:** priorizar por FASE. A gente ataca uma parte de cada vez, com o usuário aprovando cada etapa. **Fase 1 = Entrada do Lead** (em foco agora).

---

## Visão geral — o funil da agência (do lead ao cliente ativo)

1. **Captação do lead** — indicação, tráfego pago (form instantâneo Meta), prospecção fria, ativas via WhatsApp/Instagram, evento/network/parceria. Tudo deve cair no CRM via webhook.
2. **CRM** — lead entra, passa pelas etapas do pipeline.
3. **Agendamento** — ao agendar reunião: criar atividade/tarefa no lead + evento na Agenda do Google + aviso no dashboard.
4. **Proposta enviada** — etapa do CRM.
5. **Ganho (vendeu)** — lead vira cliente.
6. **Contrato** — formulário com variáveis do contrato → assinatura via Autentic (API) → status.
7. **Cliente aguardando início** — enquanto não assina.
8. **Cliente ativo** — ao assinar: tipo de contrato + mensalidade.
9. **Cobrança / mensalidade** — Asaas (API) para cobranças automáticas (fase futura).
10. **Onboarding / sucesso do cliente** — acessos, tarefas, contas de anúncio, operação.

### Reality-check: o que JÁ EXISTE no código (16/jul/2026)

| Etapa | Status | Observação |
|---|---|---|
| Captação (webhook) | ✅ Existe | `POST /api/crm/leads` (token `x-crm-token` = `CRM_LEADS_TOKEN`), valida com Zod (`leadEntradaSchema`), processa via `processarLead` (ingest). |
| Guardar payload do lead | ✅ Existe | O ingest grava o lead inteiro (incl. campo livre `extra`) em `crm_contatos.origem_detalhe` (jsonb). **UTM e respostas de form já podem ser recebidas e persistidas hoje.** |
| Origem do lead (cadastro manual) | ✅ Existe | Seletor no "Novo Lead", default `manual`. Opções: manual, whatsapp, landing_page, meta_lead_ad, indicacao, outro. |
| Rastreamento UTM no card | ❌ Falta UI | Dado pode chegar; falta a ABA "Rastreamento" no card + estrutura clara (campanha/conjunto/anúncio). |
| Respostas do form no card | ❌ Falta UI | Idem — falta exibir as respostas qualificadoras no card. |
| CRM (etapas, proposta, ganho) | ✅ Existe | Pipeline, etapas, Ganho/Perdido. |
| Agendamento → Google Agenda | 🟡 Construído, não ligado | OAuth 2-vias + migration 0011 prontos; falta criar credenciais no Google Cloud + deploy (ver memória `google-calendar-pendente-setup`). |
| Ganho → virar Cliente | ❌ Falta | Sem automação lead ganho → ficha de cliente. |
| Contratos (form + Autentic) | 🟡 Página existe, vazia | Nunca trabalhada. Precisa form + integração Autentic. |
| Cliente aguardando → ativo | 🟡 Parcial | Status de cliente existe em parte. |
| Cobrança (Asaas) | 🟡 Manual hoje | Decisão registrada: manual agora, API depois. |
| Onboarding (acessos/tarefas/contas) | 🟡 Parcial | Tarefas e contas de anúncio por cliente existem. |

---

## Quebra em FASES (ordem de prioridade)

- **FASE 1 — Entrada do Lead** ⬅️ EM FOCO. Toda captação caindo no CRM + card mostrando rastreamento e respostas.
- **FASE 2 — Agendamento → Google Agenda** (ativar o que já existe + criar atividade/tarefa + evento + aviso).
- **FASE 3 — Ganho → Cliente** (costura CRM→cliente; "converter em cliente" + status "aguardando início").
- **FASE 4 — Contratos + Assinatura (Autentic)** (form de variáveis, envio, retorno de assinado → ativa cliente).
- **FASE 5 — Cobrança (Asaas)** (cobranças automáticas — fase futura).
- **FASE 6 — Onboarding / Sucesso do Cliente** (checklist de acessos/tarefas ao virar ativo).

> Ordem pode mudar. A Fase 2 (agendamento) é candidata a "furar a fila" por já estar ~90% pronta.

---

## FASE 1 — Entrada do Lead (detalhada)

**Objetivo:** todo lead, venha de onde vier, cai no nosso CRM com **origem correta**, e o card mostra **de onde veio (rastreamento/UTM)** e **o que ele respondeu** no formulário — para o usuário/SDR qualificar antes de ligar.

### Fontes de lead a suportar
1. **Formulário instantâneo do Meta (Lead Ads)** — lead preenche perguntas qualificadoras (ex.: nicho da clínica de estética, faturamento, disponibilidade de investir R$1.500/mês no tráfego). As **respostas** precisam aparecer no card. Mesmo caso para vídeos/Instagram (ex.: ManyChat) que também trazem respostas.
2. **Landing page / formulário próprio** — POST direto no nosso endpoint.
3. **Extensão de WhatsApp (CRM de disparo)** — extensão do WhatsApp Web que faz disparo para listas. Hoje o usuário levava esses leads via **Make**: webhook da extensão → filtrava só quem era "frio" (variável entre colunas) → Google Sheets → ClickUp. Ideia: trazer direto pro nosso CRM. **Baixa prioridade** dentro da Fase 1 (fazer por último), mas mapeado.
4. **Indicação / evento / network / parceria** — hoje via cadastro manual.

### O que construir na Fase 1
1. **Aba "Rastreamento" no card do lead** (`ficha-lead.tsx`): exibe origem + UTM (source/medium/campaign/content/term) e, quando Meta, **campanha / conjunto / anúncio**. Fonte do dado: `origem_detalhe` (já persistido) — provavelmente estruturar melhor (colunas dedicadas ou sub-objeto `utm`/`rastreamento` dentro do jsonb).
2. **Bloco "Respostas do formulário" no card**: renderiza pergunta→resposta a partir do payload (`origem_detalhe.respostas` ou `extra`). Genérico (funciona pra qualquer conjunto de perguntas).
3. **Definir o contrato do payload de entrada**: padronizar como UTM e respostas chegam no `POST /api/crm/leads` (ex.: `extra: { utm: {...}, respostas: [{pergunta, resposta}], meta: {campaign, adset, ad} }`). Validar com Zod.
4. **Expandir a taxonomia de origem**: adicionar Prospecção fria, Instagram, Evento/Network, Parceria (hoje só 6 opções). Mexe em `ORIGENS_LEAD`, `FONTES_LEAD` e `ORIGEM_META` (cor/nome/rótulo) — manter as duas listas em sincronia (comentário no código avisa).
5. **Conectar as fontes** (uma a uma):
   - Landing/form próprio → POST direto (sem intermediário).
   - Meta Lead Ads → **decisão de integração** (ver abaixo).
   - Extensão WhatsApp → receber o webhook dela (usuário vai mandar exemplo do payload).

### Make vs. construir em casa (resposta à dúvida do usuário)

**Receber + filtrar + deduplicar = 100% dentro do nosso sistema.** Já temos o endpoint e o ingest que guarda tudo. A lógica que o usuário fazia no Make (pegar só o "frio", evitar duplicado) a gente faz DENTRO do nosso endpoint — **sem precisar de Google Sheets nem ClickUp no meio.**

O que varia é o **lado de quem ENVIA**:
- **Fontes que deixam configurar webhook (URL + header):** extensão do WhatsApp, landing pages, formulários próprios → **POST direto pra gente, sem Make.** Basta o usuário mandar um exemplo do payload que eu construo o parser/validação no nosso sistema.
- **Meta Lead Ads (form instantâneo):** o Meta NÃO posta as respostas numa URL qualquer. Dois caminhos:
  - **(a) Nativo (tudo em casa):** assinar o webhook `leadgen` da página no Meta → o Meta avisa nosso endpoint com um `leadgen_id` → a gente busca as respostas (`field_data`) via Graph API. **Já temos acesso à API do Meta** (System User token da integração de campanhas), então é viável; exige permissão `leads_retrieval` + inscrição da página (possível App Review).
  - **(b) Ponte via Make/Zapier:** conecta Meta → nosso endpoint em minutos, sem App Review. Mais rápido pra começar.
  - **Recomendação:** começar a Fase 1 pelas fontes de POST direto (rápidas e 100% nossas); para o Meta, decidir entre nativo (mais setup, mais "em casa") e Make (mais rápido). Como já temos o token do Meta, tendo a sugerir o nativo — mas dá pra subir com Make e migrar depois.

### Restrições/decisões da Fase 1
- Migration na mão SEMPRE (se precisar de coluna nova; talvez nem precise, `origem_detalhe` já existe).
- Endpoint público (`/api/crm/leads`) já é protegido por token — manter.
- Tudo em português. Deploy: `git push origin master`.

### Perguntas em aberto (para destravar a Fase 1)
- Payload real da **extensão de WhatsApp** (exemplo do webhook do Make) — o usuário vai tentar mandar.
- Exemplos de **campanha de formulário instantâneo** do Meta (perguntas) — o usuário vai mandar.
- Meta: **nativo vs. Make** — a decidir.

---

## Pendências transversais (não são fase, mas afetam várias)

- **Integrações externas a estudar** antes de codar a fase respectiva: Autentic (API de assinatura), Asaas (API de cobrança), fonte do formulário de contrato (próprio vs. externo via webhook).
- **Google Calendar**: credenciais no Google Cloud pendentes (bloqueio da Fase 2).

---

## Log de decisões
- 2026-07-16: criado o planejamento; **Fase 1 (Entrada do Lead) priorizada**. Confirmado que webhook de captação + persistência em `origem_detalhe` já existem — Fase 1 foca em EXIBIR (rastreamento + respostas no card), padronizar payload, expandir origens e conectar fontes.

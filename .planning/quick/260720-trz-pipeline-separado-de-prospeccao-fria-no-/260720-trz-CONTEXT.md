# Quick Task 260720-trz: Pipeline separado de Prospecção Fria no CRM - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Task Boundary

Criar um pipeline separado "Prospecção Fria" no CRM para os leads de disparo frio não poluírem o funil de Vendas (inbound). Rotear leads de fonte `prospeccao_fria` para o novo funil na ingestão, migrar os 14 frios já existentes, e deixar a graduação frio→Vendas manual no v1.
</domain>

<decisions>
## Implementation Decisions

### Etapas do funil "Prospecção Fria"
- Conjunto ENXUTO de 4 etapas: **A Abordar → Abordado → Respondeu → Qualificado**.
- NÃO criar coluna "Sem resposta". Quem não responde após os follow-ups vira **Perdido** (status perdido, motivo "sem resposta") — reusa o mecanismo de perda que já existe no CRM. Board limpo para equipe pequena.
- Probabilidades sugeridas (ajustáveis): A Abordar 5%, Abordado 10%, Respondeu 25%, Qualificado 40% — crescendo com o engajamento. A "Respondeu" é o primeiro sinal real de valor no frio (a resposta, não o contato).

### Ponto de entrada do lead frio
- A automação de mensagem automática do sistema (`mensagem_lead_novo`) NÃO está configurada/ligada (verificado no banco: só `aviso_lead_novo`, desligada) → o sistema NÃO dispara sozinho. O disparo de hoje foi por ferramenta EXTERNA.
- Portanto: **todo lead frio novo (fonte `prospeccao_fria`) nasce em "A Abordar"** (você/ferramenta ainda vai abordar; o sistema não mandou nada).
- **Os 14 frios de hoje** (já em "Novo Lead" do Vendas, `primeiro_contato_em` vazio) → migrar para o pipeline Frio na etapa **"Abordado"**, pois o disparo externo já saiu hoje.

### Roteamento na ingestão
- Alterar `processarLead` (src/lib/crm/ingest.ts): quando `lead.fonte === 'prospeccao_fria'`, a oportunidade nasce no pipeline "Prospecção Fria" na etapa "A Abordar"; qualquer outra fonte continua no pipeline padrão "Vendas" (primeira etapa, comportamento atual).
- Manter as QUERIES SEQUENCIAIS (pool max=3, max_pipeline=0 — ver comentário em src/lib/db/index.ts e ingest.ts). Nada de Promise.all.
- Lógica de escolha do pipeline/etapa deve ser testável.

### Graduação frio → Vendas
- **Manual no v1**: o usuário move o card para o funil Vendas quando o frio qualifica. Verificar se a board do /crm já permite trocar de pipeline e mover card entre pipelines; se NÃO permitir, isso vira item à parte (fora do escopo deste quick — sinalizar, não implementar do zero aqui).

### Criação do pipeline (dado, não schema)
- Pipeline e etapas são DADOS (tabelas crm_pipelines / crm_etapas já existem). Criar via SCRIPT de seed aplicado direto (padrão da casa, ex.: scripts/aplicar-migration-XXXX.ts), idempotente. **SEM migration de schema.**
- Migração dos 14 leads também via script pontual idempotente (com contagem/backup no padrão dos scripts existentes).

</decisions>

<specifics>
## Specific Ideas

- Pipeline "Vendas" atual (referência): Novo Lead(10%)→Contato Feito(20%)→Follow-up(25%)→Qualificado(40%)→Reunião Agendada(60%)→Proposta Enviada(75%)→Negociação(90%).
- Já existe 2º pipeline "Gestão de Projetos" → a board do CRM já lida com múltiplos pipelines (confirmar seletor).
- Fonte `prospeccao_fria` já é valor válido em FONTES_LEAD e ORIGENS_LEAD (src/lib/validations/crm.ts).
- Campo `crm_oportunidades.primeiro_contato_em` (timestamp) + SLA de primeiro contato existem — a etapa "Abordado" pode/deveria setar esse timestamp na migração dos 14 (registra que o contato saiu).
</specifics>

<canonical_refs>
## Canonical References

- src/lib/crm/ingest.ts (processarLead — ponto de roteamento)
- src/lib/validations/crm.ts (FONTES_LEAD / ORIGENS_LEAD)
- src/lib/crm/origem.ts (ORIGEM_META — rótulos/cores de origem)
- scripts/aplicar-migration-0037.ts e 0039.ts (padrão de script idempotente aplicado à mão)
- src/lib/db/schema.ts (crm_pipelines ~842, crm_etapas, crm_oportunidades.primeiro_contato_em ~877)
</canonical_refs>

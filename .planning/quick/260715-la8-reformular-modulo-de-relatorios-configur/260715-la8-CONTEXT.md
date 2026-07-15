# Quick Task 260715-la8: Reformular módulo de relatórios — Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Task Boundary

Reformular o módulo `/relatorios`: de "relatório semanal fixo por cliente" para **relatórios configuráveis** (semanal OU mensal), com blocos de métricas por conta de anúncio, seleção de campanhas, métricas personalizáveis por bloco, templates de mensagem com variáveis e resumo compilado. Referências visuais em `imagens_referencia_relatorios/` (ferramenta Creativivo + sistema de um amigo do usuário).

</domain>

<decisions>
## Implementation Decisions

### Envio WhatsApp
- **Copiar e colar por enquanto.** O sistema gera o texto pronto na data certa; NÃO integrar API de WhatsApp nesta versão.
- Campos de destino (número OU grupo — toggle privado/grupo) ficam salvos na config para ativar envio automático no futuro.

### Estrutura do relatório
- **Blocos de métricas** (modelo do sistema do amigo): um relatório tem N blocos; cada bloco = conta de anúncio (Meta hoje; Google Ads aparece como opção desabilitada "em breve") + nível (conta inteira OU campanhas selecionadas) + métricas escolhidas + mensagem do bloco com variáveis.
- Bloco final opcional de **Resumo Compilado** somando investimento/resultados de todos os blocos (caso real: cliente com 2 contas — leads numa, vendas noutra — recebe bloco leads, bloco vendas e compilado).
- Cabeçalho do relatório com variáveis (ex.: `<DATA>` / `{{date_range}}`).

### Agendamento
- **Cron diário único** (substitui o cron semanal atual `relatorios-semanais` — continua 1 slot, dentro do limite Hobby). A cada execução, gera os relatórios "devidos hoje": semanais no dia da semana configurado, mensais no dia do mês configurado.
- Sem hora exata de envio (limitação Hobby aceita). Campo horário fica salvo para o futuro.
- Período dos dados: semanal padrão = últimos 7 dias completos (segunda a domingo anterior, sem contar o dia do envio); mensal = mês anterior/últimos 30 dias. Configurável em dias.

### Templates e variáveis
- Galeria de templates de mensagem (mínimo: Foco em Conversas, Resumo Executivo, Foco em Performance — inspirados na Creativivo; aproveitar/migrar os templates existentes em `src/lib/relatorios/templates-whatsapp.ts`).
- Catálogo de variáveis clicáveis por categoria (gerais: data/conta/período; cliques: cliques/CTR/CPC/CPM; leads; mensagens/conversas; vendas: compras/receita/ROAS/CPA; página: visitas landing page), preenchidas a partir dos dados Meta já sincronizados.
- Preview do relatório com dados de exemplo antes de salvar.

### UI
- Página `/relatorios` com botão "Novo Relatório" → modal/dialog central (padrão shadcn Dialog, como no CRM), listagem das configurações (nome, cliente, frequência, próximo envio, ativo/pausado) + relatórios gerados prontos para copiar.
- Toggle "Relatório ativo" (pausar não perde configuração).
- Textos pt-BR.

### Claude's Discretion
- Modelagem exata das tabelas (config, blocos, gerados) via Drizzle migration seguindo padrão existente.
- Como reaproveitar `gerar-relatorio.ts` / objetivos de cliente existentes.
- Detalhes visuais finos (espelhar referências sem copiar pixel a pixel; manter design system do app).

</decisions>

<specifics>
## Specific Ideas

- Referências: `imagens_referencia_relatorios/*.png` (13 prints — modal Novo Relatório, galeria de templates, catálogo de campos, seleção de campanhas com métricas por objetivo, blocos de métricas do sistema do amigo).
- Caso de uso chave: cliente com 2 contas de anúncio (leads + vendas) → relatório com bloco por conta + compilado, para medir ROAS verdadeiro por tipo de campanha.
- Envio típico: toda segunda-feira, dados de segunda a domingo anteriores.

</specifics>

<canonical_refs>
## Canonical References

- Código atual: `src/lib/relatorios/gerar-relatorio.ts`, `src/lib/relatorios/templates-whatsapp.ts`, `src/actions/relatorios.ts`, `src/app/(app)/relatorios/`, `src/app/api/cron/relatorios-semanais/route.ts`, `vercel.json` (crons)
- Dados Meta: tabelas/sync existentes do quick 260711-q7a e ajustes 260712-jd7

</canonical_refs>

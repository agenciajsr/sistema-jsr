# SUMMARY — quick-260717-elo — Dashboard Comercial (/funil) + mapa mental

**Concluído em:** 2026-07-17

## O que foi entregue

### 1. Módulo puro `src/lib/crm/funil-comercial.ts` (TDD)
- `calcularPeriodo`: 4 presets (este-mes, mes-passado, ultimos-30, este-ano) com período anterior de mesma duração (viradas de mês/ano e meses curtos cobertos).
- `variacaoPercentual` (base zero → null, UI mostra "—"), `taxaConversao` (denominador zero → 0).
- `montarDashboard`: agregados crus dos dois períodos → 5 KPIs com variação, funil (3 degraus + 2 taxas), métricas de performance (Conversão Total, Ticket Médio, Receita/Lead) e origens com pct. Zero NaN/Infinity nos casos tudo-zero.
- Testes em `funil-comercial.test.ts` — todos passando; suíte completa do projeto sem quebras.

### 2. `src/lib/crm/dados-funil.ts` — getDashboardComercial
- Queries SEQUENCIAIS e AGREGADAS (padrão de dados.ts, pool max=3): pipelines → etapas → agregados por período (criadas por createdAt; ganhas+receita por ganhaEm; perdidas por perdidaEm; agendadas por heurística) → origens (GROUP BY).
- Heurística AGENDADO documentada: criada no período E (tarefa tipo 'reuniao' vinculada OU etapa com ordem >= "Reunião agendada" OU status ganha).
- Degradação graciosa sem workspace (`configurado: false`) e try/catch com retorno vazio.
- Fuso de Brasília: hoje via Intl (America/Sao_Paulo), limites do intervalo em UTC-3.

### 3. Página /funil + sidebar
- `src/app/(app)/funil/page.tsx` deixou de ser redirect → Server Component real com searchParams (periodo/pipeline) e aviso âmbar quando CRM não ativado.
- `src/components/funil/funil-view.tsx`: header com selects de período e pipeline (navegação por URL), 5 KPIs com variação colorida (Leads Perdidos com semântica invertida), Métricas de Performance e Origem dos leads (barras + rótulos de origem.ts, estado vazio "Sem leads no período").
- `src/components/funil/funil-visual.tsx`: funil em trapézio (clip-path) fiel à referência — 2 degraus escuros + base verde "Pagou", taxas Novo lead→Agendado e Agendado→Pagou.
- Sidebar: item "Funil de Vendas" (/funil, TrendingUp) no grupo Comercial após o CRM.

### 4. Mapa mental (placar 17/jul)
- 3 cores: verde #22C55E (feito), amarelo #FFB020 (parcial), laranja #F97316 (pendente) + legenda nova.
- Bloco 04 Pagamento sem tracejado, azul, "Asaas conectado — E2E validado ✓".
- Dones: motivo de perda, templates por serviço, fadiga de criativo, MRR, atividade de reunião → agenda. Parciais: origem/UTM, SLA, pacing, saúde de conta. Banda transversal → "EM CONSTRUÇÃO".

## Verificação
- `npx tsc --noEmit` limpo; `npx vitest run` completo: tudo passando.
- Checks do mapa mental (grep) OK.

## Commits
- test(quick-260717-elo): TDD do módulo puro
- feat(quick-260717-elo): módulo puro funil-comercial
- feat(quick-260717-elo): Dashboard Comercial em /funil + sidebar
- feat(quick-260717-elo): mapa mental com placar de 17/jul

---
phase: quick-260717-elo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/crm/funil-comercial.ts
  - src/lib/crm/funil-comercial.test.ts
  - src/lib/crm/dados-funil.ts
  - src/app/(app)/funil/page.tsx
  - src/components/funil/funil-view.tsx
  - src/components/funil/funil-visual.tsx
  - src/components/app-sidebar.tsx
  - Mapa_mental_sistema_operção/mapa_mental_sistema_jsr.html
autonomous: true
requirements: [FUNIL-DASH-01, MAPA-MENTAL-01]
must_haves:
  truths:
    - "Usuário abre /funil e vê o Dashboard Comercial com 5 KPIs reais do CRM (Novo lead, Agendado, Vendas, Receita Total, Leads Perdidos) com variação % vs período anterior"
    - "Usuário troca o período (Este mês / Mês passado / Últimos 30 dias / Este ano) e os números recalculam"
    - "Funil visual mostra Novo lead → Agendado → Pagou com taxas de conversão entre etapas"
    - "Painel Métricas de Performance mostra Conversão Total, Ticket Médio e Receita/Lead"
    - "Painel Origem dos leads mostra distribuição % real por origem"
    - "Sidebar tem entrada Funil de Vendas apontando para /funil"
    - "Mapa mental reflete o placar de 17/jul: verdes ✓ para o que foi entregue, amarelos parciais, laranjas pendentes, legenda com 3 cores e bloco 04 sem tracejado"
  artifacts:
    - path: "src/lib/crm/funil-comercial.ts"
      provides: "Matemática pura do funil (períodos, variações, taxas, merge)"
      min_lines: 60
    - path: "src/lib/crm/funil-comercial.test.ts"
      provides: "TDD do módulo puro"
      min_lines: 60
    - path: "src/lib/crm/dados-funil.ts"
      provides: "getDashboardComercial — queries agregadas sequenciais"
      min_lines: 80
    - path: "src/app/(app)/funil/page.tsx"
      provides: "Página /funil real (deixa de ser redirect)"
      contains: "getDashboardComercial"
    - path: "src/components/funil/funil-view.tsx"
      provides: "UI do dashboard comercial"
      min_lines: 100
  key_links:
    - from: "src/app/(app)/funil/page.tsx"
      to: "src/lib/crm/dados-funil.ts"
      via: "import getDashboardComercial (Server Component)"
      pattern: "getDashboardComercial"
    - from: "src/lib/crm/dados-funil.ts"
      to: "src/lib/crm/funil-comercial.ts"
      via: "merge/matemática em módulo puro"
      pattern: "funil-comercial"
    - from: "src/components/app-sidebar.tsx"
      to: "/funil"
      via: "item de navegação"
      pattern: "url: '/funil'"
---

<objective>
Entregar (B, principal) o Dashboard Comercial / Funil de Vendas na rota /funil sobre os dados reais do CRM, fiel à referência `Imagens_referencia_CRM/imagem_referencia_funil_vendas.png`, e (A) atualizar o mapa mental SVG com o placar real de 17/jul (verde=feito, amarelo=parcial, laranja=pendente).

Purpose: dar visão estratégica do funil comercial (leads → agendamentos → vendas) com números 100% reais, e alinhar o mapa mental ao estado atual do sistema.
Output: página /funil nova + item na sidebar + módulos de dados/matemática testados + mapa mental atualizado.
</objective>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/lib/db/schema.ts (linhas 660-920 — tabelas crm_*)
@src/lib/crm/dados.ts (getCrmVisaoGeral — PADRÃO de referência: queries sequenciais agregadas)
@src/lib/crm/reuniao.ts (ehEtapaReuniaoAgendada)
@src/app/(app)/crm/page.tsx (padrão de Server Component + searchParams + degradação graciosa)
@src/app/(app)/funil/page.tsx (hoje é redirect para /crm — será SUBSTITUÍDO)
@src/components/app-sidebar.tsx (grupo Comercial, linha ~66)
@Mapa_mental_sistema_operção/mapa_mental_sistema_jsr.html

<interfaces>
Contratos existentes que o executor deve usar direto (extraídos do código real):

De src/lib/db/schema.ts:
- `crmOportunidades`: { id, workspaceId, pipelineId, etapaId, contatoId, titulo, valor (numeric string), status 'aberta'|'ganha'|'perdida', origem, ganhaEm, perdidaEm, createdAt, ... }
- `crmEtapas`: { id, pipelineId, nome, ordem, probabilidade }
- `crmPipelines`: { id, workspaceId, nome, ordem, padrao }
- `crmTarefas`: { id, workspaceId, oportunidadeId, tipo ('reuniao'|'ligacao'|...), concluida, dataVencimento, createdAt }
- `crmContatos`: { id, workspaceId, origem, createdAt, ... }

De src/lib/crm/workspace.ts:
- `getWorkspaceAtual(): Promise<{ id: string, ... } | null>` — null = migration não aplicada → degradação graciosa (padrão VISAO_VAZIA de dados.ts)

De src/lib/crm/reuniao.ts:
- `ehEtapaReuniaoAgendada(nome: string): boolean` — identifica a etapa "Reunião agendada" pelo nome normalizado

De src/lib/crm/dados.ts (NÃO alterar — só imitar o padrão):
- queries SEQUENCIAIS (await um por um, nunca Promise.all), GROUP BY/count no banco, merge em memória, try/catch com retorno vazio.

De src/components/app-sidebar.tsx (linha ~66, grupo Comercial):
```ts
itens: [
  { title: 'CRM', url: '/crm', icon: Target },
  { title: 'Clientes', url: '/clientes', icon: Users },
  { title: 'Contratos', url: '/contratos', icon: FileSignature },
]
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Módulo puro funil-comercial (TDD) + getDashboardComercial (queries agregadas sequenciais)</name>
  <files>src/lib/crm/funil-comercial.ts, src/lib/crm/funil-comercial.test.ts, src/lib/crm/dados-funil.ts</files>
  <behavior>
    Módulo PURO `src/lib/crm/funil-comercial.ts` (zero import de db/auth/react — padrão do projeto, decisão 260714-ita). Testes ANTES da implementação:
    - `calcularPeriodo(preset, hojeISO)`: presets 'este-mes' | 'mes-passado' | 'ultimos-30' | 'este-ano' → `{ inicio, fim, inicioAnterior, fimAnterior }` (datas em fuso de Brasília; período anterior = MESMA duração imediatamente antes: este-mes → mesmo intervalo de dias do mês anterior; ultimos-30 → os 30 dias anteriores; este-ano → ano passado até a mesma data). Testes: os 4 presets com hojeISO fixo (ex.: '2026-07-17'), virada de mês (31 jan → fev) e de ano.
    - `variacaoPercentual(atual, anterior)`: number | null — anterior=0 → null (a UI mostra "—", como na referência); demais → ((atual-anterior)/anterior)*100. Testes: crescimento, queda, -100%, base zero.
    - `taxaConversao(numerador, denominador)`: 0 quando denominador=0; senão percentual. Testes: zero, normal.
    - `montarDashboard(insumos)`: recebe os agregados crus dos dois períodos ({ criadas, agendadas, ganhas, receita, perdidas } atual e anterior + origens[{origem, total}]) e devolve a estrutura pronta da página: 5 KPIs com variação, funil (3 degraus + 2 taxas: Novo lead→Agendado, Agendado→Pagou), métricas de performance (Conversão Total = ganhas/criadas; Ticket Médio = receita/ganhas; Receita/Lead = receita/criadas — cada uma com variação vs anterior) e origens com pct (origem null → 'outro', mesmo fallback de dados.ts). Testes: caso cheio, caso tudo-zero (nenhum NaN/Infinity — divisões por zero viram 0 ou null), receita como número.
  </behavior>
  <action>
    1. RED: escrever `funil-comercial.test.ts` com os casos acima; rodar e ver falhar. Commit `test(quick-260717-elo): ...`.
    2. GREEN: implementar `funil-comercial.ts`. Commit `feat(quick-260717-elo): ...`.
    3. Criar `src/lib/crm/dados-funil.ts` — módulo server comum SEM 'use server' (decisão 260715-0zf: nada de endpoint desnecessário), exportando `getDashboardComercial(pipelineIdParam?: string, preset?: PresetPeriodo)`:
       - Espelhar a estrutura de getCrmVisaoGeral: `getWorkspaceAtual()` → null = retorno vazio `{ configurado: false, ... }`; try/catch com console.error e retorno vazio.
       - Queries SEQUENCIAIS e AGREGADAS (pool max=3 — NUNCA Promise.all; o nº de queries NÃO cresce com o nº de oportunidades):
         (1) pipelines do workspace (mesmo select de dados.ts, alimenta o seletor; ativo = ?pipeline= → padrão → primeiro);
         (2) etapas do pipeline (para achar a etapa de reunião via `ehEtapaReuniaoAgendada(nome)` e sua `ordem`);
         (3) para CADA período (atual e anterior — 2 execuções sequenciais da mesma query): agregado único por status das oportunidades do pipeline com `createdAt` no intervalo → criadas (count), e separadamente ganhas no período por `ganhaEm` (count + sum(valor)) e perdidas por `perdidaEm` (count) — pode ser 2-3 queries por período com GROUP BY/count/sum no banco;
         (4) AGENDADO (heurística mais honesta com os dados existentes — DOCUMENTAR no comentário): count distinct de oportunidades do pipeline CRIADAS no período que satisfaçam (a) EXISTS crm_tarefas com tipo='reuniao' vinculada à oportunidade (o ReuniaoDialog de 260716-kq1 cria essa tarefa ao mover para Reunião agendada) OU (b) etapa atual com `ordem >=` ordem da etapa reunião-agendada OU (c) status = 'ganha'. Uma query por período (EXISTS/subquery, count no banco). Se o pipeline não tiver etapa de reunião, usar só (a) e (c);
         (5) origens: GROUP BY `crmOportunidades.origem` das criadas no período atual.
       - Merge final chamando `montarDashboard` do módulo puro. Intervalos vêm de `calcularPeriodo(preset ?? 'este-mes', hojeISO em fuso Brasília)`.
       - Exportar os types do retorno (DashboardComercial) para a UI consumir.
  </action>
  <verify>
    <automated>npx vitest run src/lib/crm/funil-comercial.test.ts</automated>
  </verify>
  <done>Testes do módulo puro passando (períodos, variações, taxas, montarDashboard sem NaN); dados-funil.ts compila, segue o padrão sequencial/agregado e degrada graciosamente sem workspace.</done>
</task>

<task type="auto">
  <name>Task 2: Página /funil (Dashboard Comercial) + entrada na sidebar</name>
  <files>src/app/(app)/funil/page.tsx, src/components/funil/funil-view.tsx, src/components/funil/funil-visual.tsx, src/components/app-sidebar.tsx</files>
  <action>
    Reproduzir a referência `Imagens_referencia_CRM/imagem_referencia_funil_vendas.png` (já analisada: header + 5 KPIs com variação, funil de trapézios central com taxas embaixo, painel lateral Métricas de Performance, painel Origem). Todo texto em pt-BR. Dados 100% reais — NENHUM mock, NENHUM placeholder com número falso.

    1. **SUBSTITUIR** `src/app/(app)/funil/page.tsx` (hoje `redirect('/crm')`) por Server Component real:
       - `export const maxDuration = 60` (padrão do grupo app);
       - `searchParams: Promise<{ pipeline?: string; periodo?: string }>` → `getDashboardComercial(pipeline, periodo válido ?? 'este-mes')`;
       - degradação graciosa `!configurado` com o MESMO aviso âmbar do /crm ("CRM ainda não ativado...");
       - renderiza `<FunilView dados={...} />`.
    2. `src/components/funil/funil-view.tsx` ('use client'):
       - Header: título "Dashboard Comercial" + subtítulo "Visão estratégica do funil de vendas"; à direita, Select de período (Este mês / Mês passado / Últimos 30 dias / Este ano) e Select de pipeline (lista de `dados.pipelines`, badge "Padrão" como no CrmView) — ambos comandam a URL via `router.push('/funil?periodo=...&pipeline=...')` (o server refaz as queries; sem fetch client-side).
       - Faixa de 5 KPIs em Cards (grid responsivo, `bg-card`): Novo lead, Agendado, Vendas, Receita Total (formatar R$ pt-BR via Intl.NumberFormat), Leads Perdidos. Cada card mostra a variação: verde com seta ↑ quando positiva, vermelho ↓ quando negativa (para Leads Perdidos INVERTER a semântica de cor: subir é ruim), "— 0.0%" neutro quando variação null/zero — como na referência. Badges/cores com variante `dark:` (memória: badges pastel precisam de dark:).
       - Grid principal: funil (2/3) + coluna lateral (1/3). Lateral: Card "Métricas de Performance" (Conversão Total %, Ticket Médio R$, Receita/Lead R$, cada linha com variação colorida) e Card "Origem dos leads" (label "Origem", NUNCA "UTM"): lista origem → barra de progresso + `N (X%)`, rótulos legíveis reutilizando o helper de rótulo de origem já usado na /crm (procurar em src/lib/crm — mesmo mapeamento de badges VIA MANUAL/WHATSAPP/LANDING/META/INDICAÇÃO); estado vazio honesto "Sem leads no período".
    3. `src/components/funil/funil-visual.tsx`: Card "Funil de Vendas" com 3 degraus empilhados em trapézio como na referência — SVG simples ou divs com `clip-path: polygon(...)`, larguras fixas decrescentes (topo 100%, meio ~66%, base ~36%): topo escuro (bg-slate-900, `dark:bg-slate-800` com borda) "Novo lead" + número, meio escuro "Agendado" + número, base verde (`bg-emerald-500 text-white`) "Pagou" + número. Abaixo, duas colunas: "Novo lead → Agendado X%" e "Agendado → Pagou Y%" (taxas já prontas de `montarDashboard`). Conferir contraste no dark mode.
    4. Sidebar (`src/components/app-sidebar.tsx`): no grupo Comercial, adicionar `{ title: 'Funil de Vendas', url: '/funil', icon: TrendingUp }` logo após CRM (importar TrendingUp de lucide-react). Padrão de item existente — nada mais muda.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/lib/crm/funil-comercial.test.ts</automated>
  </verify>
  <done>/funil renderiza o dashboard real (sem redirect); trocar período/pipeline pela URL recalcula; sidebar tem "Funil de Vendas"; textos pt-BR; dark mode ok; zero mock.</done>
</task>

<task type="auto">
  <name>Task 3: Atualizar mapa mental SVG com o placar de 17/jul (3 cores)</name>
  <files>Mapa_mental_sistema_operção/mapa_mental_sistema_jsr.html</files>
  <action>
    Editar o SVG estático mantendo layout/posições (só cores, textos e legenda). Adicionar classes CSS: `.done{font-family:'Inter',sans-serif;font-weight:700;fill:#22C55E;}` e `.parcial{...fill:#FFB020;}`; MUDAR `.gap` para laranja `#F97316` (abertas). Aplicar:
    - **01 Captação**: "⚠ Falta: origem/UTM carimbada no lead" → classe parcial, texto "◐ Parcial: origem/UTM carimbada no lead"; "SLA de 1º contato" → "◐ Parcial: SLA de 1º contato".
    - **02 CRM**: "motivo de perda estruturado" → done, "✓ Motivo de perda estruturado"; reengajamento de perdidos e score/temperatura permanecem ⚠ (gap laranja).
    - **03 Contrato**: "templates por serviço/nicho" → done "✓ Templates por serviço"; "lembrete de assinatura pendente" permanece ⚠.
    - **04 Pagamento**: remover `stroke-dasharray` e trocar stroke/faixa/número de #FFB020 para #0099FF (bloco deixa de ser "a conectar"); item "› Asaas — ainda a conectar" → "› Asaas conectado — E2E validado ✓"; manter "1ª cobrança pós-assinatura" e "Cliente vira ativo e pago" como itens normais; "régua de inadimplência" permanece ⚠ (com a linha "(antes · no vencimento · em atraso)").
    - **05 Onboarding**: checklist por nicho permanece ⚠.
    - **06 Tráfego**: "fadiga de criativo" → done "✓ Alerta de fadiga de criativo"; "pacing de verba" → parcial "◐ Parcial: alerta de pacing de verba"; "disparo automático no WhatsApp" permanece ⚠.
    - **07 Financeiro**: dividir a linha "MRR e LTV médio": "✓ MRR" (done) e "⚠ Falta: LTV médio" (gap); "CAC por canal" e "ligação direta com o CRM" permanecem ⚠ (ajustar as posições y das linhas se precisar de 1 linha a mais — o bloco tem 170px de altura; pode aumentar para ~190 e deslocar nada mais, há folga até o bloco 08 em y=760).
    - **08 Agenda**: as duas linhas de gap ("envio automático da atividade / para a agenda (ainda manual)") → done: "✓ Atividade de reunião entra na agenda automaticamente".
    - **Banda transversal**: título deixa de afirmar que nada existe → "CAMADAS TRANSVERSAIS — EM CONSTRUÇÃO"; linha "Saúde e retenção de conta" marcada como parcial (cor #FFB020); "Dashboard executivo (CAC · LTV · MRR · churn)" e "Permissões por papel" em laranja (pendentes).
    - **Legenda**: 3 quadrados — #22C55E "feito", #FFB020 "parcial", #F97316 "pendente" (reposicionar os x para caberem: ex. 40/240/440).
    Tudo em pt-BR. Não mexer em conectores, nó central nem assinaturas.
  </action>
  <verify>
    <automated>grep -c "22C55E" "Mapa_mental_sistema_operção/mapa_mental_sistema_jsr.html" && ! grep -q "ainda a conectar" "Mapa_mental_sistema_operção/mapa_mental_sistema_jsr.html" && grep -q "F97316" "Mapa_mental_sistema_operção/mapa_mental_sistema_jsr.html"</automated>
  </verify>
  <done>Mapa abre no navegador com 3 cores coerentes com o placar de 17/jul; bloco 04 sem tracejado e com Asaas validado; legenda com feito/parcial/pendente.</done>
</task>

</tasks>

<verification>
- `npx vitest run` da suíte nova passa (e a suíte existente não quebra: rodar `npx vitest run` completo antes do commit final).
- `npx tsc --noEmit` limpo.
- /funil deixa de redirecionar e mostra números que batem com o /crm (ex.: total de ganhas do período coerente com a coluna Ganho).
- Nenhum texto em inglês na UI nova; nenhum número mockado.
</verification>

<success_criteria>
- Dashboard Comercial em /funil com 5 KPIs + variações, funil visual com taxas, Métricas de Performance e Origem dos leads — tudo de queries agregadas sequenciais sobre crm_* reais.
- Filtros de período (4 presets, padrão Este mês) e de pipeline funcionando via URL.
- Item "Funil de Vendas" na sidebar (grupo Comercial).
- Mapa mental atualizado com o placar de 17/jul e legenda de 3 cores.
</success_criteria>

<output>
Após concluir, criar `.planning/quick/260717-elo-dashboard-comercial-funil-de-vendas-refe/260717-elo-SUMMARY.md`
</output>

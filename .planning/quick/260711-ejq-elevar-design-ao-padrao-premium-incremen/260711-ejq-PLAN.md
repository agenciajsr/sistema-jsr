---
phase: quick-260711-ejq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/globals.css
  - src/components/ui/card.tsx
  - src/components/stat-card.tsx
  - src/components/premium/score-ring.tsx
  - src/components/premium/ai-insight-card.tsx
  - src/components/app-sidebar.tsx
  - src/app/(app)/layout.tsx
  - src/lib/mock/dashboard.ts
  - src/app/(app)/painel/page.tsx
autonomous: true
requirements: [QUICK-EJQ]
must_haves:
  truths:
    - "Tema claro premium: fundo em camadas, bordas hairline, gradientes suaves — sem quebrar o .dark"
    - "Cards e StatCard elevados (mais respiro, cantos maiores, hover discreto) e herdados por todas as telas via tokens"
    - "Painel abre como Mission Control com hero Agency Health Score (ScoreRing) e card de Insights da IA"
    - "npx tsc --noEmit limpo e npm run lint sem erros NOVOS"
  artifacts:
    - path: "src/app/globals.css"
      provides: "Paleta refinada + tokens de gradiente e elevação premium"
      contains: "--gradient-brand"
    - path: "src/components/premium/score-ring.tsx"
      provides: "Anel de progresso SVG 0-100 com gradiente suave"
      exports: ["ScoreRing"]
    - path: "src/components/premium/ai-insight-card.tsx"
      provides: "Card de insights da IA (placeholder mock com selo IA)"
      exports: ["AiInsightCard"]
    - path: "src/app/(app)/painel/page.tsx"
      provides: "Painel Mission Control com hero ScoreRing + AiInsightCard"
      contains: "ScoreRing"
  key_links:
    - from: "src/app/(app)/painel/page.tsx"
      to: "src/components/premium/score-ring.tsx"
      via: "import ScoreRing"
      pattern: "ScoreRing"
    - from: "src/app/(app)/painel/page.tsx"
      to: "src/lib/mock/dashboard.ts"
      via: "import agencyHealthMock / insightsIaMock"
      pattern: "agencyHealth|insightsIa"
---

<objective>
Elevar o design do Sistema JSR ao padrão premium (inspiração: Linear, Stripe, Vercel, Supabase Studio) — SEM redesenhar todas as telas. Este incremento entrega apenas a FUNDAÇÃO (design system em tokens), os PRIMITIVOS compartilhados elevados, o refino do SHELL e a reconstrução do PAINEL como "Mission Control".

Purpose: Estabelecer a base visual premium que todas as telas herdam automaticamente e materializar a peça-assinatura (Agency Health Score + Insights da IA), refletindo a visão "IA como protagonista".

Output: globals.css refinado com tokens de gradiente/elevação; Card e StatCard elevados; 2 primitivos novos (ScoreRing, AiInsightCard); sidebar/header refinados; Painel reconstruído como Mission Control com dados mock.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
<!-- Contratos existentes que o executor deve respeitar. Não explorar o codebase. -->

Card (src/components/ui/card.tsx) — classes base atuais a elevar:
```
"flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
```
Exports: Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent.

StatCard (src/components/stat-card.tsx) — assinatura pública (NÃO alterar props):
```typescript
type StatCardColor = 'primary' | 'success' | 'warning' | 'danger'
type StatCardProps = {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color?: StatCardColor
  trend?: { value: string; direction: 'up' | 'down'; positive?: boolean }
  helper?: string
}
```

Tokens EXISTENTES que devem continuar funcionando (registrados em @theme inline e usados no Painel):
`--chart-success/warning/danger/info`, `--alert-danger-soft`, `--alert-warning-soft`, `--sidebar-*`, `--primary` (#1e76c4), `--background` (#f7f8fa), `--card` (#fff), `--radius` (0.75rem).

Dados mock existentes (src/lib/mock/dashboard.ts) consumidos pelo Painel:
`financeiroMock[{cliente,mrr,diaCobranca,status}]`, `clientesTrafegoMock[{id,nome,nicho,contaStatus,contas,verbaGasta,verbaTotal,ultimaSync,campanhas[]}]`, `alertasMock[{id,tipo,severidade,titulo,cliente,detalhe,quando}]`, `verbaDiariaMock[{dia,valor}]`, `mrrHistoricoMock[{mes,mrr}]`.

Stack disponível (NÃO adicionar deps): Next.js 16, React 19, Tailwind 4, radix-ui, lucide-react 1.24, recharts 3.8, tw-animate-css 1.4 (já importado no globals.css — fornece utilitários animate-in / fade-in / etc.), next-themes.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fundação de design system + elevar Card e StatCard</name>
  <files>src/app/globals.css, src/components/ui/card.tsx, src/components/stat-card.tsx</files>
  <action>
    Refinar a base visual premium. Manter tema claro como padrão e o .dark funcional.

    Em src/app/globals.css:
    1. Refinar a paleta neutra ancorada no azul da marca (--primary #1e76c4 permanece a base):
       - Superfícies em camadas: manter --background (#f7f8fa) levemente distinto de --card (#ffffff); refinar --border para uma hairline mais sutil (ex.: #e9eaee) e --muted-foreground com contraste um pouco melhor. Não trocar --primary nem --foreground drasticamente.
    2. Adicionar tokens de GRADIENTE SUAVE reutilizáveis dentro de :root (MUITO discretos, estilo Linear/Stripe — quase imperceptíveis):
       - `--gradient-brand`: linear-gradient sutil do --primary para um azul levemente mais claro/escuro (ex.: 135deg, tons de #1e76c4). Usado no logo/chip da marca.
       - `--gradient-surface`: linear-gradient quase branco (ex.: de #ffffff para #fbfcfd) para o topo de cards hero.
       - Adicionar variação escura correspondente no bloco .dark (gradientes um pouco mais escuros, ainda sutis).
    3. Adicionar escala de ELEVAÇÃO premium (sombras suaves em camadas, para uso parcimonioso) como custom properties:
       - `--shadow-xs`, `--shadow-sm`, `--shadow-md` (ex.: sombras multi-camada de baixa opacidade, tipo `0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)`).
    4. Aumentar o raio de cards: subir --radius de 0.75rem para 0.9rem (~14px) — mantém a escala derivada (radius-sm/md/lg/xl no @theme inline) coerente.
    5. Registrar os novos tokens de cor no bloco `@theme inline` SOMENTE se forem usados como classes utilitárias de cor; gradientes e sombras podem ser aplicados via `bg-[image:var(--gradient-brand)]` / `shadow-[var(--shadow-md)]` sem registro extra. NÃO remover nenhum token existente do @theme inline.
    6. Opcional: adicionar uma classe utilitária base `.card-hover` em @layer components com transição suave (transform/box-shadow) para lift discreto no hover — ou deixar as classes de hover direto no Card (decisão do executor, o que for mais limpo).

    Em src/components/ui/card.tsx:
    - Elevar as classes base do Card para mais respiro e premium: manter a API/exports intactos. Sugestão: subir padding vertical (py-6 → py-7), gap, usar rounded-2xl (herda o novo --radius via rounded-lg/xl das classes shadcn — usar o utilitário que refletir ~14-16px), borda hairline (border-border), sombra suave `shadow-[var(--shadow-sm)]` e transição para hover-lift discreto (`transition-shadow hover:shadow-[var(--shadow-md)]`). Manter compatível com `className` override (muitos usos passam `border-none shadow-sm`).

    Em src/components/stat-card.tsx (NÃO mudar as props):
    - Deixar mais premium: número maior (text-3xl → text-4xl com tracking-tight), label refinado, e o chip do ícone com leve gradiente/tint (ex.: usar bg com o tint da cor + sutil ring/borda). Aumentar padding (p-5 → p-6) e adicionar hover-lift discreto. Manter os COLOR_CLASSES por cor semântica.

    Restrições: gradientes e sombras SUTIS (referência Linear/Stripe). NÃO adicionar dependências. Garantir que o .dark continue legível.
  </action>
  <verify>
    <automated>cd "C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr" && npx tsc --noEmit</automated>
  </verify>
  <done>globals.css tem --gradient-brand, --gradient-surface e escala --shadow-*; --radius ~0.9rem; tokens existentes preservados; Card e StatCard visualmente elevados com hover discreto e API inalterada; tsc limpo.</done>
</task>

<task type="auto">
  <name>Task 2: Primitivos premium (ScoreRing + AiInsightCard) + refino do shell + mocks</name>
  <files>src/components/premium/score-ring.tsx, src/components/premium/ai-insight-card.tsx, src/lib/mock/dashboard.ts, src/components/app-sidebar.tsx, src/app/(app)/layout.tsx</files>
  <action>
    Criar os primitivos-assinatura e refinar o shell.

    1. src/components/premium/score-ring.tsx — componente client-agnostic (pode ser server component puro, sem hooks) `ScoreRing`:
       - Props: `{ score: number; size?: number; strokeWidth?: number; label?: string; sublabel?: string }`.
       - Renderiza um anel de progresso SVG (0-100): círculo de trilho (stroke var(--border)) + arco de progresso com gradiente suave via `<defs><linearGradient>` (tons do --primary; para score alto pode tender ao verde, baixo ao warning — decisão do executor, mas gradiente SUAVE). Usar strokeLinecap="round" e stroke-dasharray/offset calculado da circunferência. Rotacionar -90deg para começar no topo.
       - Centro: número grande (o score) + label/sublabel opcionais. Português.
       - Sem dependências novas (SVG puro). Transição CSS discreta no stroke-dashoffset.

    2. src/components/premium/ai-insight-card.tsx — componente `AiInsightCard`:
       - Props: `{ insights: { titulo: string; texto: string }[] }` (ou aceitar children — decisão do executor; preferir a lista tipada).
       - Usa Card + um selo/badge "✨ IA" (deixar claro que é placeholder/mock). Estilo premium: leve gradiente de superfície no topo (`bg-[image:var(--gradient-surface)]`), ícone Sparkles (lucide-react), lista de 2-3 insights no espírito "análise + sugestão de ação". Animação de entrada discreta via tw-animate-css (ex.: `animate-in fade-in`).

    3. src/lib/mock/dashboard.ts — adicionar (sem quebrar nada existente):
       - `agencyHealthMock`: um objeto `{ score: number; clientesAtivos: number; clientesEmRisco: number }` com score plausível (ex.: derivado no comentário: contas ok vs. alertas vs. MRR → ~78). Exportar tipo se útil.
       - `insightsIaMock`: array de 2-3 `{ titulo: string; texto: string }` no espírito do brief (ex.: "Loja Aurora Moda gastou 96% da verba faltando 8 dias — sugiro redistribuir R$ 300/dia ou pausar a campanha Advantage+ Catálogo"). Português, consistente com os outros mocks (mesmos clientes).

    4. src/components/app-sidebar.tsx — refino premium SEM quebrar a nav de 6 áreas nem o grupo Administração:
       - Marca JSR com leve gradiente no chip do logo (`bg-[image:var(--gradient-brand)]` no lugar de bg-primary sólido) e mais respiro no header.
       - Estados ativos elegantes (não pesados): confiar nos tokens sidebar-accent já refinados; ajustar espaçamento/tipografia dos labels se necessário. Manter isActive e tooltip.

    5. src/app/(app)/layout.tsx — header limpo premium: manter o sino de alertas (Bell + badge alertasMock.length), avatar e Sair intactos e funcionais. Refinar respiro/altura/borda do header e o padding do <main> (mais ar, ex.: p-6 → p-6/p-8 responsivo). NÃO alterar a lógica de auth/redirect.

    Restrições: NÃO adicionar deps. Português na UI. Gradientes sutis.
  </action>
  <verify>
    <automated>cd "C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr" && npx tsc --noEmit</automated>
  </verify>
  <done>ScoreRing e AiInsightCard existem em src/components/premium/ e exportam corretamente; agencyHealthMock e insightsIaMock adicionados ao dashboard.ts; sidebar e header refinados sem quebrar nav de 6 áreas, sino de alertas nem auth; tsc limpo.</done>
</task>

<task type="auto">
  <name>Task 3: Reconstruir o Painel como Mission Control</name>
  <files>src/app/(app)/painel/page.tsx</files>
  <action>
    Reconstruir o Painel usando os primitivos premium, mantendo tudo em português e com MockNotice.

    Estrutura (de cima para baixo):
    1. Cabeçalho de saudação (manter "Bom dia, JSR 👋" + subtítulo de resumo) e MockNotice logo abaixo (manter o texto atual explicando dados de exemplo).
    2. (Opcional, se leve) Barra de filtro global no topo: um seletor de PERÍODO estático como placeholder visual (ex.: um pequeno grupo de botões/segmented "Hoje / 7 dias / 30 dias" apenas visual, sem lógica). Se adicionar qualquer complexidade de estado além de um useState trivial, deixar como um único seletor estático. Não é bloqueante.
    3. HERO — Agency Health Score: um Card grande (usar bg-[image:var(--gradient-surface)] discreto) contendo à esquerda o `ScoreRing` com `agencyHealthMock.score` (label "Saúde da Agência"), e ao lado 2-3 números de contexto (MRR/receita do mês = soma de financeiroMock.mrr; clientes ativos = agencyHealthMock.clientesAtivos ou clientesTrafegoMock.length; clientes em risco = agencyHealthMock.clientesEmRisco ou contagem de contaStatus problema). Peça-assinatura premium — bastante respiro.
    4. Card "✨ Insights da IA": usar `AiInsightCard` com `insightsIaMock`. Reflete "IA como protagonista".
    5. Faixa de KPIs: manter os 4 StatCard existentes (MRR Total, A receber 7 dias, Verba rodando, Contas com problema) — já herdam o tratamento premium do StatCard elevado.
    6. Bloco "🚩 Precisa de você hoje": manter a lógica de severidade colorida (critico/atencao com border-l-4 + bg-alert-*-soft). Elevar o card (mais ar).
    7. Grid "📊 Saúde das contas de anúncio" + "📈 Verba dos últimos 7 dias" (recharts): manter o gráfico funcionando (ChartContainer/BarChart com var(--color-verba)). Elevar os cards.

    Preservar TODOS os cálculos derivados existentes (mrrTotal, aReceber7Dias, verbaRodando, contasComProblema, clientesAtivos, pontosDeAtencao). Não quebrar imports do recharts nem do chart. Manter 'use client' (necessário para recharts). Reaproveitar Card/StatCard/Badge existentes. Espaçamento generoso (space-y maior, cards grandes).
  </action>
  <verify>
    <automated>cd "C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr" && npx tsc --noEmit && npm run lint</automated>
  </verify>
  <done>Painel abre com hero ScoreRing (Agency Health Score) + números de contexto, card de Insights da IA, KPIs, bloco de alertas com severidade, saúde das contas e gráfico de verba — todos no tratamento premium. tsc limpo; lint sem erros NOVOS (apenas os 2 pré-existentes conhecidos em ui/sidebar.tsx e hooks/use-mobile.ts).</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` limpo (sem novos erros de tipo).
- `npm run lint` sem erros NOVOS (os 2 pré-existentes em ui/sidebar.tsx e hooks/use-mobile.ts são conhecidos e fora de escopo).
- Rotas intactas: /painel carrega; sidebar de 6 áreas + Administração funcionam; sino de alertas com badge preservado.
- Tema claro é o padrão e o .dark permanece legível.
</verification>

<success_criteria>
- Fundação de tokens premium (gradientes suaves + elevação em camadas + raio maior) em globals.css, com tokens existentes preservados.
- Card e StatCard elevados e herdados automaticamente pelas demais telas.
- ScoreRing e AiInsightCard criados em src/components/premium/.
- Shell (sidebar + header) refinado sem quebrar navegação nem alertas.
- Painel reconstruído como Mission Control com Agency Health Score (hero) e Insights da IA.
- Nenhuma dependência nova adicionada; UI em português.
</success_criteria>

<output>
After completion, create `.planning/quick/260711-ejq-elevar-design-ao-padrao-premium-incremen/260711-ejq-SUMMARY.md`
</output>

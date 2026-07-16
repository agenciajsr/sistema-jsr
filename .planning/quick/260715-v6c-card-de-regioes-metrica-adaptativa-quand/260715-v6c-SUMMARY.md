---
phase: quick-260715-v6c
plan: 01
subsystem: campanhas
tags: [meta-ads, regioes, privacidade, cobertura, tdd]
requires:
  - quick-260715-tud (Etapa 2 /campanhas — tabela regiao_insights)
provides:
  - rankingDeRegioes — ranking de regiões com métrica escolhida pela COBERTURA do dado
  - LIMIAR_COBERTURA_REGIAO (0.5) — limiar único e exportado
  - Card /campanhas "Regiões" adaptativo (título, métrica, custo e nota por motivo)
affects:
  - getPainelCampanhas (1 query sequencial nova — denominador da cobertura)
  - PainelCampanhas.regioes muda de LinhaRegiao[] para RankingRegioes
tech-stack:
  added: []
  patterns:
    - Decisão de exibição dirigida pelo DADO MEDIDO (cobertura), nunca por tipo/nicho de cliente
    - Mecânica pura testável (demografia.ts) sem imports de db/auth/react
    - Numerador e denominador sempre no MESMO recorte (mesma janela + mesmas campanhas)
key-files:
  created: []
  modified:
    - src/lib/trafego/demografia.ts
    - src/lib/trafego/demografia.test.ts
    - src/lib/trafego/painel.ts
    - src/components/trafego/regioes-section.tsx
    - src/app/(app)/campanhas/page.tsx
decisions:
  - O Meta NÃO entrega conversões de pixel por região (privacidade pós-iOS 14) — diagnóstico FECHADO, medido em 15/jul/2026; nenhuma variação de chamada resolve
  - Métrica do ranking decidida por COBERTURA (soma por região / total da mesma janela e mesmas campanhas), NÃO por presença (soma > 0) — presença tinha furo comprovado em produção
  - Limiar de cobertura = 0.5; a separação medida (0,2% vs 100%+) é tão grande que qualquer valor entre ~0,01 e ~1 classificaria igual
  - Motivo ('heroi' | 'sem-cobertura' | 'sem-resultados') devolvido pela mecânica para a UI escolher a nota sem recalcular — 'sem-resultados' NÃO culpa o Meta
metrics:
  duration: ~50min
  completed: 2026-07-15
---

# Quick 260715-v6c: Card de Regiões com métrica adaptativa

O card "Regiões" de /campanhas passa a escolher a métrica do ranking pela cobertura real do dado: mantém a chave-herói quando o Meta entrega resultados por região de forma representativa, e cai para cliques no link (com nota honesta) quando não entrega.

## ⚠️ Limitação da Graph API — diagnóstico FECHADO (não reinvestigar)

Medido ao vivo na conta real `act_1763213724519896` (30d, 412 compras reais) em 15/jul/2026:

- sem breakdown / `age,gender` / `country` → `omni_purchase` = 407 (**chega**)
- `breakdowns=region` (em qualquer nível: account, campaign, ad) → `omni_purchase` = **0**
- `region` + `use_unified_attribution_setting` / `action_attribution_windows` → ainda **0**
- `breakdowns=dma` → erro #100 (não suportado)

**O Meta não entrega conversões de PIXEL (offsite) quebradas por região — privacidade pós-iOS 14.** Por região só chegam: `link_click` (34.225), `page_engagement`, `video_view`, `onsite_conversion.total_messaging_connection` (59 — conversas chegam) e `onsite_conversion.lead` (1 — só formulário instantâneo).

**Se uma sessão futura achar que o fallback é bug nosso: não é.** Nenhuma variação de chamada à Graph API resolve. O fallback por cliques no link é a resposta honesta, não um contorno provisório.

## O que foi feito

### Task 1 — `rankingDeRegioes` sob TDD (commits 99ac7f0 RED, 7d83826 GREEN)
Mecânica pura em `demografia.ts` (zero import de db/auth/react): agrega regiões somando campanhas, extrai `linkClicks` via `parseActionsExtendido` e escolhe a métrica do ranking. `agregarRegioes` foi substituída (tinha um único consumidor).

### Task 2 — Painel (commit 4289360)
`PainelCampanhas.regioes` passa de `LinhaRegiao[]` para `RankingRegioes`; Query D usa `rankingDeRegioes`, mantendo dedupe por `campaignId|region` e catch silencioso.

### Task 3 — Card adaptativo (commit f773e99)
Título, unidade, sufixo do custo e nota conforme o modo. Barra segue em `var(--chart-1)`.

### Correção da regra: presença → COBERTURA (commits 78f33e9 RED, 6334b34 GREEN, c381331)
**A regra original (`soma > 0`) não corrigia o bug que motivou a task.** Medido em produção:

```
chave-heroi = vendas -> metrica escolhida: heroi   <-- ERRADO
  São Paulo:      resultados=1  linkClicks=9784  spend=R$ 6561.87
  Minas Gerais:   resultados=0  linkClicks=3471  spend=R$ 2102.68
```

Causa: existe **1** `onsite_conversion.purchase` (compra dentro do Instagram, que escapa da restrição de privacidade) entre 412 compras. Essa 1 unidade fazia `soma > 0` dar verdadeiro e o card seguia "Regiões que mais vendem" com zero em todo o resto — exatamente o ranking zerado reclamado.

Cobertura medida (total 30d em `campaign_insights` vs o que vem em `regiao_insights`):

| chave | total_30d | por_regiao | cobertura | regiões com resultado |
|---|---|---|---|---|
| vendas | 412 | 1 | **0,2%** | 1/28 |
| leads | 2 | 2 | 100% | 2/28 |
| conversas | 49 | 61 | ~124% | 13/28 |

Regra corrigida — **cobertura mede se o dado é REPRESENTATIVO, não se ele existe**:

- `totalReferencia > 0` e cobertura >= `LIMIAR_COBERTURA_REGIAO` (0.5) → `'heroi'`
- `totalReferencia > 0` e cobertura < limiar → `'linkClicks'` / `'sem-cobertura'`
- `totalReferencia === 0` → `'linkClicks'` / `'sem-resultados'` (o cliente não teve resultado; **não** é limitação do Meta e a nota não afirma que é)

### Correção da brecha do denominador (commits be15457 RED, 71bf75c)
O denominador precisa falar do **mesmo recorte** do numerador, em duas dimensões:

1. **Mesma janela**: vem dos últimos 30d (janela do sync de região), **nunca** do período selecionado no painel — 7d contra 30d inflaria a cobertura, 90d a subestimaria.
2. **Mesmas campanhas**: filtrado pelos `campaignId` do breakdown (`campanhasComRegiao`). Sem isso, uma campanha que o Meta não retornou no breakdown infla o denominador e dispara fallback falso. Conjunto vazio → não roda query (evita `IN ()`) → `totalReferencia = 0`.

## Verificação

- `npx vitest run`: **1496 testes**, 0 falhas (19 no `demografia.test.ts`, incluindo a regressão nomeada do caso Melzinho e a prova da brecha do denominador)
- `npx tsc --noEmit` e `npx eslint` nos arquivos alterados: limpos
- **Validado read-only contra a conta real** (script `scripts/tmp-*` removido, não commitado):

```
campanhas no breakdown: 9
chave=vendas    refFiltrado=402 porRegiao= 1 cob=  0.2% -> linkClicks/sem-cobertura
chave=leads     refFiltrado=  2 porRegiao= 2 cob=100.0% -> heroi/heroi
chave=conversas refFiltrado= 56 porRegiao=61 cob=108.9% -> heroi/heroi
top3 (vendas): São Paulo(lc=9784, R$0,67/clique), Minas Gerais(lc=3471, R$0,61/clique)
```

- Nenhuma alteração em sync, migrations ou na demografia (idade × gênero)

## Desvios do plano

### Ajustes automáticos

**1. [Rule 1 - Bug] Regra `soma > 0` do plano não corrigia o bug que motivou a task**
- **Encontrado em:** revisão com dados reais, após a Task 3
- **Problema:** a spec decidia por presença de resultado; 1 compra onsite de 412 (0,2%) mantinha o card em modo herói e zerado.
- **Correção:** decisão por cobertura com limiar exportado; `motivo` devolvido para a UI; nota neutra separada para `sem-resultados`.
- **Commits:** 78f33e9, 6334b34, c381331

**2. [Rule 1 - Bug] Denominador da cobertura somava a conta inteira**
- **Encontrado em:** auto-revisão da correção acima (levantado antes de causar dano)
- **Problema:** campanha ausente do breakdown inflaria o denominador → fallback falso. Inofensivo hoje (9/9 campanhas no breakdown na única conta sincronizada), mas o cron das 06h popula ~9 contas.
- **Correção:** denominador filtrado por `campanhasComRegiao(dedup)`, com guarda contra `IN ()`.
- **Commits:** be15457, 71bf75c

## Known Stubs

Nenhum.

## Observações operacionais

- Só contas já sincronizadas têm dados de região; as demais mostram o estado vazio honesto ("rode uma sincronização") até o cron diário (06h BR) rodar.
- Regiões refletem sempre os últimos ~30 dias do Meta, independente do período selecionado (a UI avisa) — mesma limitação aceita dos anúncios.
- Quando o cron popular as outras contas, vale conferir se alguma cai em `sem-cobertura` de forma inesperada: seria sinal de conversão de pixel (esperado) e não de bug.

## Self-Check: PASSED

- Arquivos modificados conferidos em disco (demografia.ts, demografia.test.ts, painel.ts, regioes-section.tsx, page.tsx).
- Commits 99ac7f0, 7d83826, 4289360, f773e99, 78f33e9, 6334b34, c381331, be15457, 71bf75c presentes no log.
- Script temporário `scripts/tmp-verificar-regioes.ts` removido (não commitado) — confirmado por `git status`.

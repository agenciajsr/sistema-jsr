# Quick 260715-1rq — Reformular /crm no visual do mockup

**Concluido:** 2026-07-15
**Plano:** 260715-1rq-PLAN.md (3 tasks, 1 wave)
**Status:** completo — build limpo, 206 testes passando

## O que foi entregue

A pagina /crm passa a reproduzir o mockup definitivo do usuario
(`design-referencia-crm-kanban`), com TODOS os numeros vindo do banco.

| Task | Entrega | Commit |
|------|---------|--------|
| 1 (TDD) | helpers `tempoRelativoCurto` (7 testes) e `origem.ts`; `getCrmVisaoGeral()` substitui `getKanban` | 0ba53e0, 56c6789, 922a639 |
| 2 | `kpis-crm.tsx` (6 StatCard), `kanban-crm.tsx` reformulado, `card-oportunidade.tsx` reformulado, `barra-origem-leads.tsx` | e45e816 |
| 3 | `crm-view.tsx` (header + seletor de pipeline + abas + busca) e `page.tsx` via getCrmVisaoGeral | 6897210 |

### Pedidos explicitos do usuario — atendidos

1. **"Valor parado na pipeline"**: cada coluna do kanban mostra no header a soma
   dos valores das oportunidades abertas daquela etapa (`somaValor`), com "—"
   quando zerada, ao lado da probabilidade da etapa ("10% prob.").
2. **Barra "Origem dos leads" (print 2)**: rodape com uma pilula por canal
   (bolinha colorida + nome + %), ordenada do maior para o menor, com percentual
   REAL agregado por `GROUP BY origem` sobre as oportunidades abertas. Link
   "Ver relatorio completo" presente porem inerte (title="Em breve").
3. **Formato do mockup (print 1)**: header com titulo/subtitulo, seletor de
   pipeline com badge "Padrao", 6 KPIs, abas Kanban/Lista/Calendario, busca,
   botoes de filtro/config, "+ Adicionar oportunidade" no rodape das colunas.

## Decisoes de implementacao

- **Dados**: `getCrmVisaoGeral()` e a fonte unica (getKanban REMOVIDA). KPIs por
  `GROUP BY status` e `count(*)` no banco; origem por `GROUP BY origem`; queries
  SEQUENCIAIS (pool max=3, max_pipeline=0) — o numero de queries nao cresce com
  o numero de oportunidades.
- **Heuristica "sem contato" (documentada no codigo)**: oportunidade aberta ha
  mais de 7 dias E sem nenhuma tarefa comercial concluida. Alimenta o KPI
  "Sem contato (+7d)" e o aviso "Nao contatado" no card. Usa so colunas
  existentes — nenhuma migration nova.
- **Placeholders honestos**: Lista/Calendario mostram "Visao em construcao";
  periodo, filtro e engrenagem existem visualmente mas inertes com title="Em
  breve". Nada de dado falso.
- **Busca**: filtro client-side por titulo/contato/empresa sobre os dados ja
  carregados; a contagem e o valor do header da coluna seguem a etapa inteira
  (nao o recorte da busca), com estado vazio "Nada encontrado".
- **Reuso**: StatCard do projeto nos 6 KPIs; NovaOportunidadeDialog e as actions
  mover/ganhar/perder intactas.

## Desvios do plano

- **Rotulos dos KPIs**: o mockup diz "VALOR DA ORIGEM"; foi usado **"Valor em
  aberto"**, que descreve o numero de fato calculado (soma das abertas). Idem
  "Oportunidades" no lugar de "TOTAL DE OPORTUNIDADES". Mudanca de uma linha se
  o usuario preferir o rotulo literal do mockup.
- **Checkbox no header da coluna** (selecao em massa no mockup): NAO implementado
  — um checkbox que nao faz nada e pior que a ausencia dele. Entra quando houver
  acao em massa.
- **Task 2 fechou com o tsc acusando 1 erro esperado** (page.tsx ainda importando
  getKanban), resolvido na Task 3 conforme o sequenciamento do plano.

## Verificacao

- `npx vitest run src/lib/crm/tempo.test.ts` — 7 casos passando.
- `npm test` — 13 arquivos, 206 testes passando (nenhuma regressao).
- `npm run build` — limpo, rota /crm (dinamica) no output.
- `grep getKanban src/` — nenhuma referencia de codigo (so comentario).
- `git diff package.json` — vazio (zero dependencia nova).

## Pendencias (do usuario)

1. **Aplicar as migrations 0015 -> 0019** no Supabase. Ate la a /crm mostra o
   aviso amarelo "CRM ainda nao ativado" (degradacao graciosa, nao quebra), e os
   KPIs/barra so ganham numeros depois que houver oportunidades reais.
2. **Env `CRM_LEADS_TOKEN`** (pendencia herdada do quick 260715-0zf) para a API
   de captacao de leads responder.

## Proximos passos sugeridos

- Ligar as visoes Lista e Calendario.
- Filtros reais (dono, origem, valor) + recorte por periodo.
- Drag-and-drop entre colunas e reordenacao de etapas/pipelines pela UI.
- Tela de configuracao do pipeline (engrenagem).

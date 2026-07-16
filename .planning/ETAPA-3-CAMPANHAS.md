# Etapa 3 do painel /campanhas — Métricas certas por cliente (presets por objetivo) + tela inicial

**Criado em:** 2026-07-15 — handoff para nova conversa (planejado, NÃO executado).
**Motivo do handoff:** limite de verba/hora próximo. O plano está fechado; falta só executar.
**Contexto anterior:** Etapa 1 (redesign) e Etapa 2 (demografia/regiões/objetivo oficial) estão PRONTAS e em produção.

---

## ⚠️ Leia isto antes de qualquer coisa: o que o usuário pediu JÁ EXISTE (em parte)

O usuário descreveu o pedido assim: *"eu vou clicar no cliente e as métricas que eu escolhi para ele vão ficar salvas na conta dele. Toda vez que eu selecionar o cliente, o dashboard já vai vir com as métricas que eu escolhi para ele."*

**Isso já está construído e funcionando.** Verificado no código em 15/jul/2026:

- `preferencias_campanhas` — 1 linha por cliente, jsonb (`kpis` + `funil`), migration 0024 aplicada em produção.
- `salvarPreferenciasCampanhas(clienteId, {kpis})` em `src/actions/trafego.ts` — upsert com `onConflictDoUpdate`.
- `getPreferenciasCampanhas(cliente)` chamado em `src/app/(app)/campanhas/page.tsx:56`.
- `GradeKpis` (`src/components/trafego/grade-kpis.tsx:135`) salva de forma otimista a cada mudança, via `OrganizarSheet` (liga/desliga + arrasta para reordenar).

**NÃO replaneje persistência. NÃO crie tabela nova. NÃO mexa no backend disso** — como o próprio usuário disse, "não vai alterar nada da nossa lógica ali por trás do backend, tudo mais, porque já tá tudo alinhado".

## O buraco real (é isto que a Etapa 3 resolve)

O problema está no **estado inicial**, em `resolverPreferencias` (`grade-kpis.tsx:103`):

```ts
// Sem preferências, usa a ordem padrão do catálogo com tudo ligado.
for (const m of CATALOGO_METRICAS) {
  if (!presentes.has(m.id)) base.push({ id: m.id, ativo: true })
}
```

Ou seja: cliente sem preferência salva abre com **as 24 métricas do catálogo TODAS ligadas**, na mesma ordem genérica, seja ele de vendas ou de conversas. O usuário tem que abrir o "Organizar" e desligar ~18 métricas na mão, cliente por cliente. É por isso que a sensação é de que "não vem com as métricas certas" — vem com todas.

Os dois exemplos que o usuário deu:
- **Emílio** — vendas no site → deveria abrir com ROAS, Compras, Valor em Compras, CPA, Ticket Médio, Investimento.
- **Yuri** — conversa no WhatsApp → deveria abrir com Conversas, Custo por Conversa, Cliques, Investimento, CTR.

Hoje os dois abrem idênticos, com as 24.

## Escopo da Etapa 3

### 1. Presets de KPIs por objetivo (o coração da etapa)

Quando o cliente **não tem preferência salva**, a grade deve nascer com o preset do objetivo dele, não com o catálogo inteiro.

- A classe do objetivo já existe: `classificarObjetivo(objetivo_principal)` em `src/lib/trafego/aggregate.ts` → `'vendas' | 'leads' | 'conversas' | 'engajamento' | 'trafego' | null`. **Reusar, não reinventar** (fonte única — ver memória `objetivo-cliente-classificacao`).
- Definir um preset por classe: lista ordenada de `MetricaId` ativas; o resto do catálogo entra desligado no fim (assim nada some do "Organizar", só nasce desligado).
- Sugestão de presets (ajustar com o usuário se ele quiser opinar):
  - `vendas`: investimento, valorEmCompras, roas, compras, cpaMedio, ticketMedio, adicoesCarrinho, ctrLink
  - `leads`: investimento, leads, custoPorLead, cliquesNoLink, ctrLink, cpcLink, visualizacoesLp
  - `conversas`: investimento, conversas, custoPorConversa, cliquesNoLink, ctrLink, cpcLink, impressoes
  - `trafego`: investimento, cliquesNoLink, cpcLink, ctrLink, impressoes, alcance, cpm, visualizacoesLp
  - `engajamento`: investimento, engajamento, impressoes, alcance, cpm, ctrTodos, cliques
  - `null` (não classificado): manter o comportamento de hoje (catálogo, tudo ligado) — é o fallback honesto.
- **Onde:** módulo PURO (ex.: `presetsKpis(classe): PreferenciaKpi[]` junto de `metricas.ts`), sob TDD, zero import de db/auth/react. `resolverPreferencias(salvas, classe)` passa a receber a classe.
- **Regra de ouro:** preferência salva SEMPRE vence o preset. O preset é só o ponto de partida de quem nunca organizou. Não sobrescrever nada que o usuário já salvou.

### 2. Deixar o salvamento visível (é invisível hoje)

Salva certo, mas em silêncio — o usuário não tem como saber que ficou salvo pro cliente. Baixo custo, alto valor:
- Um toast/indicador discreto de "salvo" quando a preferência persiste (hoje só existe `toast.error` no caminho de erro, `grade-kpis.tsx:139`).
- No `OrganizarSheet`, deixar explícito que a escolha é **daquele cliente** (ex.: subtítulo "Estas métricas ficam salvas para {nome do cliente}").
- Quando a grade estiver no preset (sem nada salvo), sinalizar de leve que é uma sugestão pelo objetivo + um "Restaurar padrão do objetivo" para voltar ao preset depois de bagunçar.

### 3. Tela inicial da página (`/campanhas` sem cliente selecionado)

Hoje: sem `?cliente=`, `painel` é `null` e a página fica basicamente só com o cabeçalho e o seletor. O usuário quer que isso "dê uma melhorada".
- Estado inicial com cara de produto: ou (a) escolher o último cliente visto / o primeiro da lista automaticamente, ou (b) uma tela de escolha bonita — cards por cliente com nome, objetivo, verba e um mini-sinal de saúde, clicáveis.
- **Decidir com o usuário antes de codar** (é a única gray area real da etapa). Recomendação: (b) cards, porque casa com a ideia de "portal do cliente" no futuro e não esconde a lista.
- Período padrão já é `30d` (`page.tsx:40-42`) — que é o que o usuário usa. Manter.

## Restrições (não negociáveis)

- **Não** mexer em sync, migrations, nem na demografia/regiões da Etapa 2.
- **Não** criar tabela nem coluna — `preferencias_campanhas.kpis` já guarda tudo.
- Queries do painel **sequenciais** (pool max=5) — nunca `Promise.all` em query pesada.
- Cores de gráfico via `--chart-1..5` de `globals.css`.
- Design moderno/bonito é requisito explícito do usuário ("algo moderno, bonito, com design legal") — o padrão visual da página já está aprovado, seguir a mesma linguagem.
- Tudo em português (código, commits, docs, UI).
- Deploy: `git push origin master` (Vercel produção).
- Migration na mão SEMPRE (não se aplica aqui — não há migration nesta etapa).

## Referências

- Prints em `Imagens_referencia_campanhas/` (raiz).
- Arquivos-chave: `src/components/trafego/grade-kpis.tsx` (`resolverPreferencias`), `organizar-sheet.tsx`, `src/actions/trafego.ts` (get/salvar preferências), `src/lib/trafego/metricas.ts` (`CATALOGO_METRICAS`), `src/lib/trafego/aggregate.ts` (`classificarObjetivo`), `src/app/(app)/campanhas/page.tsx`.

## Ideia futura (NÃO é a Etapa 3)

`objetivo_principal` é texto livre classificado por heurística. O upgrade planejado é um seletor estruturado (objetivo primário + secundário) no cadastro do cliente — ver memória `objetivo-cliente-classificacao`. Se isso for feito, os presets desta etapa passam a ser dirigidos pelo campo estruturado, sem reescrever a mecânica.

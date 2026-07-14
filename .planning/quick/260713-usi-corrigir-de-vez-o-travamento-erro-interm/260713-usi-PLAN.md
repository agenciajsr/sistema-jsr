---
phase: quick-260713-usi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/financeiro/loading.tsx
  - src/app/(app)/loading.tsx
  - src/lib/utils/with-retry.ts
  - src/app/(app)/financeiro/page.tsx
autonomous: true
requirements: [FIN-ESTABILIDADE]
must_haves:
  truths:
    - "Ao clicar em Financeiro, a rota abre instantaneamente mostrando um skeleton (navegação nunca mais 'congela' esperando o servidor)"
    - "Um soluço momentâneo de conexão NÃO derruba mais o usuário na tela 'Financeiro indisponível' — o servidor tenta de novo sozinho (o 'F5 automático') antes de desistir"
    - "A tela 'Financeiro indisponível no momento' só aparece se as DUAS tentativas falharem (último recurso)"
    - "O pico de conexões simultâneas no cold start diminui: as 8 consultas rodam em 2 lotes sequenciais de 4, sem reescrever as actions"
    - "Quando os dados carregam com sucesso, a página fica visual e funcionalmente idêntica ao que é hoje"
  artifacts:
    - path: "src/app/(app)/financeiro/loading.tsx"
      provides: "Skeleton que espelha o layout real (título + seletor de mês, 6 StatCards, bloco do formulário, abas + tabela)"
      contains: "Skeleton"
    - path: "src/app/(app)/loading.tsx"
      provides: "Loading genérico leve para as demais rotas do grupo (app)"
      contains: "Skeleton"
    - path: "src/lib/utils/with-retry.ts"
      provides: "Helper reutilizável de retry com timeout por tentativa, comentários em português no estilo de with-timeout.ts"
      contains: "export async function withRetry"
    - path: "src/app/(app)/financeiro/page.tsx"
      provides: "Carga em 2 lotes sequenciais envolvida em withRetry (1ª tentativa ~12s, retry após 500ms com ~15s)"
      contains: "withRetry"
  key_links:
    - from: "src/app/(app)/financeiro/page.tsx"
      to: "src/lib/utils/with-retry.ts"
      via: "import { withRetry } from '@/lib/utils/with-retry'"
      pattern: "withRetry"
    - from: "src/lib/utils/with-retry.ts"
      to: "src/lib/utils/with-timeout.ts"
      via: "reuso de withTimeout/TimeoutError para o teto por tentativa"
      pattern: "withTimeout"
    - from: "src/app/(app)/financeiro/loading.tsx"
      to: "src/components/ui/skeleton"
      via: "import { Skeleton } from '@/components/ui/skeleton'"
      pattern: "components/ui/skeleton"
---

<objective>
Corrigir de vez o travamento/erro intermitente da página /financeiro com três mudanças pequenas e de baixo risco: (1) `loading.tsx` com skeleton para a navegação abrir instantaneamente, (2) retry automático server-side (o "F5 automático") antes de cair na tela de erro, e (3) dividir as 8 consultas em 2 lotes sequenciais de 4 para reduzir o pico de conexões frias no cold start (pool `max: 3`).

Purpose: Eliminar as duas sensações ruins que existem hoje — "cliquei e não abre" (sem loading.tsx a navegação bloqueia até o servidor terminar) e "caiu na tela de erro, tive que dar F5" (sem retry, qualquer soluço do pooler vira erro, mas a 2ª tentativa sempre funciona porque pega conexão quente).
Output: 2 arquivos `loading.tsx` novos, helper `src/lib/utils/with-retry.ts` novo, e `page.tsx` do financeiro refatorada (lotes + retry) sem nenhuma mudança visual/funcional no caminho de sucesso.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/app/(app)/financeiro/page.tsx
@src/lib/utils/with-timeout.ts
@src/lib/db/index.ts
@src/components/ui/skeleton.tsx

**Diagnóstico (já feito — NÃO re-investigar):**
1. /financeiro é a página mais pesada: `Promise.all` com 8 consultas (getResumoFinanceiro, calcularMrr, listTransacoes, select clientes ativos, getContasAReceber, getContasAPagar, getPrevisaoCaixa, getProfiles) sob `withTimeout(..., 15_000)`. Pool postgres.js tem `max: 3` — em cold start a página precisa abrir 2 conexões frias extras no Supavisor no pico; quando o pooler soluça, os 15s estouram e cai na tela de erro estática.
2. NÃO existe `loading.tsx` em nenhuma rota do grupo (app) — a navegação bloqueia até o servidor terminar (sensação de "cliquei e não abre"). Só existem `layout.tsx` e `error.tsx` em `src/app/(app)/`.
3. NÃO há retry: qualquer soluço momentâneo vai direto para a tela de erro; F5 (2ª tentativa com conexão quente) sempre resolve.

<interfaces>
<!-- Contratos que o executor precisa. Extraídos do código — não é preciso explorar. -->

De src/lib/utils/with-timeout.ts:
```typescript
export class TimeoutError extends Error {
  constructor(label = 'operação')
}
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operação'): Promise<T>
```

De src/components/ui/skeleton.tsx (shadcn padrão):
```typescript
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>)
// uso: <Skeleton className="h-4 w-32" />
```

De src/app/(app)/financeiro/page.tsx — a carga atual (linhas 49-69):
```typescript
await getCurrentUser()  // aquece 1 conexão + valida sessão ANTES das queries — MANTER

dados = await withTimeout(
  Promise.all([
    getResumoFinanceiro(mes, ano),  // lote 1
    calcularMrr(),                  // lote 1
    listTransacoes({ mes, ano }),   // lote 1
    db.select(...clientes ativos),  // lote 1
    getContasAReceber(),            // lote 2
    getContasAPagar(),              // lote 2
    getPrevisaoCaixa(),             // lote 2
    getProfiles(),                  // lote 2
  ]),
  15_000,
  'financeiro-load',
)
// destructuring esperado a jusante (MANTER a mesma ordem/nomes):
const [resumo, mrr, transacoes, clientesAtivos, contasReceber, contasPagar, previsao, profilesList] = dados
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: loading.tsx com skeleton para /financeiro e loading genérico do grupo (app)</name>
  <files>src/app/(app)/financeiro/loading.tsx, src/app/(app)/loading.tsx</files>
  <action>
    Criar `src/app/(app)/financeiro/loading.tsx` (Server Component simples, sem 'use client') usando o componente `Skeleton` já existente em `@/components/ui/skeleton`. O skeleton deve espelhar o layout real da página para não haver "pulo" visual:
    - Wrapper `<div className="space-y-6">` (igual à page).
    - Cabeçalho: linha flex com um Skeleton de título (`h-8 w-40`) + Skeleton de subtítulo (`h-4 w-72`) à esquerda e um Skeleton do seletor de mês (`h-9 w-44`) à direita — mesma estrutura responsiva `flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`.
    - Grid de KPIs: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` com 6 Skeletons de card (`h-[110px] rounded-xl` aproximando o StatCard).
    - Bloco do formulário de transação: 1 Skeleton grande (`h-48 rounded-xl`).
    - Abas + tabela: uma linha de Skeleton para a TabsList (`h-9 w-80 rounded-lg`) e um Skeleton de card de tabela (`h-96 rounded-xl`).
    Criar também `src/app/(app)/loading.tsx` genérico e neutro para beneficiar as demais rotas do grupo: bem leve — um Skeleton de título + 2-3 blocos `Skeleton` genéricos (ex.: `h-8 w-48`, depois `h-40 w-full`, `h-64 w-full`) dentro de `space-y-6`. Nada específico de nenhuma página. (Nota: o loading.tsx da rota /financeiro tem precedência sobre o genérico — os dois convivem sem conflito.)
    Comentário curto em português no topo de cada arquivo explicando o porquê (ex.: "Skeleton exibido instantaneamente durante a navegação — sem ele, o App Router bloqueia a UI até o servidor terminar todas as queries").
    Textos/comentários 100% em português. Não introduzir dependências novas.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>Os dois loading.tsx existem, compilam sem erro, usam o Skeleton do shadcn e o do financeiro espelha o layout real (cabeçalho, 6 cards, formulário, abas+tabela).</done>
</task>

<task type="auto">
  <name>Tarefa 2: helper reutilizável withRetry em src/lib/utils/with-retry.ts</name>
  <files>src/lib/utils/with-retry.ts</files>
  <action>
    Criar `src/lib/utils/with-retry.ts` no mesmo estilo (comentários em português, contexto do porquê) de `src/lib/utils/with-timeout.ts`. Assinatura:
    ```typescript
    export async function withRetry<T>(
      fn: () => Promise<T>,
      opts: {
        /** Teto (ms) da 1ª tentativa. */
        timeoutMs: number
        /** Teto (ms) da 2ª tentativa (retry). Default: timeoutMs. */
        retryTimeoutMs?: number
        /** Espera (ms) entre as tentativas. Default: 500. */
        delayMs?: number
        /** Rótulo para o TimeoutError. */
        label?: string
      },
    ): Promise<T>
    ```
    Comportamento: executa `withTimeout(fn(), timeoutMs, label)`; se rejeitar (qualquer erro — TimeoutError ou erro de conexão do pooler), aguarda `delayMs` (setTimeout em Promise) e tenta UMA vez mais com `withTimeout(fn(), retryTimeoutMs ?? timeoutMs, label + ' (retry)')`. Se a 2ª também falhar, propaga o erro da 2ª tentativa. Importar `withTimeout` de `./with-timeout` — não duplicar a lógica de timeout.
    IMPORTANTE: receber `fn: () => Promise<T>` (factory), NÃO uma Promise pronta — cada tentativa precisa disparar as queries de novo do zero. Documentar no comentário do arquivo: é o "F5 automático" server-side — a 2ª tentativa reaproveita as conexões já abertas/quentes do pool, que é exatamente por que o F5 manual sempre resolvia; e as promises da 1ª tentativa que estouraram o teto continuam em background (withTimeout não cancela), o que é aceitável aqui.
    Genérico e reutilizável (sem nada específico do financeiro). Não introduzir dependências novas.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>Helper existe, compila, reusa withTimeout, tenta exatamente 2 vezes (1 retry) com delay configurável e comentários em português explicando o mecanismo.</done>
</task>

<task type="auto">
  <name>Tarefa 3: carga do financeiro em 2 lotes sequenciais + retry automático na page.tsx</name>
  <files>src/app/(app)/financeiro/page.tsx</files>
  <action>
    Refatorar APENAS o bloco de carregamento de `src/app/(app)/financeiro/page.tsx` (linhas ~49-90). Manter intactos: o `await getCurrentUser()` de aquecimento antes das queries, o `export const maxDuration = 60`, a tela de erro "Financeiro indisponível no momento" (vira último recurso) e TODO o JSX de sucesso (zero mudança visual/funcional).
    1. Extrair a carga para uma função local `carregarDados` (factory, dentro do componente para capturar mes/ano) que roda os 8 selects em 2 lotes SEQUENCIAIS de 4 (opção de menor risco — NÃO reescrever as actions):
    ```typescript
    const carregarDados = async () => {
      // Lote 1: com pool max=3, disparar 8 queries de uma vez força 2 conexões
      // frias extras no pico do cold start — 2 lotes de 4 achatam esse pico.
      const [resumo, mrr, transacoes, clientesAtivos] = await Promise.all([
        getResumoFinanceiro(mes, ano),
        calcularMrr(),
        listTransacoes({ mes, ano }),
        db.select({ id: clientes.id, nome: clientes.nome }).from(clientes).where(eq(clientes.status, 'ativo')),
      ])
      // Lote 2: reaproveita as conexões já quentes do lote 1.
      const [contasReceber, contasPagar, previsao, profilesList] = await Promise.all([
        getContasAReceber(),
        getContasAPagar(),
        getPrevisaoCaixa(),
        getProfiles(),
      ])
      return { resumo, mrr, transacoes, clientesAtivos, contasReceber, contasPagar, previsao, profilesList }
    }
    ```
    2. Substituir o `withTimeout(Promise.all([...]), 15_000, 'financeiro-load')` por:
    ```typescript
    dados = await withRetry(carregarDados, {
      timeoutMs: 12_000,      // 1ª tentativa: falha rápido no soluço do pooler
      retryTimeoutMs: 15_000, // 2ª tentativa: conexões já quentes — o "F5 automático"
      label: 'financeiro-load',
    })
    ```
    importando `withRetry` de `@/lib/utils/with-retry` (remover o import de `withTimeout` da page se ficar sem uso). O catch existente continua igual: só renderiza a tela "Financeiro indisponível" se as DUAS tentativas falharem.
    3. Ajustar o destructuring a jusante para o objeto retornado (ou manter tupla — o que gerar menos diff), preservando exatamente os mesmos nomes de variáveis usados no JSX (`resumo, mrr, transacoes, clientesAtivos, contasReceber, contasPagar, previsao, profilesList`).
    4. Atualizar os comentários em português do bloco para refletir a nova estratégia (aquecimento → 2 lotes → retry → tela de erro como último recurso). NÃO mexer em `src/lib/db/index.ts` (pool `max: 3`, timeouts — calibrados e documentados). NÃO mexer nas actions de `src/actions/financeiro.ts`.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>`npm run build` passa; a page carrega em 2 lotes sequenciais dentro de withRetry (12s → 500ms → 15s); a tela de erro só aparece após 2 falhas; JSX de sucesso e nomes de variáveis inalterados.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` e `npm run build` passam sem erros.
- `src/app/(app)/financeiro/loading.tsx` e `src/app/(app)/loading.tsx` existem e usam `@/components/ui/skeleton`.
- `src/lib/utils/with-retry.ts` exporta `withRetry` reutilizando `withTimeout`.
- Em `page.tsx`: sem `Promise.all` único de 8 itens; 2 lotes de 4; `withRetry` no lugar do `withTimeout` direto; tela de erro preservada como último recurso; JSX de sucesso intocado.
- Nenhuma alteração em `src/lib/db/index.ts` nem em `src/actions/financeiro.ts`.
- Todos os textos visíveis e comentários novos em português.
</verification>

<success_criteria>
- Navegar para /financeiro mostra skeleton instantâneo (nunca mais navegação "congelada").
- Soluço momentâneo do pooler é absorvido pelo retry automático; a tela "Financeiro indisponível" só aparece se as 2 tentativas falharem (antes: qualquer soluço = tela de erro + F5 manual).
- Pico de conexões frias no cold start reduzido (2 lotes de 4 em vez de 8 simultâneas com pool max=3).
- Comportamento visual/funcional da página com dados carregados: idêntico ao atual.
- Build de produção passa.
</success_criteria>

<output>
Após concluir, criar `.planning/quick/260713-usi-corrigir-de-vez-o-travamento-erro-interm/260713-usi-SUMMARY.md`
</output>

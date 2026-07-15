---
phase: quick-260713-lso
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/meta/sync.ts
  - src/app/api/cron/sync-meta/route.ts
  - vercel.json
autonomous: true
requirements: [SYNC-CRON]
must_haves:
  truths:
    - "O sync da Meta roda automaticamente 1x/dia em produção (Vercel Cron), sem depender do botão manual"
    - "O cron descobre/atualiza as contas de anúncio da Meta antes de sincronizar insights"
    - "A rota de cron rejeita chamadas não autorizadas quando CRON_SECRET está setado"
    - "A lógica de descoberta de contas não fica mais duplicada inline na função Inngest e em sync.ts"
  artifacts:
    - path: "src/lib/meta/sync.ts"
      provides: "atualizarListaContasMeta() e sincronizarTudoMeta() exportadas"
      contains: "export async function atualizarListaContasMeta"
    - path: "src/app/api/cron/sync-meta/route.ts"
      provides: "Route Handler GET que o Vercel Cron chama"
      contains: "export async function GET"
    - path: "vercel.json"
      provides: "Agendamento do cron 1x/dia"
      contains: "crons"
  key_links:
    - from: "vercel.json"
      to: "/api/cron/sync-meta"
      via: "campo path do cron"
      pattern: "/api/cron/sync-meta"
    - from: "src/app/api/cron/sync-meta/route.ts"
      to: "sincronizarTudoMeta"
      via: "import de @/lib/meta/sync"
      pattern: "sincronizarTudoMeta"
    - from: "sincronizarTudoMeta"
      to: "atualizarListaContasMeta + sincronizarContasMeta"
      via: "chamada sequencial"
      pattern: "atualizarListaContasMeta"
---

<objective>
Automatizar o sync da Meta Ads em produção via **Vercel Cron** (1×/dia, limite do plano Hobby). Hoje o cron do Inngest não dispara em produção — só o botão manual (`POST /api/sync-meta`) funciona. Este plano cria uma rota GET dedicada ao cron, extrai a lógica de descoberta de contas (hoje duplicada inline na função Inngest) para `sync.ts` e agenda o disparo diário no `vercel.json`.

Purpose: Garantir que os dados de tráfego (insights de campanha/criativo, saldo e lista de contas) fiquem atualizados automaticamente, sem intervenção manual, eliminando o risco de "descobrir tarde demais".
Output: Duas funções novas em `src/lib/meta/sync.ts`, a rota `src/app/api/cron/sync-meta/route.ts` e o arquivo `vercel.json` na raiz.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
<!-- Contratos existentes que o executor deve usar diretamente — sem exploração de codebase. -->

De src/lib/meta/client.ts:
```typescript
// Retorna contas owned+client (sem duplicatas). Cada item tem id COM prefixo "act_".
export function fetchMetaAdAccounts(): Promise<Array<{
  id: string            // ex.: "act_123456" — remover /^act_/ antes de gravar
  name: string
  account_status: number
  currency: string
  funding_source?: string | null
}>>
```

De src/lib/meta/sync.ts (JÁ EXISTE — reaproveitar, não reescrever):
```typescript
// Sincroniza insights + saldo de TODAS as contas ativas (ou de um cliente).
// Nunca lança por conta individual. Passar null/undefined = todas as contas ativas.
export function sincronizarContasMeta(
  clienteId?: string | null,
): Promise<{ contas: number; insights: number }>
```

De src/lib/db/schema.ts (tabela adAccounts — campos usados no upsert de contas):
```
plataforma ('meta'), metaAccountId (id numérico, sem act_), nome,
accountStatus, currency, fundingSource, updatedAt
```

Padrão de upsert de contas a EXTRAIR (hoje inline em src/lib/inngest/functions/sync-meta-ads.ts,
passo 'sync-ad-accounts', linhas 19-57): para cada conta, remove prefixo act_, faz SELECT por
metaAccountId; se existe → UPDATE (nome/accountStatus/currency/fundingSource/updatedAt);
senão → INSERT com plataforma 'meta'.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extrair descoberta de contas e criar orquestrador em sync.ts</name>
  <files>src/lib/meta/sync.ts</files>
  <action>
    Adicionar DUAS funções exportadas a src/lib/meta/sync.ts (não remover nada do que já existe).

    1. `atualizarListaContasMeta(): Promise<number>`
       - Importar `fetchMetaAdAccounts` de '@/lib/meta/client' (adicionar ao import já existente de client no topo do arquivo).
       - Replicar EXATAMENTE a lógica hoje inline no passo 'sync-ad-accounts' de
         src/lib/inngest/functions/sync-meta-ads.ts (linhas 19-57): chamar `fetchMetaAdAccounts()`;
         para cada conta, `numericId = acc.id.replace(/^act_/, '')`; SELECT em `adAccounts` por
         `eq(adAccounts.metaAccountId, numericId)` limit 1; se existir, UPDATE com
         `{ nome: acc.name, accountStatus: acc.account_status, currency: acc.currency,
         fundingSource: acc.funding_source ?? null, updatedAt: new Date() }`; senão INSERT com
         `{ plataforma: 'meta', metaAccountId: numericId, nome: acc.name,
         accountStatus: acc.account_status, currency: acc.currency,
         fundingSource: acc.funding_source ?? null }`.
       - Retornar `metaAccounts.length`.

    2. `sincronizarTudoMeta(): Promise<{ contas: number; insights: number }>`
       - Chamar `await atualizarListaContasMeta()` primeiro.
       - Depois `return sincronizarContasMeta(null)` (todas as contas ativas), que já retorna
         `{ contas, insights }`. Reaproveitar — NÃO duplicar a lógica de insights.
       - Nunca lançar por conta individual: `sincronizarContasMeta` já isola erros por conta.
         `atualizarListaContasMeta` pode lançar se a API cair inteira — isso é aceitável (a rota
         de cron faz o try/catch). Não envolver conta por conta em try/catch extra aqui.

    NÃO alterar `src/lib/inngest/functions/sync-meta-ads.ts` (a função Inngest continua como está;
    o cron Inngest fica inativo em produção — comportamento documentado, não removido).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
    sync.ts exporta `atualizarListaContasMeta` e `sincronizarTudoMeta`; tsc passa; a lógica de
    upsert de contas espelha o passo 'sync-ad-accounts' da função Inngest.
  </done>
</task>

<task type="auto">
  <name>Task 2: Criar rota GET do cron protegida por CRON_SECRET</name>
  <files>src/app/api/cron/sync-meta/route.ts</files>
  <action>
    Criar a nova rota src/app/api/cron/sync-meta/route.ts:
    - `export const runtime = 'nodejs'`
    - `export const maxDuration = 300`
    - Handler `export async function GET(request: Request)` (Vercel Cron chama via GET, não POST).
    - Segurança: ler `const secret = process.env.CRON_SECRET`.
      - Se `secret` existir: exigir header `Authorization: Bearer ${secret}`. Comparar
        `request.headers.get('authorization') === \`Bearer ${secret}\``. Se não bater →
        `NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 })`.
      - Se `secret` NÃO estiver setado: permitir a execução, mas `console.warn('[cron/sync-meta]
        CRON_SECRET não configurado — rota desprotegida.')`.
    - NÃO chamar `getCurrentUser` (o cron não tem sessão de usuário).
    - Dentro de try/catch: `const { contas, insights } = await sincronizarTudoMeta()`, retornar
      `NextResponse.json({ ok: true, contas, insights })`. No catch:
      `console.error('[cron/sync-meta] Erro:', err)` e
      `NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }, { status: 500 })`.
    - Importar `NextResponse` de 'next/server' e `sincronizarTudoMeta` de '@/lib/meta/sync'.
      Seguir o padrão de src/app/api/sync-meta/route.ts (mesmas convenções de resposta JSON).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
    Arquivo existe com GET, runtime nodejs, maxDuration 300, checagem de CRON_SECRET (401 quando
    setado e header não bate; warn quando ausente), chama sincronizarTudoMeta e retorna JSON.
  </done>
</task>

<task type="auto">
  <name>Task 3: Agendar o cron em vercel.json e verificação final</name>
  <files>vercel.json</files>
  <action>
    Criar vercel.json na RAIZ do projeto com exatamente:
    ```json
    {
      "crons": [
        { "path": "/api/cron/sync-meta", "schedule": "0 9 * * *" }
      ]
    }
    ```
    - `0 9 * * *` = 09:00 UTC = 06:00 Brasília, 1×/dia (limite do plano Hobby: um cron diário).
    - NÃO incluir o campo `"regions"` — a região gru1 já está configurada no painel da Vercel
      e não deve ser tocada.
    - Verificar antes se já existe um vercel.json na raiz (não havia no snapshot do repo). Se
      existir, apenas adicionar/mesclar a chave `crons` sem remover configurações existentes.
  </action>
  <verify>
    <automated>npm run build && npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <done>
    vercel.json na raiz com o cron diário apontando para /api/cron/sync-meta, sem "regions".
    `npm run build` (next build), `tsc --noEmit` e `vitest run` passam sem erros.
  </done>
</task>

</tasks>

<verification>
Verificação obrigatória ao final (roda os três — o next build pega erros que o tsc não pega):
- `npm run build` — compila sem erros (valida rotas do App Router, incluindo a nova rota de cron)
- `npx tsc --noEmit` — sem erros de tipo
- `npx vitest run` — suíte de testes passa

Checagem manual do contrato:
- `src/lib/meta/sync.ts` exporta `atualizarListaContasMeta` e `sincronizarTudoMeta`.
- `sincronizarTudoMeta` chama descoberta de contas ANTES de `sincronizarContasMeta(null)`.
- `vercel.json` tem `crons[0].path === '/api/cron/sync-meta'` e schedule `'0 9 * * *'`, sem `regions`.
- Função Inngest (`sync-meta-ads.ts`) e botão manual (`POST /api/sync-meta`) INALTERADOS.
</verification>

<success_criteria>
- Rota GET `/api/cron/sync-meta` existe, protegida por CRON_SECRET (401 quando setado e header
  incorreto; warn quando ausente), sem `getCurrentUser`, com runtime nodejs e maxDuration 300.
- `sincronizarTudoMeta()` reaproveita `sincronizarContasMeta` (sem duplicar lógica de insights).
- `vercel.json` agenda 1×/dia às 09:00 UTC sem tocar em regions.
- Build, tsc e vitest passam.
- Nenhuma mudança de schema/migration; botão manual e função Inngest preservados.
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260713-lso-automacao-do-sync-meta-via-vercel-cron-1/260713-lso-SUMMARY.md`.
Commit somente dos arquivos específicos (NUNCA `git add -A`):
`src/lib/meta/sync.ts src/app/api/cron/sync-meta/route.ts vercel.json`
</output>

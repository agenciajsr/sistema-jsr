---
phase: 01-funda-o-acesso-clientes-e-contratos
plan: 02
subsystem: database
tags: [drizzle-orm, postgres, supabase, drizzle-kit, pgbouncer]

# Dependency graph
requires:
  - phase: 01-01
    provides: Projeto Next.js 16 escaonfolded, dependências instaladas (drizzle-orm, postgres, supabase-js/ssr), shadcn/ui configurado
provides:
  - "Schema Drizzle completo: tabelas profiles, clientes, contratos + enums role/nicho/cliente_status"
  - "Tabelas e enums criados no Postgres real do projeto Supabase (aplicado via drizzle-kit push)"
  - "Cliente Drizzle de runtime (src/lib/db/index.ts) usando conexão pooled (DATABASE_URL, porta 6543, prepare:false)"
  - "drizzle.config.ts apontando para conexão direta (DIRECT_URL) para uso por drizzle-kit"
  - ".env.example documentando todas as variáveis necessárias; .env.local preenchido com credenciais reais"
affects: [01-03, "fase-2-integracao-ads", "fase-4-financeiro-mrr"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contrato como tabela append-only (sem is_current) — 'contrato atual' é derivado via MAX(data_inicio) por cliente, não um flag armazenado"
    - "Dinheiro sempre como numeric(10,2), nunca float/real"
    - "Conexão pooled (6543, prepare:false) para runtime; conexão direta (5432, session mode via host do pooler) apenas para drizzle-kit"

key-files:
  created:
    - src/lib/db/schema.ts
    - src/lib/db/index.ts
    - drizzle.config.ts
    - .env.example
  modified:
    - .gitignore
    - .env.local (não versionado — preenchido pelo usuário/coordenador com credenciais reais do Supabase)

key-decisions:
  - "DIRECT_URL usa o host do connection pooler na porta 5432 (session mode), não o host clássico db.<ref>.supabase.co, que não resolveu (ENOTFOUND) neste ambiente — comportamento documentado do Supabase quando o host de conexão direta clássico é IPv6-only/indisponível sem add-on de IPv4"
  - "Corrigido .gitignore: padrão .env* estava também ignorando .env.example, que deve ser versionado como template (adicionada exceção !.env.example)"

patterns-established:
  - "Padrão de duas connection strings (pooled vs direta) replicado exatamente como especificado no research da fase — todo código futuro que precisar de acesso a banco via Drizzle deve importar db de src/lib/db/index.ts (nunca abrir uma nova conexão pooled/direta ad hoc)"

requirements-completed: [ACES-01, ACES-02, ACES-03, CLI-01, CLI-02, CLI-03, CLI-04]

# Metrics
duration: ~35min
completed: 2026-07-10
---

# Phase 01 Plan 02: Schema Drizzle e Migração Supabase Summary

**Schema Drizzle (profiles/clientes/contratos + enums) definido e aplicado com sucesso via `drizzle-kit push` contra um projeto Supabase Postgres real, com conexões pooled/direta corretamente separadas.**

## Performance

- **Duration:** ~35 min (incluindo pausa para checkpoint humano de configuração do Supabase)
- **Started:** 2026-07-10T21:45:00Z (aprox.)
- **Completed:** 2026-07-10T22:26:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint human-action)
- **Files modified:** 6 (3 criados no Task 1, 2 no Task 2/fix, 1 corrigido no Task 3 diagnóstico)

## Accomplishments
- Schema Drizzle completo com 3 tabelas (`profiles`, `clientes`, `contratos`) e 3 enums (`role`, `nicho`, `cliente_status`), seguindo exatamente os campos definidos em D-04 a D-08 do CONTEXT.md
- Conexões de runtime (pooled, `prepare:false`) e de migração (direta) corretamente separadas em arquivos distintos
- `.env.example` documentando todas as variáveis necessárias para rodar o projeto
- Migração aplicada com sucesso no Postgres real do projeto Supabase (`qqjtqqbyppnkeglkevcf`) — tabelas e enums confirmados via query direta em `information_schema`/`pg_type`
- Idempotência confirmada: segunda execução de `drizzle-kit push --force` reportou "No changes detected"

## Task Commits

Each task was committed atomically:

1. **Task 1: Definir schema Drizzle (profiles, clientes, contratos) e clientes de conexão** - `2738a88` (feat)
2. **Task 2: Criar .env.example com todas as variáveis necessárias** - `431de16` (chore, inclui fix de .gitignore)
3. **Task 3: Aplicar migração e verificar tabelas criadas** - sem commit de código (operação de infraestrutura via `drizzle-kit push`, que não gera arquivos versionáveis — apenas aplica o diff de schema diretamente no Postgres; `.env.local` foi ajustado mas permanece intencionalmente fora do controle de versão)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `src/lib/db/schema.ts` - Enums `role`/`nicho`/`cliente_status` e tabelas `profiles`/`clientes`/`contratos` com relations
- `src/lib/db/index.ts` - Cliente Drizzle de runtime, conexão pooled com `prepare: false`
- `drizzle.config.ts` - Configuração drizzle-kit apontando para `DIRECT_URL`
- `.env.example` - Template de todas as variáveis de ambiente necessárias
- `.gitignore` - Adicionada exceção `!.env.example` (estava sendo ignorado pelo padrão `.env*`)
- `.env.local` (não versionado) - Preenchido pelo coordenador com credenciais reais; `DIRECT_URL` corrigida durante a execução (ver Deviations)

## Decisions Made
- **DIRECT_URL usa o pooler na porta 5432 (session mode)** em vez do host clássico `db.<ref>.supabase.co` — o host clássico não resolveu neste ambiente (DNS `ENOTFOUND`), consistente com a limitação conhecida do Supabase de que a conexão direta "clássica" pode ser IPv6-only/indisponível sem o add-on de IPv4. O host do pooler na porta 5432 (modo sessão, sem `pgbouncer=true`) suporta os recursos de nível de sessão que `drizzle-kit` precisa, preservando a intenção original do Pitfall 2 do research (não usar a porta 6543/transaction-mode para migrações).
- Migração aplicada via `drizzle-kit push` (não `generate`+`migrate`), conforme especificado explicitamente no Task 3 do plano — não há pasta `drizzle/` com arquivos SQL gerados, pois `push` faz diff direto contra o banco.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` não existia no worktree**
- **Found during:** Task 1 (antes de rodar `npm run build`)
- **Issue:** O worktree não tinha dependências instaladas, apesar do plano 01-01 ter configurado o `package.json`
- **Fix:** Executado `npm install` na raiz do worktree
- **Files modified:** nenhum arquivo versionado (apenas `node_modules/`, já ignorado)
- **Verification:** `npm run build` e `npx next build` passaram a executar
- **Committed in:** N/A (não gera diff versionável)

**2. [Rule 1 - Bug] `.gitignore` ignorava `.env.example`**
- **Found during:** Task 2
- **Issue:** O padrão `.env*` no `.gitignore` (herdado do scaffold `create-next-app`) também excluía `.env.example`, que deveria ser versionado como template — `git status --ignored` confirmou que o arquivo nunca seria rastreado
- **Fix:** Adicionada exceção `!.env.example` logo após o padrão `.env*`
- **Files modified:** `.gitignore`
- **Verification:** `git status --short --ignored` confirmou `.env.example` como `??` (rastreável) após o fix
- **Committed in:** `431de16` (parte do commit da Task 2)

**3. [Rule 3 - Blocking] `DIRECT_URL` fornecida usava host de conexão direta clássico não resolvível**
- **Found during:** Task 3 (`drizzle-kit push --force` falhava silenciosamente após travar em "Pulling schema from database...", exit code 1 sem mensagem de erro clara)
- **Issue:** `.env.local` preenchido pelo coordenador usava `DIRECT_URL=postgresql://postgres:***@db.qqjtqqbyppnkeglkevcf.supabase.co:5432/postgres` — esse host não resolveu (`ENOTFOUND`) neste ambiente de rede, um comportamento conhecido do Supabase quando o endpoint de conexão direta "clássico" não está acessível via IPv4 sem add-on
- **Fix:** Testada conectividade TCP direta com Node (`net.createConnection`) contra três hosts/portas; confirmado que `db.<ref>.supabase.co:5432` falha (`ENOTFOUND`) mas o host do pooler (`aws-1-sa-east-1.pooler.supabase.com`) responde tanto na porta 5432 (session mode) quanto 6543 (transaction mode). Atualizado `DIRECT_URL` em `.env.local` para usar o host do pooler na porta 5432, mantendo a separação pooled(6543)/direta(5432) do Pitfall 2 do research
- **Files modified:** `.env.local` (não versionado)
- **Verification:** `drizzle-kit push --force` completou com `[✓] Changes applied`; segunda execução confirmou idempotência (`No changes detected`); query direta via `postgres` driver confirmou as 3 tabelas e os 3 enums esperados no Postgres
- **Committed in:** N/A (`.env.local` é intencionalmente não versionado)

Também usado `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs push --force` em vez de `npx drizzle-kit push --force`, pois `drizzle-kit` não carrega `.env.local` automaticamente e `NODE_OPTIONS="--env-file"` combinado com `npx` produziu um erro do próprio `npx` ("Could not determine Node.js install directory") neste ambiente Windows/Git Bash — invocar o `bin.cjs` diretamente com `node --env-file` contornou o problema sem alterar o comando documentado no plano em espírito (mesmo binário `drizzle-kit`, mesmos argumentos `push --force`).

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** Todos os auto-fixes foram necessários para completar a execução real contra o Supabase; nenhum foi scope creep. A correção do `DIRECT_URL` é a mais relevante para fases futuras — qualquer novo ambiente/projeto Supabase criado deve preferir o host do pooler na porta 5432 (session mode) para `DIRECT_URL`, não o host clássico `db.<ref>.supabase.co`, exceto se a rede/projeto confirmadamente suportar IPv6 ou tiver o add-on de IPv4.

## Issues Encountered
- `npx drizzle-kit push --force` combinado com `NODE_OPTIONS="--env-file=.env.local"` falhou com erro do próprio `npx` no Windows/Git Bash — resolvido invocando `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs push --force` diretamente (ver Deviations #3).

## User Setup Required

Nenhuma ação adicional — o checkpoint human-action deste plano (criação do projeto Supabase + preenchimento de `.env.local`) já foi concluído pelo usuário/coordenador antes desta etapa. `.env.local` está preenchido e a migração foi aplicada com sucesso no projeto real.

## Next Phase Readiness

- `src/lib/db` (schema + cliente Drizzle) está pronto para ser consumido por Server Actions e queries de qualquer fase futura
- Tabelas `profiles`, `clientes`, `contratos` existem no Postgres real e podem receber dados a partir do plano 01-03 (bootstrap do primeiro Admin, login, CRUD de clientes/contratos)
- Nenhum bloqueio conhecido para o plano 01-03

---
*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Completed: 2026-07-10*

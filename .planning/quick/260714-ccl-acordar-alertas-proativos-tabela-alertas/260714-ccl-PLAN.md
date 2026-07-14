---
phase: quick-260714-ccl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/schema.ts
  - drizzle/0013_*.sql
  - drizzle/meta/*
  - src/lib/alertas/calcular.ts
  - src/lib/alertas/persistir.ts
  - src/lib/alertas/types.ts
  - src/actions/alertas.ts
  - src/app/api/cron/sync-meta/route.ts
  - src/app/(app)/alertas/page.tsx
  - src/app/(app)/alertas/alertas-client.tsx
  - src/components/layout/alertas-bell.tsx
  - src/app/api/cron/relatorios-semanais/route.ts
  - src/actions/relatorios.ts
  - src/app/(app)/relatorios/relatorios-content.tsx
  - src/app/api/inngest/route.ts
  - vercel.json
autonomous: true
requirements: [QUICK-ALERTAS-PERSISTIDOS, QUICK-RELATORIO-SEMANAL-CRON]

must_haves:
  truths:
    - "Alertas são avaliados e gravados no banco automaticamente no run diário do cron sync-meta (sem abrir a página)"
    - "Alerta que deixa de existir na avaliação é resolvido automaticamente (status resolvido + resolvidoEm)"
    - "Página /alertas lista do banco com abas novos/lidos/resolvidos e ação de marcar como lido"
    - "Sininho do header mostra a contagem de alertas com status novo"
    - "Toda segunda às 07h (BR) um cron gera relatório semanal de cada cliente ativo e grava histórico"
    - "Página /relatorios exibe o histórico de relatórios salvos com botão de copiar"
  artifacts:
    - path: "src/lib/db/schema.ts"
      provides: "Tabelas alertas e relatorios no schema Drizzle"
      contains: "pgTable('alertas'"
    - path: "src/lib/alertas/persistir.ts"
      provides: "avaliarEPersistirAlertas() com upsert por chaveDedup e resolução automática"
    - path: "src/app/api/cron/relatorios-semanais/route.ts"
      provides: "Endpoint de cron protegido por CRON_SECRET que gera e persiste relatórios semanais"
    - path: "vercel.json"
      provides: "2º cron agendado"
      contains: "relatorios-semanais"
    - path: "drizzle"
      provides: "Migration aditiva gerada pelo drizzle-kit (NÃO aplicada)"
  key_links:
    - from: "src/app/api/cron/sync-meta/route.ts"
      to: "src/lib/alertas/persistir.ts"
      via: "chamada avaliarEPersistirAlertas() ao final do handler, com try/catch próprio"
      pattern: "avaliarEPersistirAlertas"
    - from: "src/app/(app)/alertas/page.tsx"
      to: "tabela alertas"
      via: "server action que lê do banco (não mais cálculo on-the-fly)"
    - from: "src/app/api/cron/relatorios-semanais/route.ts"
      to: "src/lib/relatorios/gerar-relatorio.ts"
      via: "gerarRelatorioCliente() reutilizado + INSERT em relatorios"
      pattern: "gerarRelatorioCliente"
---

<objective>
Acordar os dois "robôs" do Sistema JSR que hoje estão mortos (Inngest nunca rodou em produção):

1. **Alertas proativos persistidos**: hoje `getAlertas()` calcula tudo on-the-fly ao abrir a página, sem histórico nem noção de "novo/lido/resolvido". Passa a existir uma tabela `alertas` alimentada automaticamente no cron diário (dentro do handler do sync-meta — plano Hobby só permite 2 crons), com dedup, resolução automática e UI de triagem.
2. **Relatório semanal automático**: a função Inngest `gerarRelatoriosSemanais` existe mas nunca dispara. Migra para um 2º Vercel Cron (segunda 07h BR) que gera o relatório da semana anterior de cada cliente ativo e grava em uma tabela `relatorios` (histórico), reusando `gerarRelatorioCliente()`.

Propósito: eliminar o risco de "descobrir tarde demais" — o sistema detecta e registra problemas sozinho, todo dia, e entrega os relatórios de segunda prontos.
Saída: migration aditiva (gerada, NÃO aplicada), motor de persistência de alertas, cron de relatórios, UI atualizada em /alertas e /relatorios.

**Idioma: TODOS os textos de UI, comentários e mensagens em PORTUGUÊS.**
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@src/lib/db/schema.ts
@src/actions/alertas.ts
@src/lib/alertas/avaliar.ts
@src/lib/alertas/types.ts
@src/lib/saude/avaliar-campanhas.ts
@src/app/api/cron/sync-meta/route.ts
@src/app/(app)/alertas/page.tsx
@src/app/(app)/alertas/alertas-client.tsx
@src/components/layout/alertas-bell.tsx
@src/actions/relatorios.ts
@src/lib/relatorios/gerar-relatorio.ts
@src/lib/inngest/functions/gerar-relatorios-semanais.ts
@src/app/api/inngest/route.ts
@src/app/(app)/relatorios/relatorios-content.tsx
@src/lib/date-br.ts
@vercel.json
@drizzle.config.ts

<interfaces>
<!-- Contratos existentes que o executor deve REUSAR, sem reescrever regras de negócio. -->

De src/lib/alertas/types.ts:
```typescript
export type TipoAlerta = 'contrato_vencendo' | 'pagamento_vencido' | 'cliente_inativo' | 'verba_baixa'
  | 'cpa_alto' | 'performance_caindo' | 'ctr_caindo' | 'sem_conversao' | 'criativo_rejeitado' | 'fadiga_criativo'
export type SeveridadeAlerta = 'critico' | 'atencao' | 'info'
export interface Alerta {
  id: string           // JÁ É uma chave lógica estável: `contrato-${id}`, `transacao-${id}`,
                       // `cliente-${id}`, `verba-${contaId}`, `${idBase}-${clienteId}` (campanhas)
  tipo: TipoAlerta
  severidade: SeveridadeAlerta
  titulo: string
  detalhe: string
  clienteNome: string
  clienteId: string    // ATENÇÃO: pode ser '' (string vazia) quando não há cliente — converter para null ao persistir
  dataRelevante: string
}
```

De src/actions/alertas.ts (a orquestração de queries + avaliadores puros que vai ser EXTRAÍDA para lib):
```typescript
export async function getAlertas(): Promise<Alerta[]>                       // hoje: calcula on-the-fly
export async function getAlertasDoCliente(clienteId: string): Promise<Alerta[]>
```

De src/lib/relatorios/gerar-relatorio.ts (REUSAR como está):
```typescript
export async function gerarRelatorioCliente(
  clienteId: string, dataInicio?: string, dataFim?: string,
): Promise<RelatorioGerado | null>   // defaults já são "semana anterior": inicio=dataMenosDias(7), fim=dataMenosDias(1)
// RelatorioGerado tem: clienteId, clienteNome, periodoInicio, periodoFim, textoWhatsapp, geradoEm, ...
```

De src/actions/relatorios.ts (REUSAR):
```typescript
export async function listarClientesRelatorio(): Promise<ClienteParaRelatorio[]>  // clientes ativos com conta Meta ativa (exige sessão — NÃO usar no cron)
export async function gerarRelatorio(clienteId, dataInicio?, dataFim?)            // ação manual — passa a TAMBÉM persistir
```

De src/lib/date-br.ts: `hojeBrasilia()`, `dataMenosDias(n, base?)` — usados pela função Inngest morta; reusar no cron.

Padrão de cron existente (src/app/api/cron/sync-meta/route.ts): `runtime = 'nodejs'`, `maxDuration`, checagem `Authorization: Bearer ${CRON_SECRET}` com warn se ausente, try/catch com NextResponse.json.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tarefa 1: Tabelas alertas/relatorios + motor avaliarEPersistirAlertas + gancho no cron sync-meta</name>
  <files>src/lib/db/schema.ts, drizzle/0013_*.sql (gerada), drizzle/meta/*, src/lib/alertas/calcular.ts, src/lib/alertas/persistir.ts, src/app/api/cron/sync-meta/route.ts</files>
  <action>
**1. Schema Drizzle (src/lib/db/schema.ts)** — adicionar DUAS tabelas ao final, seguindo o padrão das existentes (uuid pk defaultRandom, timestamptz, index, comentários em português):

Tabela `alertas`:
- `id` uuid pk defaultRandom
- `tipo` text notNull (os valores de TipoAlerta — usar text, NÃO pgEnum, para não travar quando novos tipos surgirem)
- `clienteId` uuid nullable, references clientes.id onDelete cascade
- `clienteNome` text notNull (denormalizado — o Alerta atual carrega o nome; evita join na leitura)
- `titulo` text notNull
- `detalhe` text notNull (equivale à "descricao" do desenho — mantém o nome do campo do tipo Alerta existente)
- `severidade` text notNull ('critico'|'atencao'|'info')
- `status` text notNull default 'novo' ('novo'|'lido'|'resolvido')
- `chaveDedup` text notNull + uniqueIndex (identidade lógica do alerta = o `id` que os avaliadores já produzem, ex. `verba-${contaId}`)
- `dataRelevante` text notNull (formato YYYY-MM-DD, como o tipo Alerta)
- `detectadoEm` timestamptz notNull defaultNow
- `resolvidoEm` timestamptz nullable
- `createdAt`/`updatedAt` timestamptz notNull defaultNow
- index em (status), para a contagem do sininho

Tabela `relatorios`:
- `id` uuid pk defaultRandom
- `clienteId` uuid notNull references clientes.id onDelete cascade
- `clienteNome` text notNull (denormalizado, sobrevive à exclusão lógica e evita join)
- `tipo` text notNull ('semanal'|'manual')
- `periodoInicio` date notNull, `periodoFim` date notNull
- `conteudo` text notNull (o textoWhatsapp gerado)
- `geradoEm` timestamptz notNull defaultNow
- `createdAt` timestamptz notNull defaultNow
- index em (clienteId, geradoEm)

Adicionar relations mínimas (padrão `documentosRelations`).

**2. Extrair o cálculo puro (src/lib/alertas/calcular.ts)** — mover o corpo de `getAlertas()` de src/actions/alertas.ts (as 4-5 queries + avaliadores + getAlertasCampanhas com try/catch) para uma função `calcularAlertasAtuais(): Promise<Alerta[]>` SEM checagem de sessão (o cron não tem usuário logado). Não alterar nenhuma regra de negócio — é recorte e cola da orquestração existente. A action getAlertas será refeita na Tarefa 2.

**3. Motor de persistência (src/lib/alertas/persistir.ts)** — `avaliarEPersistirAlertas()`:
- Chama `calcularAlertasAtuais()`.
- Carrega do banco todos os alertas com status != 'resolvido' (abertos: 'novo' e 'lido').
- Para cada alerta calculado (chave = `alerta.id` → coluna chaveDedup, com `clienteId === '' ? null : clienteId`):
  - Não existe linha com essa chaveDedup → INSERT (status 'novo', detectadoEm now).
  - Existe linha aberta → UPDATE de titulo/detalhe/severidade/dataRelevante/clienteNome/updatedAt, PRESERVANDO status ('lido' continua 'lido') — não duplicar.
  - Existe linha mas está 'resolvido' → REABRIR: status 'novo', detectadoEm=now, resolvidoEm=null, campos atualizados (o problema voltou).
  - Implementar com `onConflictDoUpdate` no uniqueIndex de chaveDedup OU select+branch — o que ficar mais claro; atenção que o "preservar status quando aberto / reabrir quando resolvido" exige lógica condicional (sql`CASE` no onConflictDoUpdate ou caminho select+update).
- Resolução automática: alertas abertos no banco cuja chaveDedup NÃO está no conjunto calculado → status 'resolvido', resolvidoEm=now, updatedAt=now (um único UPDATE ... WHERE chaveDedup IN (...) ou notInArray).
- Retornar resumo `{ novos, atualizados, reabertos, resolvidos }` para log.

**4. Gancho no cron (src/app/api/cron/sync-meta/route.ts)** — após `sincronizarTudoMeta()` bem-sucedido, chamar `avaliarEPersistirAlertas()` dentro de try/catch PRÓPRIO: falha na avaliação de alertas NÃO pode quebrar a resposta do sync (logar `[cron/sync-meta] falha ao avaliar alertas` e seguir). Incluir o resumo dos alertas no JSON de resposta quando der certo (ex.: `{ ok: true, contas, insights, alertas: resumo }`).

**5. Migration** — rodar `npx drizzle-kit generate` na raiz. Conferir que o .sql gerado é 100% ADITIVO (só CREATE TABLE / CREATE INDEX / ALTER ADD CONSTRAINT das novas tabelas — nenhum DROP/ALTER em tabela existente). **NÃO APLICAR no banco** (não rodar migrate/push) — o orquestrador aplica depois. Commitar o .sql e os artefatos de drizzle/meta.
  </action>
  <verify>
    <automated>npx tsc --noEmit && ls drizzle/0013_*.sql && grep -L "DROP" drizzle/0013_*.sql && grep -q "avaliarEPersistirAlertas" src/app/api/cron/sync-meta/route.ts && echo OK</automated>
  </verify>
  <done>Tabelas `alertas` e `relatorios` no schema; migration 0013 aditiva gerada (não aplicada); `avaliarEPersistirAlertas()` com upsert por chaveDedup, reabertura e resolução automática; cron sync-meta chama a avaliação com try/catch isolado; tsc passa.</done>
</task>

<task type="auto">
  <name>Tarefa 2: /alertas lê do banco (abas, marcar como lido) + sininho conta status novo</name>
  <files>src/actions/alertas.ts, src/lib/alertas/types.ts, src/app/(app)/alertas/page.tsx, src/app/(app)/alertas/alertas-client.tsx, src/components/layout/alertas-bell.tsx</files>
  <action>
**1. Tipos (src/lib/alertas/types.ts)** — adicionar (sem alterar `Alerta`, que outros consumidores usam — dashboard, chat IA):
```typescript
export type StatusAlerta = 'novo' | 'lido' | 'resolvido'
export interface AlertaPersistido extends Alerta {
  dbId: string            // uuid da linha (para as ações de status)
  status: StatusAlerta
  detectadoEm: string     // ISO
  resolvidoEm: string | null
}
```

**2. Server actions (src/actions/alertas.ts)** — reescrever para ler do banco:
- `getAlertas(): Promise<Alerta[]>` — mantém assinatura (compatibilidade com dashboard/chat IA): exige sessão (getCurrentUser), lê da tabela `alertas` onde status != 'resolvido', ordena por severidade (reusar `ordenarPorSeveridade`), mapeia linha → Alerta com `id = chaveDedup` e `clienteId = clienteId ?? ''` (contrato antigo preservado).
- `getAlertasDoCliente(clienteId)` — query direta no banco filtrando clienteId e status != 'resolvido' (não mais filtro em memória).
- `listarAlertasPersistidos(): Promise<AlertaPersistido[]>` — todos (inclusive resolvidos, limit 200, resolvidos ordenados por resolvidoEm desc) para a página com abas.
- `getContagemAlertasNovos(): Promise<number>` — `count(*)` onde status = 'novo' (barata, para o sininho).
- `marcarAlertaComoLido(dbId: string)` e `marcarTodosComoLidos()` — UPDATE status 'novo'→'lido' (+updatedAt), depois `revalidatePath('/alertas')`.
- `reavaliarAlertasAgora()` — exige sessão; chama `avaliarEPersistirAlertas()` e `revalidatePath('/alertas')`; retorna o resumo. Cobre o primeiro deploy (tabela vazia até o cron rodar) e dá botão manual.

**3. Página (src/app/(app)/alertas/page.tsx)** — passa a chamar `listarAlertasPersistidos()` e repassar ao client. Manter `maxDuration = 60`.

**4. UI (src/app/(app)/alertas/alertas-client.tsx)** — evoluir mantendo o visual premium existente (cards shadcn, TIPO_ICON/TIPO_LABEL/SEVERIDADE_CONFIG intactos):
- REMOVER todo o mecanismo de localStorage (getDismissedMap/saveDismissedMap/isAlertDismissed) — o status agora vive no banco.
- Abas/filtros simples com Buttons ou Tabs shadcn já instaladas: **Novos** (default), **Lidos**, **Resolvidos**, com contagem em cada aba.
- Cada card de alerta novo ganha ação "Marcar como lido" (substitui o X de dispensar) chamando `marcarAlertaComoLido` via useTransition; aba Novos tem botão "Marcar todos como lidos".
- Aba Resolvidos mostra badge/texto "Resolvido em {data}" (formatar resolvidoEm pt-BR).
- Header da página ganha botão discreto "Reavaliar agora" (ícone RefreshCw + useTransition) chamando `reavaliarAlertasAgora()`; ao concluir, recarregar via `router.refresh()`.
- Estado vazio da aba Novos mantém a mensagem "Nenhum alerta no momento — tudo em ordem."
- Todos os textos em português.

**5. Sininho (src/components/layout/alertas-bell.tsx)** — trocar `getAlertas().then(a => a.length)` por `getContagemAlertasNovos()`. Manter o padrão de useEffect pós-render com catch → 0 (não bloquear o layout).

Conferir que `src/components/dashboard/alertas-importantes.tsx` e o snapshot do chat IA continuam compilando sem mudanças (getAlertas manteve a assinatura e o shape).
  </action>
  <verify>
    <automated>npx tsc --noEmit && grep -q "getContagemAlertasNovos" src/components/layout/alertas-bell.tsx && ! grep -q "localStorage" src/app/\(app\)/alertas/alertas-client.tsx && echo OK</automated>
  </verify>
  <done>/alertas lista do banco com abas novos/lidos/resolvidos, marcar como lido (individual e em massa) com revalidatePath, botão "Reavaliar agora"; sininho conta só status 'novo'; getAlertas/getAlertasDoCliente mantêm contrato e passam a ler do banco; localStorage removido; tsc passa.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Cron de relatórios semanais + histórico persistido + aposentar função Inngest morta</name>
  <files>src/app/api/cron/relatorios-semanais/route.ts, vercel.json, src/actions/relatorios.ts, src/app/(app)/relatorios/relatorios-content.tsx, src/app/api/inngest/route.ts</files>
  <action>
**1. Endpoint (src/app/api/cron/relatorios-semanais/route.ts)** — mesmo padrão do sync-meta: `runtime = 'nodejs'`, `maxDuration = 60`, checagem `Authorization: Bearer ${CRON_SECRET}` (401 se divergir; warn se CRON_SECRET ausente), comentários em português.
- Período: semana anterior segunda→domingo. Como roda segunda 07h BR, usar os defaults de `gerarRelatorioCliente` (inicio=`dataMenosDias(7)`, fim=`dataMenosDias(1)`) — passar explicitamente com `dataMenosDias` de src/lib/date-br para clareza.
- Clientes: reaproveitar a SELEÇÃO da função Inngest morta (clientes status 'ativo' com adAccounts meta ativas) consultando o banco direto — NÃO usar `listarClientesRelatorio()` (exige sessão, cron não tem).
- Para cada cliente, try/catch PRÓPRIO (erro em um não interrompe os demais): `gerarRelatorioCliente(...)`; se retornar relatório, INSERT em `relatorios` com tipo 'semanal', clienteNome, periodoInicio/Fim e conteudo=textoWhatsapp; se null, contar como 'sem_dados'.
- Response JSON com resumo: `{ ok: true, periodo, total, gerados, semDados, erros }` + console.error por cliente que falhar.

**2. vercel.json** — adicionar o 2º cron (limite do plano Hobby = 2, 1x/dia cada):
```json
{ "path": "/api/cron/relatorios-semanais", "schedule": "0 10 * * 1" }
```
(segunda 10h UTC = 07h Brasília.)

**3. Ação manual persiste (src/actions/relatorios.ts)** — em `gerarRelatorio()`, após gerar com sucesso, INSERT em `relatorios` com tipo 'manual' (try/catch próprio: falha ao salvar histórico não impede devolver o relatório gerado — logar e seguir). NÃO alterar `gerarRelatoriosEmLote` além do necessário (se trivial, persistir também com tipo 'manual'; senão, deixar como está).
- Nova action `listarHistoricoRelatorios()`: exige sessão; select em `relatorios` order by geradoEm desc, limit 50; retorna `{ id, clienteNome, tipo, periodoInicio, periodoFim, conteudo, geradoEm }[]`.

**4. UI histórico (src/app/(app)/relatorios/relatorios-content.tsx)** — nova seção "Histórico" abaixo do fluxo manual atual, seguindo o padrão visual existente (Card shadcn, mesma tipografia):
- Carregar via `listarHistoricoRelatorios()` no useEffect existente (junto com listarClientesRelatorio).
- Lista simples: cliente, badge do tipo ('Semanal'/'Manual'), período (dd/mm → dd/mm), gerado em (data/hora pt-BR), botão copiar conteúdo (reusar o padrão de cópia/feedback `copiado` já presente no componente) e expandir/recolher para ver o texto.
- Estado vazio: "Nenhum relatório salvo ainda — os relatórios de segunda-feira aparecem aqui automaticamente."
- Após gerar manualmente com sucesso, recarregar a lista do histórico.

**5. Inngest (src/app/api/inngest/route.ts)** — remover `gerarRelatoriosSemanais` do array `functions` e o import correspondente. NÃO deletar os arquivos de src/lib/inngest/ nesta tarefa (manter `syncMetaAds` como está).

**6. Verificação final do plano** — rodar `npm run build` além do tsc para garantir que as rotas novas compilam no App Router.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run build && grep -q "relatorios-semanais" vercel.json && ! grep -q "gerarRelatoriosSemanais" src/app/api/inngest/route.ts && echo OK</automated>
  </verify>
  <done>Cron de segunda 07h BR gera e persiste relatórios de todos os clientes ativos (erro isolado por cliente); vercel.json com 2 crons; geração manual também salva histórico (tipo 'manual'); /relatorios exibe seção Histórico com copiar/expandir; função Inngest morta removida do serve(); tsc e build passam.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` e `npm run build` passam sem erros.
- Migration 0013 existe em drizzle/, é puramente aditiva (CREATE TABLE alertas, relatorios + índices) e NÃO foi aplicada ao banco.
- `grep avaliarEPersistirAlertas src/app/api/cron/sync-meta/route.ts` encontra o gancho, envolto em try/catch próprio.
- vercel.json contém exatamente 2 crons: sync-meta (0 9 * * *) e relatorios-semanais (0 10 * * 1).
- Nenhum uso de localStorage restante em alertas-client.tsx.
- getAlertas() mantém assinatura `Promise<Alerta[]>` — dashboard (alertas-importantes.tsx) e snapshot do chat IA compilam sem mudanças.
- Commits com arquivos ESPECÍFICOS (nunca `git add -A` — o repo tem .claude/ com worktrees).
</verification>

<success_criteria>
- Robô 1 vivo: o run diário do cron sync-meta avalia e grava alertas (novos/atualizados/reabertos/resolvidos automaticamente por chaveDedup), a página /alertas faz triagem por status e o sininho reflete só os novos.
- Robô 2 vivo: toda segunda 07h BR o cron gera o relatório da semana anterior de cada cliente ativo e grava em `relatorios`; o histórico aparece em /relatorios com copiar pronto para WhatsApp; a geração manual também alimenta o histórico.
- Zero dependências novas; textos e comentários em português; regras de negócio existentes (avaliadores de alerta e gerador de relatório) reutilizadas sem reescrita.
- Migrations geradas e commitadas, aplicação no banco fica com o orquestrador.
</success_criteria>

<output>
Após concluir, criar `.planning/quick/260714-ccl-acordar-alertas-proativos-tabela-alertas/260714-ccl-SUMMARY.md` seguindo o template de summary.
</output>

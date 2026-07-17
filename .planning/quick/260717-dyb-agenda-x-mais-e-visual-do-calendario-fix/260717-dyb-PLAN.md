---
phase: quick-260717-dyb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/agenda/agenda-calendario.tsx
  - src/lib/cobrancas/gerar.ts
  - src/lib/cobrancas/regras.test.ts
  - src/lib/asaas/client.ts
  - scripts/cancelar-cobranca-duplicada.ts
autonomous: true
requirements: [QUICK-DYB-AGENDA, QUICK-DYB-DUP, QUICK-DYB-CANCEL]
must_haves:
  truths:
    - "Clicar em '+x mais' no calendário mensal abre um Popover com TODOS os compromissos do dia, cada um clicável abrindo o mesmo dialog de edição dos chips normais"
    - "Cliente com cobrança MANUAL de uma competência não recebe cobrança automática duplicada da mesma competência (cron e primeira cobrança)"
    - "A cobrança duplicada cba003b1-… está com status 'cancelada' no banco e o payment pay_alt9pinbxw0rlwaq está cancelado no Asaas sandbox"
  artifacts:
    - path: "src/components/agenda/agenda-calendario.tsx"
      provides: "Popover do '+x mais' + visual refinado do calendário"
    - path: "src/lib/cobrancas/gerar.ts"
      provides: "Consulta de competências cobertas SEM filtro criadoVia, excluindo canceladas"
    - path: "src/lib/asaas/client.ts"
      provides: "cancelarCobranca (DELETE /payments/:id)"
      exports: ["cancelarCobranca"]
    - path: "scripts/cancelar-cobranca-duplicada.ts"
      provides: "Script pontual que cancela no Asaas e marca cancelada no banco"
  key_links:
    - from: "src/components/agenda/agenda-calendario.tsx"
      to: "abrirEvento/setEventoAberto"
      via: "itens do Popover reutilizam o mesmo handler dos chips"
      pattern: "abrirEvento"
    - from: "src/lib/cobrancas/gerar.ts"
      to: "cobrancas.status"
      via: "ne(cobrancas.status, 'cancelada') no lugar de eq(criadoVia, 'automatico')"
      pattern: "ne\\(cobrancas\\.status"
    - from: "scripts/cancelar-cobranca-duplicada.ts"
      to: "src/lib/asaas/client.ts"
      via: "import { cancelarCobranca }"
      pattern: "cancelarCobranca"
---

<objective>
Três frentes independentes no Sistema JSR (tudo pt-BR):
1. /agenda: chip "+x mais" funcional (Popover com a lista completa do dia) + polimento visual do calendário (hoje destacado, hover, densidade, dark mode).
2. Bug de cobrança duplicada: `gerarCobrancasMensais`/`gerarPrimeiraCobranca` só enxergam cobranças `criadoVia='automatico'` ao decidir quais competências faltam — cobrança manual da mesma competência fica invisível e o cron duplica. Corrigir + testes.
3. Executar de fato o cancelamento da duplicata real no Asaas sandbox + banco.

Output: calendário com "+x mais" clicável e visual refinado; geração de cobranças imune a duplicata quando já existe cobrança manual; duplicata cba003b1 cancelada no Asaas e no banco.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/agenda/agenda-calendario.tsx
@src/lib/cobrancas/gerar.ts
@src/lib/cobrancas/regras.ts
@src/lib/cobrancas/regras.test.ts
@src/lib/asaas/client.ts
@src/actions/cobrancas.ts

<interfaces>
Fatos verificados no código real:

- `agenda-calendario.tsx` (client): agrupa eventos em `porDia: Map<string, EventoAgenda[]>`; no modo mês `limite = 3`, `extras = doDia.length - visiveis.length`, e o chip é hoje um `<span>` inerte: `+{extras} mais`. Edição via `abrirEvento(ev)` → `setEventoAberto` → Dialog com `EventoForm`. Helpers já existentes: `chaveDia`, `horario(ev)`, `paraDatetimeLocal`.
- `gerar.ts`: dois pontos com o filtro bugado —
  - `gerarPrimeiraCobranca`: `where(and(eq(cobrancas.contratoId, contratoId), eq(cobrancas.criadoVia, 'automatico')))`
  - `gerarCobrancasMensais`: `and(inArray(cobrancas.contratoId, ...), eq(cobrancas.criadoVia, 'automatico'))`
  Ambos alimentam `competenciasPendentes(contrato, competenciasJaGeradas, hoje)` (função PURA em regras.ts — ela já trata qualquer lista; o bug é só na QUERY).
- Status `'cancelada'` existe (usado em src/actions/cobrancas.ts linha 249 e no webhook). Drizzle: usar `ne(cobrancas.status, 'cancelada')`.
- `asaas/client.ts`: tem `requisicao(path, { method: 'GET' | 'POST', body })` privada — para DELETE, ampliar o union de method. `baseUrl()` já resolve sandbox via `ASAAS_ENV`. Não existe função de cancelar.
- Scripts pontuais: padrão dos `scripts/aplicar-migration-*.ts` — rodar com `npx tsx --env-file=.env.local scripts/x.ts`, conectar com `postgres(process.env.DIRECT_URL)` (decisão registrada: tsx não carrega .env.local sozinho; dotenv NÃO está instalado).
- Duplicata real: cobrança id `cba003b1-eddb-48c2-a05e-be6989510ea9`, asaas_payment_id `pay_alt9pinbxw0rlwaq`, cliente "Jacson Ribeiro Sandbox".
- Componente Popover: verificar se `src/components/ui/popover.tsx` existe (já usado em /tarefas — quick 260715-ibf usou "shadcn popover+calendar", deve existir). Se não, `npx shadcn add popover`.
- Memória dark mode: badges/cores pastel precisam de variante `dark:`; vars centrais vivem no bloco `.dark`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: /agenda — Popover no "+x mais" e polimento visual do calendário</name>
  <files>src/components/agenda/agenda-calendario.tsx</files>
  <action>
Em `agenda-calendario.tsx`:

1. **Chip "+x mais" funcional:** trocar o `<span>` inerte por um `Popover` (shadcn — `@/components/ui/popover`; se o arquivo não existir, `npx shadcn add popover`). Trigger = botão discreto "+{extras} mais". `PopoverContent` (w-64/72) com:
   - Cabeçalho: data do dia por extenso em pt-BR (ex.: "quinta, 17 de julho") — usar `format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })`.
   - Lista de TODOS os `doDia` (não só os extras), cada item um `<button>` que chama `abrirEvento(ev)` — mesmo handler dos chips normais, abrindo o Dialog de edição existente. Mostrar horário (`horario(ev)`) + título truncado + local quando houver.
   - Fechar o Popover ao clicar num item (abrir o Dialog por cima já resolve; se necessário, controlar `open` com estado por dia — pode usar um único estado `popoverDiaAberto: string | null`).

2. **Polimento visual (carta branca, capricho):**
   - Dia de hoje: célula com fundo sutil (`bg-primary/5`) e/ou anel, número do dia mantendo o círculo `bg-primary text-primary-foreground`.
   - Chips de evento: leve cor mais rica — ex.: borda esquerda `border-l-2 border-primary`, fundo `bg-primary/10 hover:bg-primary/15`, `dark:bg-primary/20 dark:hover:bg-primary/25` (memória: pastel precisa de `dark:`). Manter truncamento e title.
   - Hover na célula do dia: `hover:bg-muted/40` transição suave (sem atrapalhar o hover dos chips).
   - Dias fora do mês: manter `bg-muted/40` + número esmaecido; opcionalmente ocultar chips só com contagem — NÃO, manter chips (comportamento atual), só garantir contraste.
   - Fim de semana: número/cabeçalho levemente esmaecido (opcional, a critério).
   - Estado vazio do mês/semana (nenhum evento em toda a grade): faixa discreta abaixo da grade "Nenhum compromisso neste período." — só quando `eventos.length === 0`.
   - Altura das células mensais: subir para `min-h-28` se ficar melhor com os novos chips.
   - Conferir todas as classes novas em dark mode (nada de cor pastel sem `dark:`).

Todo texto em pt-BR. Não mexer na navegação/URL nem no EventoForm.
  </action>
  <verify>
    <automated>cd C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr && npx tsc --noEmit</automated>
  </verify>
  <done>"+x mais" abre Popover listando todos os compromissos do dia, itens clicáveis abrem o Dialog de edição; hoje destacado, hover e dark mode corretos; build de tipos limpo.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix cobrança duplicada — competência coberta por QUALQUER cobrança não cancelada</name>
  <files>src/lib/cobrancas/gerar.ts, src/lib/cobrancas/regras.test.ts</files>
  <behavior>
    - Competência com cobrança MANUAL existente NÃO entra nas pendentes (não duplica no cron nem na primeira cobrança).
    - Competência cuja única cobrança está CANCELADA volta a ser pendente (é regerada).
    - Comportamento anterior com cobranças automáticas segue idêntico.
  </behavior>
  <action>
Em `src/lib/cobrancas/gerar.ts`, nos DOIS pontos que consultam competências já geradas:

1. `gerarPrimeiraCobranca`: trocar `eq(cobrancas.criadoVia, 'automatico')` por `ne(cobrancas.status, 'cancelada')` (importar `ne` de drizzle-orm). Fica: `and(eq(cobrancas.contratoId, contratoId), ne(cobrancas.status, 'cancelada'))`.
2. `gerarCobrancasMensais`: mesma troca — `and(inArray(cobrancas.contratoId, vigentes...), ne(cobrancas.status, 'cancelada'))`.
3. Atualizar os comentários: a competência é considerada coberta por QUALQUER cobrança do contrato (manual ou automática); cancelada não cobre (o mês volta a ser gerado).
4. Nota no comentário de `gerarCobrancaDoMes`: o `onConflictDoNothing` do índice único parcial (só automáticas) continua como segunda trava para o fluxo automático — a trava primária agora é a consulta acima.

Testes (Vitest): a lógica de decisão vive em `competenciasPendentes` (pura, já testada) — o bug era a LISTA passada. Adicionar em `src/lib/cobrancas/regras.test.ts` um bloco de regressão nomeado (ex.: "competência coberta por cobrança manual — regressão da duplicata de 2026-07") exercendo `competenciasPendentes` com a competência atual presente na lista `competenciasJaGeradas` (simulando que a query agora inclui a manual) → retorna `[]`; e o caso da cancelada ausente da lista → competência volta como pendente. Documentar no teste que a query em gerar.ts alimenta essa lista com TODAS as cobranças não canceladas.

Rodar a suíte de cobranças: `npx vitest run src/lib/cobrancas`.
  </action>
  <verify>
    <automated>cd C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr && npx vitest run src/lib/cobrancas && npx tsc --noEmit</automated>
  </verify>
  <done>Nenhuma ocorrência de `eq(cobrancas.criadoVia, 'automatico')` nas consultas de competências geradas; testes de regressão passando junto com a suíte existente.</done>
</task>

<task type="auto">
  <name>Task 3: Cancelar a duplicata real no Asaas sandbox e no banco</name>
  <files>src/lib/asaas/client.ts, scripts/cancelar-cobranca-duplicada.ts</files>
  <action>
1. Em `src/lib/asaas/client.ts`: ampliar `requisicao` para aceitar `method: 'GET' | 'POST' | 'DELETE'` e adicionar:

```ts
/** Cancela/remove uma cobrança no Asaas — DELETE /payments/{id}. */
export async function cancelarCobranca(paymentId: string): Promise<void> {
  await requisicao(`/payments/${paymentId}`, { method: 'DELETE' })
}
```

(A resposta do DELETE é `{ deleted: true, id }` — não precisa validar shape além do status ok que `requisicao` já checa.)

2. Criar `scripts/cancelar-cobranca-duplicada.ts` (script pontual, pt-BR), padrão dos `scripts/aplicar-migration-*.ts`:
   - Conexão: `postgres(process.env.DIRECT_URL!, { max: 1 })` — NÃO importar `@/lib/db` (evita pool do app); usar SQL direto.
   - Constantes: `COBRANCA_ID = 'cba003b1-eddb-48c2-a05e-be6989510ea9'`, `PAYMENT_ID = 'pay_alt9pinbxw0rlwaq'`.
   - Passos: (a) SELECT da cobrança e imprimir status atual/competência/cliente (abortar com aviso se já `cancelada`); (b) chamar `cancelarCobranca(PAYMENT_ID)` importando de `../src/lib/asaas/client` (path relativo — script roda com tsx; se o alias `@/` não resolver via tsx, usar relativo); tratar erro do Asaas: se responder que o pagamento já está removido/cancelado, apenas avisar e seguir; (c) `UPDATE cobrancas SET status='cancelada', updated_at=now() WHERE id=...`; (d) SELECT final imprimindo o status para confirmação; (e) `sql.end()`.
   - IMPORTANTE: garantir que `ASAAS_ENV` do .env.local NÃO é 'production' antes de chamar (imprimir a baseUrl usada); abortar se for production.

3. EXECUTAR de fato: `npx tsx --env-file=.env.local scripts/cancelar-cobranca-duplicada.ts` (tsx não carrega .env.local sozinho — decisão registrada). Colar a saída no SUMMARY.

4. Verificar no banco depois (o próprio passo (d) do script cumpre isso): status = 'cancelada'.
  </action>
  <verify>
    <automated>cd C:/Users/jacso/OneDrive/Documentos/projeto_agencia_jsr && npx tsx --env-file=.env.local -e "import postgres from 'postgres'; const sql = postgres(process.env.DIRECT_URL!, { max: 1 }); const r = await sql`select status, asaas_payment_id from cobrancas where id = 'cba003b1-eddb-48c2-a05e-be6989510ea9'`; console.log(r); await sql.end(); if (r[0]?.status !== 'cancelada') process.exit(1)"</automated>
  </verify>
  <done>Payment pay_alt9pinbxw0rlwaq cancelado no Asaas sandbox (saída do script sem erro) e cobrança cba003b1 com status 'cancelada' confirmado por SELECT no banco real.</done>
</task>

</tasks>

<verification>
- `npx vitest run src/lib/cobrancas` verde (regressão da duplicata incluída).
- `npx tsc --noEmit` limpo.
- Nenhum `eq(cobrancas.criadoVia, 'automatico')` restante nas consultas de competências de gerar.ts.
- SELECT no banco confirma status 'cancelada' na cobrança duplicada.
- /agenda: "+x mais" abre Popover, itens abrem edição; visual ok em light e dark.
</verification>

<success_criteria>
- Chip "+x mais" funcional com lista completa clicável; calendário visualmente refinado com dark mode correto.
- Cron/primeira cobrança nunca mais duplicam competência já coberta por cobrança manual; competência cancelada é regerada.
- Duplicata real cancelada no Asaas sandbox e no banco (verificado por consulta).
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260717-dyb-agenda-x-mais-e-visual-do-calendario-fix/260717-dyb-SUMMARY.md` (incluir a saída do script de cancelamento).
</output>

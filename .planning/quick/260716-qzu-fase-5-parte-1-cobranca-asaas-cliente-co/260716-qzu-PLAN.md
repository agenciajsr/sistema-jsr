---
phase: quick-260716-qzu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - drizzle/0032_cobrancas_asaas.sql
  - scripts/aplicar-migration-0032.ts
  - src/lib/db/schema.ts
  - src/lib/asaas/client.ts
  - src/lib/cobrancas/regras.ts
  - src/lib/cobrancas/regras.test.ts
  - src/lib/cobrancas/gerar.ts
  - src/lib/cobrancas/dados.ts
  - src/lib/contratos/assinatura.ts
  - src/app/api/cron/sync-meta/route.ts
  - src/app/api/webhooks/asaas/route.ts
  - src/app/actions/cobrancas.ts
  - src/app/(app)/clientes/[id]/page.tsx
  - src/app/(app)/contratos/tabela-contratos.tsx
autonomous: true
requirements: [COBRANCA-ASAAS-P1]
user_setup:
  - service: asaas
    why: "Emissão de cobranças (PIX/boleto)"
    env_vars:
      - name: ASAAS_API_KEY
        source: "Painel Asaas Sandbox -> Integrações -> Chave de API"
      - name: ASAAS_ENV
        source: "Definir 'sandbox' (depois 'production')"
      - name: ASAAS_WEBHOOK_TOKEN
        source: "Valor inventado pelo usuário, configurado no webhook do painel Asaas (authToken) e no .env"
    dashboard_config:
      - task: "Criar webhook apontando para /api/webhooks/asaas com authToken"
        location: "Painel Asaas -> Integrações -> Webhooks"

must_haves:
  truths:
    - "Contrato assinado (webhook Autentique ou botão manual) dispara cadastro do cliente no Asaas e criação da 1ª cobrança, sem quebrar a ativação se o Asaas falhar/env ausente"
    - "Enquanto o contrato estiver ativo, a cobrança do mês é gerada automaticamente (carona no cron sync-meta), sem duplicar mês"
    - "Webhook do Asaas atualiza status da fatura (paga/vencida) no nosso banco"
    - "Botão 'Confirmar recebimento (PIX manual)' marca a fatura como paga sem Asaas; se existir no Asaas, chama receivedInCash"
    - "Ficha do cliente tem aba/seção Faturas com status pt-BR e link invoiceUrl"
    - "Botão manual 'Gerar cobrança no Asaas' disponível na tela de contratos/cliente"
  artifacts:
    - path: "drizzle/0032_cobrancas_asaas.sql"
      provides: "Tabela cobrancas + coluna clientes.asaas_customer_id (aditiva, NÃO aplicada)"
    - path: "src/lib/asaas/client.ts"
      provides: "Cliente REST Asaas com Zod na borda e degradação graciosa sem env"
    - path: "src/lib/cobrancas/regras.ts"
      provides: "Módulo puro (competência do mês, vencimento por diaPagamento, elegibilidade) sob TDD"
    - path: "src/app/api/webhooks/asaas/route.ts"
      provides: "Webhook com verificação do header asaas-access-token"
  key_links:
    - from: "src/lib/contratos/assinatura.ts"
      to: "src/lib/cobrancas/gerar.ts"
      via: "confirmarAssinatura chama gerar 1ª cobrança em try/catch"
      pattern: "gerarCobranca|primeiraCobranca"
    - from: "src/app/api/cron/sync-meta/route.ts"
      to: "src/lib/cobrancas/gerar.ts"
      via: "etapa extra do cron (carona) gera cobranças do mês"
      pattern: "gerarCobrancasMensais"
    - from: "src/app/api/webhooks/asaas/route.ts"
      to: "tabela cobrancas"
      via: "update de status por asaas_payment_id"
      pattern: "asaasPaymentId"
---

<objective>
Fase 5 Parte 1 — Cobrança via Asaas (sandbox primeiro). Fatura é fonte da verdade no NOSSO banco (tabela nova `cobrancas`); Asaas é um meio de quitação, não o único. Fluxo automático no gatilho de assinatura + geração mensal por carona no cron existente + webhook de status + confirmação manual de PIX + UI de faturas.

Purpose: substituir a cobrança manual dispersa; primeira fatura paga confirma o cliente como ativo.
Output: migration 0032 (gerada, NÃO aplicada), lib Asaas, engine pura testada, webhook, actions e UI pt-BR.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/db/schema.ts
@src/lib/contratos/assinatura.ts
@src/app/api/webhooks/autentique/route.ts
@src/app/api/cron/sync-meta/route.ts
@src/lib/financeiro/calculos.ts
@scripts/aplicar-migration-0031.ts

<interfaces>
From src/lib/contratos/assinatura.ts:
```typescript
export async function confirmarAssinatura(contratoId: string, clienteId: string): Promise<void>
// hoje: update contratos (statusFluxo='assinado', assinadoEm) + update clientes (status='ativo'), sequencial, idempotente
```

From src/lib/db/schema.ts (relevante):
```typescript
clientes: { id uuid, nome, status, contatoEmail, contatoTelefone, tipoPessoa, documento, usaAsaas boolean default false, formaPagamento, diaPagamento integer, ... }
contratos: { id uuid, clienteId, dataInicio date, dataVencimento date, valorMensal numeric, statusFluxo text ('aguardando_dados'|'dados_recebidos'|'aguardando_assinatura'|'assinado'), assinadoEm, ... }
transacoes: { tipo 'receita'|'despesa', clienteId, valor numeric, data date, status ('pendente'|'pago'|...), ... } // financeiro existente
```

Decisões travadas (D-01..D-06):
- D-01: cobrança AVULSA mês a mês controlada por nós — NUNCA POST /v3/subscriptions.
- D-02: billingType 'UNDEFINED' (cliente escolhe PIX/boleto).
- D-03: gatilho automático em confirmarAssinatura + botão manual.
- D-04: pagamento manual (PIX na chave do dono) é caso de primeira classe; nossa tabela é a fonte da verdade.
- D-05: sandbox primeiro — base https://api-sandbox.asaas.com/v3 quando ASAAS_ENV!=='production', senão https://api.asaas.com/v3; auth header `access_token`. Sem ASAAS_API_KEY: degradar graciosamente (aviso pt-BR, nunca crash, nunca bloquear assinatura).
- D-06: UI 100% pt-BR, dark variants.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fundação — migration 0032, schema Drizzle, cliente Asaas (Zod) e regras puras de cobrança</name>
  <files>drizzle/0032_cobrancas_asaas.sql, scripts/aplicar-migration-0032.ts, src/lib/db/schema.ts, src/lib/asaas/client.ts, src/lib/cobrancas/regras.ts, src/lib/cobrancas/regras.test.ts</files>
  <behavior>
    Testes do módulo puro src/lib/cobrancas/regras.ts (Vitest, zero import de db/react):
    - competenciaDe(date) → 'YYYY-MM' em fuso BR.
    - dataVencimento(competencia, diaPagamento|null, dataInicioContrato) → diaPagamento grampeado ao último dia do mês (31→28 em fev); sem diaPagamento usa o dia de dataInicio; nunca retorna data no passado quando gerada no próprio mês (mínimo = hoje+3 dias? NÃO — mínimo = hoje, sem inventar carência).
    - contratoElegivel(contrato, hoje) → true só se statusFluxo==='assinado' E hoje entre dataInicio e dataVencimento (contrato vigente).
    - competenciasPendentes(contrato, competenciasJaGeradas, hoje) → lista de competências de max(mês da assinatura, mês de dataInicio) até o mês atual que ainda não têm cobrança (permite recuperar meses perdidos se o cron falhar), respeitando dataVencimento do contrato.
  </behavior>
  <action>
    1. Migration `drizzle/0032_cobrancas_asaas.sql` (ADITIVA, numerada após 0031, separadores `--> statement-breakpoint`):
       - `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS asaas_customer_id text;`
       - `CREATE TABLE IF NOT EXISTS cobrancas (id uuid pk default gen_random_uuid(), cliente_id uuid NOT NULL references clientes(id) on delete cascade, contrato_id uuid references contratos(id) on delete set null, competencia text NOT NULL, valor numeric(10,2) NOT NULL, status text NOT NULL default 'pendente', vencimento date NOT NULL, asaas_payment_id text unique, invoice_url text, forma_quitacao text, pago_em timestamptz, criado_via text NOT NULL default 'automatico', created_at timestamptz NOT NULL default now(), updated_at timestamptz NOT NULL default now());`
       - índice único parcial `cobrancas_contrato_competencia_uniq` em (contrato_id, competencia) WHERE criado_via='automatico' — impede duplicar o mês no fluxo automático sem travar cobranças manuais extras. Status é text (não enum): 'pendente'|'paga'|'vencida'|'cancelada'. forma_quitacao: 'asaas'|'pix_manual'|null.
       - Tabela NOVA de propósito (não reusar `transacoes`): transacoes é o livro-caixa do financeiro com semântica própria (recorrência, centro de custo); cobranças têm ciclo Asaas próprio. NÃO integrar com transacoes nesta parte — deixar comentário no schema apontando integração futura.
    2. `scripts/aplicar-migration-0032.ts` copiando o padrão exato de `scripts/aplicar-migration-0031.ts` (DIRECT_URL, sql.begin(), split por statement-breakpoint). NÃO EXECUTAR o script — o orquestrador aplica depois (memória do projeto: nunca drizzle-kit migrate, nunca aplicar durante execução).
    3. Schema Drizzle: adicionar `asaasCustomerId` em clientes, tabela `cobrancas` + relations (cliente/contrato), export dos tipos.
    4. `src/lib/asaas/client.ts` (módulo server, NÃO 'use server'):
       - `asaasDisponivel(): boolean` (ASAAS_API_KEY presente); base URL por ASAAS_ENV (D-05); todas as chamadas com header `access_token` e `Content-Type: application/json`.
       - `criarCliente({nome, cpfCnpj, email?, telefone?}) → {id}`; `criarCobranca({customer, value, dueDate, description, externalReference}) → {id, invoiceUrl, status}` com `billingType: 'UNDEFINED'` (D-02); `confirmarRecebimentoEmDinheiro(paymentId, {value, paymentDate})` → POST /v3/payments/{id}/receivedInCash.
       - TODAS as respostas validadas com Zod na borda (schemas mínimos: id, invoiceUrl/status quando aplicável; `.passthrough()`); erro do Asaas vira Error com mensagem pt-BR incluindo `errors[0].description` quando existir. Timeout via AbortSignal.timeout(15000).
    5. Regras puras conforme <behavior>, sob TDD (RED→GREEN por função). Reusar helpers de fuso BR existentes em src/lib/date-br.ts se servirem.
  </action>
  <verify>
    <automated>npx vitest run src/lib/cobrancas/regras.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>Migration 0032 gerada (não aplicada), schema atualizado, client Asaas com Zod e degradação sem env, regras puras com testes passando.</done>
</task>

<task type="auto">
  <name>Task 2: Fluxos — gatilho na assinatura, geração mensal por carona no cron, webhook do Asaas e actions (manual + PIX manual)</name>
  <files>src/lib/cobrancas/gerar.ts, src/lib/cobrancas/dados.ts, src/lib/contratos/assinatura.ts, src/app/api/cron/sync-meta/route.ts, src/app/api/webhooks/asaas/route.ts, src/app/actions/cobrancas.ts</files>
  <action>
    1. `src/lib/cobrancas/gerar.ts` (módulo server comum, NÃO 'use server' — memória: exports de 'use server' viram endpoints):
       - `garantirClienteAsaas(clienteId)`: se clientes.asaasCustomerId nulo e asaasDisponivel(), POST /v3/customers com nome + documento (cpfCnpj) do cliente (ou de contratos.dadosContratante como fallback) e salva o id. Sem documento → lança erro pt-BR claro (Asaas exige cpfCnpj). Idempotente.
       - `gerarCobrancaDoMes(contrato, competencia, {criadoVia})`: insere linha em cobrancas (status 'pendente', valor = contrato.valorMensal, vencimento via regras) com onConflictDoNothing no índice único; depois, se asaasDisponivel(), cria payment no Asaas (externalReference = cobranca.id, description "Mensalidade {competencia} — {nome}") e faz update com asaasPaymentId + invoiceUrl. Falha do Asaas NÃO desfaz a linha local (D-04 — nossa tabela é a verdade; fica pendente sem link, retry no próximo cron só se sem asaasPaymentId... simplificar: log warn, botão manual cobre).
       - `gerarPrimeiraCobranca(contratoId)` e `gerarCobrancasMensais()` (varre contratos elegíveis via contratoElegivel + competenciasPendentes, queries SEQUENCIAIS — pool max=3, nunca Promise.all).
    2. `confirmarAssinatura`: após ativar o cliente, chamar `gerarPrimeiraCobranca` dentro de try/catch com console.warn pt-BR — falha de cobrança NUNCA bloqueia a ativação (D-05). Sem env Asaas, a linha local é criada mesmo assim.
    3. Carona no cron: em `src/app/api/cron/sync-meta/route.ts`, após a avaliação de alertas, chamar `gerarCobrancasMensais()` em try/catch, agregando resumo `{cobrancasGeradas}` na resposta. NÃO criar cron novo (Hobby: 2 slots ocupados). Também marcar como 'vencida' as cobrancas 'pendente' com vencimento < hoje E sem asaasPaymentId (as com Asaas quem marca é o webhook).
    4. `src/app/api/webhooks/asaas/route.ts` (Route Handler POST, runtime nodejs):
       - Verificação de token: comparar header `asaas-access-token` com env ASAAS_WEBHOOK_TOKEN (timingSafeEqual); env ausente → warn e segue (padrão soft do webhook Autentique); header divergente COM env presente → 401.
       - Payload validado com Zod: `{event: string, payment: {id, status, paymentDate?, invoiceUrl?}}` (.passthrough()).
       - Eventos: PAYMENT_RECEIVED/PAYMENT_CONFIRMED → status 'paga', pagoEm, formaQuitacao 'asaas'; PAYMENT_OVERDUE → 'vencida' (só se ainda não 'paga'); PAYMENT_DELETED/REFUNDED → 'cancelada'. Match por asaasPaymentId; não encontrado → 200 com ok:false (não fazer o Asaas re-tentar para sempre). Sempre responder 200 rápido.
       - Ao marcar 'paga': se o cliente ainda não estiver 'ativo', ativar (primeira fatura paga confirma ativação — idempotente, dois updates sequenciais).
    5. `src/app/actions/cobrancas.ts` ('use server', todas com checagem de sessão via padrão existente das actions do projeto):
       - `gerarCobrancaManual(contratoId)`: garantirClienteAsaas + gerarCobrancaDoMes(competência atual, criadoVia 'manual'). Retorna {ok, erro?} pt-BR.
       - `confirmarRecebimentoManual(cobrancaId)`: marca 'paga' + pagoEm=now + formaQuitacao 'pix_manual'; se asaasPaymentId existir e asaasDisponivel(), chamar receivedInCash em try/catch (falha vira aviso retornado, não desfaz a quitação local — D-04); ativa o cliente se necessário.
       - `getCobrancasDoCliente(clienteId)` em `src/lib/cobrancas/dados.ts` (fonte da aba Faturas, ordenada por vencimento desc).
       - revalidatePath nas telas afetadas.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <done>Assinatura gera 1ª cobrança (tolerante a falha), cron gera meses pendentes sem duplicar, webhook atualiza status com token verificado, PIX manual quita localmente + receivedInCash quando aplicável, primeira paga ativa o cliente.</done>
</task>

<task type="auto">
  <name>Task 3: UI — aba Faturas na ficha do cliente e botão "Gerar cobrança no Asaas" em contratos</name>
  <files>src/app/(app)/clientes/[id]/page.tsx, src/app/(app)/contratos/tabela-contratos.tsx</files>
  <action>
    1. Ficha do cliente (`src/app/(app)/clientes/[id]/page.tsx`, 26KB — investigar como as abas/seções existentes são montadas e SEGUIR o mesmo padrão; extrair a lista para um client component novo ao lado, ex. `faturas-cliente.tsx`, se a página for Server Component):
       - Seção/aba "Faturas": tabela com Competência, Valor (R$ pt-BR), Vencimento (dd/mm/aaaa), Status como badge pt-BR com variantes dark (pendente=âmbar, paga=verde, vencida=vermelho, cancelada=cinza — badges pastel precisam de `dark:`), Origem (Automática/Manual), forma de quitação, e link "Ver fatura" (invoiceUrl, target _blank) quando existir.
       - Por linha pendente/vencida: botão "Confirmar recebimento (PIX manual)" chamando confirmarRecebimentoManual com useTransition + confirmação simples; exibir aviso retornado se receivedInCash falhar.
       - Estado vazio pt-BR: "Nenhuma fatura gerada ainda."
       - Se ASAAS_API_KEY ausente (passar flag do server), banner discreto: "Asaas não configurado — faturas são registradas apenas internamente."
    2. Tabela de contratos (`tabela-contratos.tsx` — client component existente com dialogs): adicionar ação "Gerar cobrança no Asaas" (menu/botão por linha, visível só para contratos com statusFluxo 'assinado') chamando gerarCobrancaManual, com toast/feedback pt-BR de sucesso ("Cobrança gerada — {invoiceUrl}" quando houver) e de erro (ex.: cliente sem CPF/CNPJ).
    3. 100% pt-BR (D-06), dark variants em tudo, nenhum dado falso.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>Aba Faturas funcional com status/link e quitação manual; botão manual de cobrança em /contratos; build limpo.</done>
</task>

</tasks>

<verification>
- `npx vitest run` verde (regras puras + suíte existente intacta, ~1500 testes).
- `npm run build` limpo.
- Migration 0032 existe, é aditiva e NÃO foi aplicada; script de aplicação segue o padrão 0031.
- Nenhum uso de /v3/subscriptions (D-01); billingType UNDEFINED (D-02); nenhuma chamada Asaas sem validação Zod; nenhum cron novo em vercel.json.
- Sem ASAAS_API_KEY nada quebra: assinatura ativa o cliente, cobrança local nasce sem link, UI mostra banner.
</verification>

<success_criteria>
Fluxo ponta a ponta pronto para o sandbox: assinar contrato → cliente no Asaas + 1ª fatura com invoiceUrl; cron gera o mês seguinte sem duplicar; webhook quita/vence faturas; PIX manual quita sem Asaas (e concilia via receivedInCash quando a fatura existe lá); tudo visível na aba Faturas em pt-BR.
</success_criteria>

<output>
After completion, create `.planning/quick/260716-qzu-fase-5-parte-1-cobranca-asaas-cliente-co/260716-qzu-SUMMARY.md`
</output>

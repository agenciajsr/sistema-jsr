# Phase 1: Fundação — Acesso, Clientes e Contratos - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega: acesso ao sistema (login multi-usuário da equipe da JSR) + cadastro/edição de clientes e contratos. É a base de dados sobre a qual todas as fases seguintes (integração de anúncios, alertas, financeiro, relatórios, painel geral) serão construídas.

Não inclui: integração com Meta Ads/Google Ads, alertas, cálculo de MRR/financeiro, relatórios automáticos (fases 2-6).

</domain>

<decisions>
## Implementation Decisions

### Papéis e Permissões
- **D-01:** Dois papéis: Admin e Membro (não é acesso único/flat).
- **D-02:** Apenas Admin pode criar novos usuários da equipe. Sem auto-cadastro aberto e sem fluxo de convite por email nesta fase (isso adiaria a fase por depender de envio de email — Resend é opcional/adiado no stack recomendado).
- **D-03:** Admin e Membro podem ambos criar/editar clientes e contratos. Exclusão de clientes/contratos é exclusiva do Admin (evita perda acidental de dados).

### Modelo de Dados: Cliente
- **D-04:** Cliente tem um campo de status explícito e manual: ativo, pausado, encerrado. Não é inferido automaticamente pela vigência do contrato — a equipe controla esse campo diretamente (ex: cliente pode estar pausado mesmo com contrato vigente).
- **D-05:** Campos do cliente nesta fase: nome, nicho/objetivo (e-commerce, negócio local, infoproduto), status (ativo/pausado/encerrado), contato responsável (nome + telefone/email), notas/observações livres (texto).

### Modelo de Dados: Contrato
- **D-06:** Contratos têm histórico — cada renovação cria um novo registro de contrato vinculado ao cliente, mantendo os anteriores. A UI deve sempre deixar claro qual é o contrato atual/vigente vs. histórico.
- **D-07:** O valor do contrato é sempre uma mensalidade recorrente (MRR) — não existe contrato de valor único/pontual nesta fase. Alinha diretamente com o cálculo de MRR previsto na Fase 4 (sem necessidade de filtrar por tipo de contrato).
- **D-08:** Campos do contrato: data de início, data de vencimento/renovação, valor mensal.

### Lista de Clientes (UI)
- **D-09:** Layout em cards (um card por cliente), não tabela — mais adequado para ~10 clientes e permite destacar visualmente status/alertas por card. Consistente com o "UI hint: yes" da fase e com fases futuras que também terão UI hint (3, 4, 6).
- **D-10:** Cada card mostra: status do cliente (badge visual), nicho/objetivo, valor do contrato atual (MRR), vigência do contrato (dias até vencer / data de vencimento).

### Claude's Discretion
- Fluxo exato de login (formulário, mensagens de erro, redirecionamentos) — usar padrões do Supabase Auth.
- Duração exata da sessão / comportamento de "permanecer logado" — usar o comportamento padrão do Supabase Auth (sessão persistente via cookie), sem exigir configuração adicional nesta fase.
- Layout exato do card (hierarquia visual, cores por status) — seguir padrões de shadcn/ui.
- Validações de formulário (obrigatoriedade de campos, formatos) para os campos de contato/notas — usar bom senso, campos de contato podem ser opcionais.
- Estrutura de tabelas no banco (nomes de colunas, tipos) — Drizzle ORM + Postgres conforme stack do projeto.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack e Padrões Técnicos
- `CLAUDE.md` — Stack recomendado (Next.js 16 App Router, Supabase Postgres+Auth, Drizzle ORM, Tailwind+shadcn/ui, Zod, React Hook Form). Fase 1 usa: Next.js, Supabase Auth, Drizzle ORM, Tailwind/shadcn/ui, Zod, React Hook Form.

### Requisitos e Roadmap
- `.planning/REQUIREMENTS.md` — Requisitos ACES-01 a ACES-03 (acesso) e CLI-01 a CLI-04 (clientes/contratos) que esta fase cobre.
- `.planning/ROADMAP.md` §Phase 1 — Critérios de sucesso e escopo desta fase.
- `.planning/PROJECT.md` — Contexto de negócio, constraints (escala inicial ~10 clientes, uso interno).

Não há ADRs ou specs externos além destes — requisitos e stack estão totalmente capturados nos documentos acima e nas decisões desta fase.

</canonical_refs>

<code_context>
## Existing Code Insights

Projeto greenfield — ainda não há código implementado (apenas `.planning/` e `CLAUDE.md`). Não há componentes, hooks ou padrões reutilizáveis ainda; esta fase estabelece as primeiras convenções do projeto (autenticação, schema de banco, estrutura de UI) que fases futuras vão seguir.

### Integration Points
- Autenticação via Supabase Auth será o ponto de integração para todas as fases futuras que exigem usuário logado.
- Schema de `clientes` e `contratos` (Drizzle) será referenciado por: Fase 2 (vincular contas de anúncio ao cliente), Fase 3 (painel de tráfego por cliente), Fase 4 (alertas de vencimento, MRR), Fase 5 (relatório por cliente), Fase 6 (painel geral).

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica fornecida — abordagem padrão do shadcn/ui é aceitável para cards e formulários.

</specifics>

<deferred>
## Deferred Ideas

- Fluxo de convite por email para novos usuários (ficou fora — só Admin cria usuário diretamente por enquanto). Pode ser revisitado se o time crescer e o cadastro manual virar fricção.
- Provisionamento de usuários não foi aprofundado além de "só Admin cria" — se surgir necessidade de autoatendimento (ex: recuperação de senha, troca de email), tratar em fase futura ou ajuste posterior.

None além disso — discussão ficou dentro do escopo da fase.

</deferred>

---

*Phase: 01-funda-o-acesso-clientes-e-contratos*
*Context gathered: 2026-07-10*

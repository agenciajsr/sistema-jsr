# Phase 1: Fundação — Acesso, Clientes e Contratos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 01-funda-o-acesso-clientes-e-contratos
**Areas discussed:** Papéis e permissões, Modelo de dados (cliente/contrato), Lista de clientes (visual)

---

## Papéis e Permissões

| Option | Description | Selected |
|--------|-------------|----------|
| Acesso único (sem papéis) | Todo usuário logado tem as mesmas permissões | |
| Admin vs Membro | Dois níveis: admin gerencia usuários/exclui dados, membro tem acesso operacional | ✓ |

**User's choice:** Admin vs Membro

---

| Option | Description | Selected |
|--------|-------------|----------|
| Só admin cria usuários | Admin cadastra novos membros diretamente, sem auto-cadastro | ✓ |
| Convite por email | Admin envia convite, usuário define a própria senha | |

**User's choice:** Só admin cria usuários

---

| Option | Description | Selected |
|--------|-------------|----------|
| Só gestão de usuários é admin-only | Clientes/contratos: qualquer usuário logado pode criar/editar/ver | |
| Admin também controla exclusão de clientes/contratos | Membro cria/edita, só admin exclui | ✓ |

**User's choice:** Admin também controla exclusão de clientes/contratos
**Notes:** Evita perda acidental de dados importantes.

---

## Modelo de Dados: Cliente e Contrato

| Option | Description | Selected |
|--------|-------------|----------|
| Histórico de contratos | Cada renovação cria novo registro, mantém anteriores | ✓ |
| Só o contrato atual | Registro único atualizado a cada renovação | |

**User's choice:** Histórico de contratos

---

| Option | Description | Selected |
|--------|-------------|----------|
| Campo de status explícito | Status manual (ativo/pausado/encerrado) controlado pela equipe | ✓ |
| Inferido pelo contrato | Status calculado automaticamente pela vigência do contrato | |

**User's choice:** Campo de status explícito

---

| Option | Description | Selected |
|--------|-------------|----------|
| Contato (responsável, telefone/email) | Ponto de contato do cliente | ✓ |
| Notas/observações livres | Campo de texto livre | ✓ |
| Nenhum extra por enquanto | Só nome, nicho e status | |

**User's choice:** Contato (responsável, telefone/email) + Notas/observações livres (múltipla escolha)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre mensalidade recorrente | Todo contrato é um valor mensal fixo (MRR) | ✓ |
| Recorrente ou pontual (campo de tipo) | Contrato indica se é recorrente ou projeto pontual | |

**User's choice:** Sempre mensalidade recorrente

---

## Lista de Clientes (Visual)

| Option | Description | Selected |
|--------|-------------|----------|
| Status do cliente (ativo/pausado/encerrado) | Badge visual do status | ✓ |
| Vigência do contrato (dias até vencer) | Data de vencimento ou contagem regressiva | ✓ |
| Valor do contrato (MRR) | Valor mensal do contrato ativo | ✓ |
| Nicho/objetivo | e-commerce, negócio local ou infoproduto | ✓ |

**User's choice:** Todas as quatro opções selecionadas (múltipla escolha)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela | Linhas com colunas fixas, densa, familiar tipo planilha | |
| Cards | Um card por cliente, visual mais leve, melhor pra poucos clientes | ✓ |

**User's choice:** Cards

---

## Claude's Discretion

- Fluxo exato de login (formulário, mensagens de erro) — padrões do Supabase Auth
- Duração de sessão / "permanecer logado" — comportamento padrão do Supabase Auth
- Layout exato do card (hierarquia visual, cores por status) — padrões shadcn/ui
- Validações de formulário para campos de contato/notas — campos de contato podem ser opcionais
- Estrutura de tabelas no banco — Drizzle ORM + Postgres conforme stack do projeto

## Deferred Ideas

- Fluxo de convite por email para novos usuários — fora de escopo nesta fase (só Admin cria diretamente); revisitar se o time crescer.
- Provisionamento avançado de usuários (recuperação de senha, troca de email) — não aprofundado, tratar em fase futura ou ajuste posterior.

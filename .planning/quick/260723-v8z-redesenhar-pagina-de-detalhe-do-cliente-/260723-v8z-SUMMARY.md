---
phase: quick-260723-v8z
type: summary
status: done
requirements: [QUICK-V8Z]
files_modified:
  - src/app/(app)/clientes/[id]/page.tsx
  - src/components/ficha/visao-geral-cliente.tsx
  - src/components/ficha/brand-logos.tsx
---

## Revisão v2 (feedback do usuário — copiar o mockup 100%)

Refação para fidelidade real ao `modelo_cliente_novo.png`:
- **Novo `brand-logos.tsx`**: SVG inline de Meta, Google Ads, Google Analytics e
  Instagram (lucide 1.24 não tem ícones de marca) nas cores oficiais.
- **Header**: avatar redondo; 4 colunas à direita — **Responsável agora é o
  GESTOR da JSR** (via `cliente.gestorId` → `profiles.nome`, com avatar), não o
  contato do cliente; + **Plano** (1º serviço contratado) + **Status** +
  **Cliente desde**. Botões "Editar cliente" + "Nova tarefa" no topo.
- **Notificações → aba "🔔 Alertas"** separada (com contador). Removida a pilha
  de alertas que ficava no topo.
- **Faixa de KPIs (StatCards) removida** — não existe no mockup.
- **Tab bar** agora `variant="line"` (underline), mais limpa.
- **Visão geral** reescrita com os 6 cards do mockup + rodapé: Dados de cadastro
  (com Tags de serviços), Observações (caixa destacada + responsável/atualização),
  Relacionamentos (gestor + colaboradores reais dos acompanhamentos), Acessos e
  contas (logos de marca + "Acessar" com deep links reais + "Ver todas
  integrações"), Atividades recentes, Pastas e documentos (Drive + docs reais),
  Próximas atividades, e Histórico do cliente.

Verificação v2: `tsc` limpo, **649/649** testes verdes, e a rota
`GET /clientes/[id]` servindo **HTTP 200** ao usuário logado (render real, dados
reais, sem erro de runtime).

Decisão preservada: as 9 abas funcionais NÃO viram as abas genéricas do mockup
(Informações/Relacionamentos/Arquivos) — isso esconderia funções reais. Mantidas
com o visual limpo do mockup.

---
### (v1 abaixo — histórico)

# SUMMARY — Redesenhar página de detalhe do cliente

## O que foi feito

Redesenho da ficha do cliente (`/clientes/[id]`) seguindo o mockup
`prints_aleatorios/modelo_cliente_novo.png`, em duas frentes:

### 1. Header rico em card (`page.tsx`)
- Barra superior (fora do card): `BotaoVoltar` + ações à direita
  ("Editar cliente", "Pasta do Drive" se `linkDrive`, "Excluir cliente"
  admin-only com a Server Action e copy exatas preservadas — D-03).
- Card do header: avatar quadrado `size-16` com iniciais (primeira letra da
  primeira e da última palavra), nome `text-2xl` + badge de status
  (STATUS_LABEL/STATUS_COLOR — D-10), nicho abaixo (NICHO_LABEL), e linha de
  contatos com ícones lucide mostrando SÓ campos preenchidos: telefone (Phone),
  email (Mail), instagram (AtSign — lucide 1.24 não tem mais o ícone de marca),
  cidade/estado (MapPin).
- À direita, colunas com divisores `border-l` (só em `lg`): "Cliente desde"
  (CalendarDays + createdAt), "Responsável" (contatoNome ?? '—'), "Status"
  (badge). Coluna "Plano" do mockup foi omitida de propósito — não existe no
  schema (nada de mock).
- `cliente.notas` saiu do header → foi para o card Observações da Visão geral.
- Faixa de alertas e grid de StatCards permanecem inalterados logo abaixo.

### 2. Aba "Visão geral" como default (`visao-geral-cliente.tsx` — novo)
Server Component puro (sem `'use client'`, sem queries próprias; tudo por props
reusando dados já carregados na page). Grid `lg:grid-cols-3` agrupado por coluna:
- **Col 1**: "Dados de cadastro" (linhas label/valor só com campos reais
  preenchidos: Segmento, Objetivo, Valor mensal do contrato, Verba, Ticket,
  Forma de pagamento/dia, Modo de cobrança, Como nos conheceu, Data de cadastro)
  + "Observações" (`notas` ou fallback).
- **Col 2**: "Acessos e contas" (uma linha por `contasDoCliente` com ícone,
  nome, plataforma·id e badge Meta/Google; linha "Pasta do Drive" com link
  "Acessar" se `linkDrive`; fallback "Nenhuma conta vinculada") + "Atividades
  recentes" (últimos 5 acompanhamentos, avatar + nota + autor·data).
- **Col 3**: "Próximas atividades" (até 5 tarefas abertas, título + subtítulo +
  data).
- **Rodapé** (full width): "Histórico do cliente" — marcos reais: "Cliente
  criado" (createdAt) + "Contrato iniciado" por contrato do histórico.

Na page: `<TabsTrigger value="visao-geral">🏠 Visão geral</TabsTrigger>` como
PRIMEIRA aba, `defaultValue` mudado de `"contrato"` para `"visao-geral"`, e novo
`<TabsContent value="visao-geral">`. As 9 abas existentes permanecem intactas
(10 triggers no total).

## Verificação
- `npx tsc --noEmit`: **sem erros**.
- `npx vitest run` (suíte inteira): **649/649 passando** (45 arquivos) — zero regressão.
- Estrutural: `defaultValue="visao-geral"` presente; 10 `<TabsTrigger>`;
  `<VisaoGeralCliente>` renderizado; nenhum literal mock no componente novo.
- Verificação visual no navegador: pendente (subir dev server via `!npx next dev`
  na sessão do usuário — o hook RTK intercepta `next dev` neste ambiente).

## Decisões / desvios do plano
- Ícones de marca (Instagram/Facebook/Chrome) NÃO existem em lucide-react 1.24 →
  usado `AtSign` para o handle do Instagram e `Megaphone` genérico + rótulo
  textual "Meta"/"Google" para contas de anúncio (honesto, sem logo falso).
- Contas de anúncio não têm URL de acesso no schema → não foi inventado link
  "Acessar" para elas (só a Pasta do Drive, que tem URL real, ganhou o link).
- Coluna "Plano" do mockup omitida (não há campo correspondente no schema).

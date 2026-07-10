---
phase: 1
slug: funda-o-acesso-clientes-e-contratos
status: draft
shadcn_initialized: false
preset: "new-york / neutral / cssVariables:true / lucide-react (a inicializar na Wave 0 da execução via `npx shadcn init`)"
created: 2026-07-10
---

# Phase 1 — UI Design Contract

> Contrato visual e de interação para as fases de frontend. Gerado por gsd-ui-researcher, verificado por gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (projeto greenfield — `components.json` ainda não existe; inicialização faz parte da Wave 0 desta fase, conforme 01-RESEARCH.md) |
| Preset | Estilo **New York**, cor base **Neutral**, variáveis CSS ativadas (`cssVariables: true`) |
| Component library | Radix UI (via primitivos do shadcn/ui) |
| Icon library | lucide-react (padrão do shadcn/ui) |
| Font | Geist (padrão de `create-next-app` / `next/font`) |

Confirmado com o usuário nesta sessão: preset aprovado sem alterações.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Espaço entre ícone e texto (ex: ícone de badge, ícone de botão) |
| sm | 8px | Espaçamento compacto entre elementos (ex: linhas de metadado no card) |
| md | 16px | Espaçamento padrão entre elementos (ex: padding interno de card, gap entre campos de formulário) |
| lg | 24px | Padding de seção (ex: padding do card do cliente, padding do formulário) |
| xl | 32px | Gaps de layout (ex: gap entre cards na grid de clientes) |
| 2xl | 48px | Quebras de seção maiores (ex: entre cabeçalho da página e conteúdo) |
| 3xl | 64px | Espaçamento de nível de página (ex: margem vertical da tela de login) |

Exceptions: alvo de toque mínimo de **44px** para botões somente-ícone (ex: ícones de editar/excluir no card do cliente), mesmo em contexto majoritariamente desktop — mantém acessibilidade e paridade com uso mobile ocasional.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label | 12px | 600 (semibold) | 1.4 |
| Body | 14px | 400 (regular) | 1.5 |
| Heading | 20px | 600 (semibold) | 1.2 |
| Display | 28px | 600 (semibold) | 1.2 |

Uso:
- **Label** (12px/600): texto de badge de status, rótulos de campo de formulário, metadados pequenos (ex: "Contato responsável").
- **Body** (14px/400): texto padrão de card, valores de formulário, texto de corpo em geral.
- **Heading** (20px/600): título de seção (ex: "Clientes Ativos"), nome do cliente no card.
- **Display** (28px/600): título de página (ex: "Clientes", "Login").

Apenas 4 tamanhos e 2 pesos declarados — não introduzir tamanhos/pesos intermediários.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` | Fundo de página (light mode) |
| Secondary (30%) | `#F4F4F5` | Cards de cliente, sidebar/nav, cabeçalho do app; borda associada `#E4E4E7` |
| Accent (10%) | `#1E76C4` | ver "Accent reservado para" abaixo |
| Destructive | `#DC2626` | Ações destrutivas apenas (excluir cliente/contrato) |

Accent reservado para: **botão primário** (ex: "Cadastrar Cliente", "Salvar", "Registrar Contrato"), **item de navegação ativo** (indicador/fundo), **anel de foco (focus ring)** em inputs, **links/texto interativo em destaque**. Nunca aplicar a badges de status, texto de corpo comum ou a todos os elementos interativos indiscriminadamente.

### Nota sobre cor de marca (ajuste de contraste)

O usuário forneceu a cor de marca da JSR a partir da logo: gradiente do logomark entre `#1657D6` (azul profundo) e `#26C2EA` (ciano), e o texto "AGÊNCIA" em azul sólido `#2489D9`.

- `#2489D9` (azul de marca "puro") tem contraste de **3.71:1** com texto branco — **falha** o mínimo AA para texto normal (4.5:1), mas **passa** o mínimo AA para texto grande/elementos gráficos (3:1, WCAG 1.4.11).
- Por isso, para o **accent funcional dos componentes shadcn** (fundo de botão primário com texto branco pequeno, foco de input), foi usado um tom escurecido: **`#1E76C4`**, contraste de **4.73:1** com texto branco — passa AA para texto normal.
- `#2489D9` permanece disponível como token de marca (ver abaixo), mas não deve ser usado como fundo de botão/componente com texto branco pequeno.

### Brand Tokens (não-funcionais — uso pontual, fora de componentes shadcn)

| Token | Value | Usage |
|-------|-------|-------|
| Marca gradiente (início) | `#1657D6` | Logo/hero da tela de login, cabeçalho de marca do app |
| Marca gradiente (fim) | `#26C2EA` | Logo/hero da tela de login, cabeçalho de marca do app |
| Marca sólida | `#2489D9` | Texto grande (≥18px semibold ou ≥24px regular), ícones e bordas decorativas de marca — nunca como fundo de botão com texto pequeno |

Esses três tokens **não substituem** o Accent funcional (`#1E76C4`) em nenhum componente shadcn (Button, Input focus, Badge, etc.) — são reservados a elementos de marca (logo, header, tela de login).

### Status Badge Colors (específico de D-10 — badge de status no card do cliente)

| Status | Value | Usage |
|--------|-------|-------|
| Ativo | `#16A34A` (verde-600) | Badge "Ativo" no card do cliente |
| Pausado | `#D97706` (âmbar-600) | Badge "Pausado" no card do cliente |
| Encerrado | `#71717A` (zinc-500) | Badge "Encerrado" no card do cliente |

Nota de escopo: nesta fase, a data de vencimento do contrato exibida no card (D-10, "vigência do contrato") é **texto neutro sem cor de alerta** (ex: "Vencimento: 15/08/2026" / "Faltam 20 dias" em cor secundária/texto padrão). Badges/cores de alerta de verba ou vencimento próximo são escopo da Fase 3 (ALRT) e Fase 4 (ALRT-03/04) — não implementar lógica de alerta visual nesta fase.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Cadastrar Cliente" (lista de clientes, abre formulário: nome + nicho + status + primeiro contrato) |
| Empty state heading | "Nenhum cliente cadastrado ainda" |
| Empty state body | "Cadastre seu primeiro cliente para começar a acompanhar contratos e status." + botão "Cadastrar Cliente" |
| Error state | Login: "Não foi possível entrar. Verifique seu email e senha e tente novamente." / Formulário (cliente/contrato): "Não foi possível salvar. Verifique os dados e tente novamente." |
| Destructive confirmation | Ver detalhamento abaixo (excluir cliente / excluir contrato) |

### Confirmação de exclusão (AlertDialog simples — aprovado pelo usuário, sem exigir digitar o nome)

**Excluir cliente** (apenas Admin, D-03):
- Título: "Excluir cliente"
- Corpo: "Esta ação não pode ser desfeita. O cliente e todo o histórico de contratos vinculados serão removidos permanentemente. Deseja continuar?"
- Botões: "Cancelar" (padrão) / "Excluir cliente" (variante destructive, `#DC2626`)

**Excluir contrato** (apenas Admin, D-03):
- Título: "Excluir contrato"
- Corpo: "Esta ação não pode ser desfeita. Este registro de contrato será removido permanentemente do histórico. Deseja continuar?"
- Botões: "Cancelar" (padrão) / "Excluir contrato" (variante destructive, `#DC2626`)

### Copy adicional necessária nesta fase

- Login — rótulos: "Email", "Senha"; botão: "Entrar"
- CTAs secundários de formulário: "Salvar Cliente", "Registrar Contrato" (renovação insere novo registro, D-06)
- Distinção contrato atual vs. histórico (D-06): badge/rótulo "Contrato Atual" no card/tela de detalhe; seção "Histórico de Contratos" para registros anteriores
- Criação de usuário (Admin-only, fora do fluxo de auto-cadastro — D-02): se o executor optar por uma tela em vez de apenas o script `seed-admin.ts` (ver Open Question do 01-RESEARCH.md), usar CTA "Adicionar Usuário" e campos "Nome", "Email", "Senha temporária", "Papel" (Admin/Membro)
- Recuperação de senha (esqueci minha senha): **fora de escopo desta fase** — não faz parte de ACES-01/02/03 nem foi decidido em CONTEXT.md; não implementar tela/copy para isso agora

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|--------------|
| shadcn official | `button`, `input`, `label`, `textarea`, `select`, `form`, `card`, `badge`, `alert-dialog`, `dropdown-menu`, `sonner` (toast de sucesso/erro) | not required |
| (nenhum registry de terceiros) | — | não aplicável — nenhum bloco de terceiro necessário para o escopo desta fase (formulários e cards padrão cobertos integralmente pelo registry oficial do shadcn) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

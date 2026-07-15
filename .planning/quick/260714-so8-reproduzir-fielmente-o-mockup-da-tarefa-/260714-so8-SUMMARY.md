# SUMMARY — quick-260714-so8: reproduzir fielmente o mockup da tela de tarefas

## 1. Migration 0017 — ✅ APLICADA NO BANCO

**A migration `drizzle/0017_happy_famine.sql` foi GERADA e APLICADA com sucesso** (via
`DIRECT_URL` + script descartável, uma única tentativa; script removido em seguida).
Nenhuma ação manual do usuário é necessária.

- 100% aditiva: **zero DROP**.
- Cria `tarefa_comentarios`, `tarefa_anexos`, `tarefa_atividades` + coluna `tarefas.fixada`
  (D-08) + 3 índices.
- Por D-10, mesmo que a tabela não existisse o detalhe abriria com as abas vazias em vez
  de quebrar — mas **está aplicada**, então tudo funciona de imediato.

## 2. Fidelidade ao mockup (critério #1) — checklist

- [x] **Barra de estatísticas colada no rodapé** da viewport em `/tarefas`: `sticky bottom-0`
      dentro de container `flex` com `min-h-[calc(100svh-7rem)]` e área do meio `flex-1`
      (D-01, as duas metades). Fica no rodapé com 1 tarefa E com muitas; o quadro rola atrás
      (backdrop-blur). Sempre renderizada (com 0 tarefas mostra zeros).
- [x] **Topo do detalhe**: ← Voltar, breadcrumb "Tarefas / Detalhes da Tarefa", botão
      outline "Compartilhar", botão-ícone de link, "..." (menu Recorrência/Encerrar/Excluir),
      e o primário "Marcar como concluída".
- [x] **Card principal**: badge do código (`TAR-0001`) + botão copiar; à direita pin (fixa
      a tarefa — D-08), link. Título grande editável inline; descrição em `line-clamp-2`.
- [x] **Grade de 8 células COM BORDA e DIVISÓRIAS** (`divide-x divide-y ... border`): Status,
      Responsável, Prioridade, Etiquetas / Data de início, Prazo, Tempo estimado, Projeto /
      Cliente. Cada célula = label pequeno em cima + valor/controle sem cara de input
      (SelectTrigger/Input sem borda, chevron do Radix preservado). Ícones do mockup:
      CalendarDays, Clock, Building2, ArrowUp (prioridade alta/urgente), Play (Em Andamento),
      Avatar (responsável).
- [x] **5 abas underline** (`Detalhes`, `Checklists`, `Anexos`, `Comentários`, `Atividade`)
      com contador REAL (só aparece quando > 0), ativa sublinhada em azul
      (`data-[state=active]:border-primary`). Abas controladas (D-12) — os "Ver tudo" dos
      cards laterais trocam de aba.
- [x] **Comentários REAIS**: escreve, aparece com autor e "há X"; "..." → Excluir só para o
      autor (a action recusa terceiros — só o autor ou admin).
- [x] **Anexos REAIS**: upload para o bucket `documentos` (prefixo `tarefas/{id}/`), ícone
      colorido por tipo (planilha verde / PDF vermelho / apresentação laranja / imagem e doc
      azul), "Tipo • Tamanho", download (URL assinada) e excluir. Card lateral mostra os 4
      primeiros + "Ver todos anexos".
- [x] **Atividade REAL**: cada mutação grava uma linha (criou, alterou o status/prioridade/…,
      comentou, anexou, removeu arquivo, concluiu/reabriu item). Card "Atividade Recente"
      mostra as 5 últimas com "há X"; aba Atividade mostra o histórico completo.
- [x] **Notas com toolbar REAL** (D-06): 7 botões (B, I, U, lista, lista numerada, checkbox,
      link) que inserem marcadores markdown na posição do cursor via `aplicarMarcacao` (função
      pura, testada). Rodapé com estado de "Salvo …" e "Mostrar tudo" (expande as linhas).
- [x] **/tarefas/nova como página cheia** com a MESMA estrutura do detalhe (título grande,
      grade de 8 células idêntica, 5 abas, card Notas). As 3 abas que dependem de uma tarefa
      salva ficam **desabilitadas com o aviso "Disponível após salvar a tarefa"** (D-05) —
      aba desabilitada é honesta, não é botão morto. Recorrência preservada. **O sheet lateral
      (`nova-tarefa-sheet.tsx`) foi DELETADO**, sem referência órfã.
- [x] **"Nova Tarefa" e "+ Adicionar tarefa"** viram Links para `/tarefas/nova`; o "+" da
      coluna **pré-seleciona o status daquela coluna** (`?status=…&data=…`).
- [x] **Dark mode**: só tokens existentes (`primary`, `destructive`, `chart-success`,
      `chart-warning`, `muted-foreground`, `border`, `card`, `muted`). **Zero cor hardcoded**
      (grep de `#`/`rgb`/`bg-[#` limpo nas 3 telas). Teste da função pura garante que a classe
      do ícone de anexo nunca contém cor literal.

## 3. Desvios do plano (com motivo)

- **`textoAtividade` para status usa `STATUS_LABEL` ("Concluída")**, não a forma "Concluidas"
  citada no plano. Motivo: o próprio plano dizia "(via STATUS_LABEL)", e STATUS_LABEL é o
  rótulo correto e consistente com o resto da UI; "Concluidas" era o rótulo de COLUNA, uma
  imprecisão do texto do plano. O teste fixa `STATUS_LABEL`.
- **`CardHeader` precisou de `flex` (não `flex-row`)**: o default do `CardHeader` é `grid`, e
  `flex-row` sozinho (grupo flex-direction) não sobrescreve `grid` no `twMerge`. Troquei por
  `flex items-center justify-between space-y-0` nos 6 cabeçalhos (detalhe + lateral + nova),
  senão os títulos e as ações ficariam empilhados em grid em vez de lado a lado.
- **Detalhe mantém uma aba "Checklists" além da seção Checklists dentro de "Detalhes"**: o
  mockup lista as 5 abas com contador; a aba dedicada dá o atalho direto com o número, e a
  seção em Detalhes segue o mockup (Descrição + Checklists juntos). Ambas usam a mesma lógica.
- **Botão "Marcar como concluída" é primário/azul** (antes era verde). O mockup pede o botão
  AZUL/primário — alinhado ao mockup.
- **Verificação no navegador não foi executada**: o app é fechado por autenticação (Supabase)
  e não há como logar nesta sessão (inserir senha é proibido). A validação foi por
  `npm run build` + `npx tsc --noEmit` + `npm run lint` + `npm test`, todos verdes, além dos
  gates de grep de cada task. A fidelidade visual (acima) foi conferida contra o código.

## 4. Verificação automatizada — tudo verde

| Gate | Resultado |
|---|---|
| `npm test` | 1138 testes passando (88 arquivos) — inclui os novos de `tempoRelativo`, `formatarTamanho`, `tipoDeArquivo`, `textoAtividade`, `aplicarMarcacao` |
| `npx tsc --noEmit` | 0 erros |
| `npm run lint` | exit 0; zero erro/aviso NOVO nos arquivos tocados (baseline do repo à parte) |
| `npm run build` | Compilou; `/tarefas`, `/tarefas/[id]` e `/tarefas/nova` dinâmicas |
| `recorrencia.ts` vs master | diff VAZIO (engine intocada) |
| `Promise.all` em tarefas | zero (inclusive comentários) |
| `DROP` na 0017 | 0 |
| `quadro.ts` puro | sem import de db/react/next |
| temp files | nenhum (`.apply-0017.tmp.mjs` e `.probe-db.tmp.mjs` removidos) |

## 5. Commits

1. `test(quick-260714-so8)`: testes RED dos derivados
2. `feat(quick-260714-so8)`: migration 0017 (APLICADA) + derivados puros + actions
3. `feat(quick-260714-so8)`: /tarefas/[id] fiel ao mockup + barra de stats colada no rodapé
4. `feat(quick-260714-so8)`: /tarefas/nova página cheia + remoção do sheet lateral

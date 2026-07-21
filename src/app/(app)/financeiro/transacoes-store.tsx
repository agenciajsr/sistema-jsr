'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

// Store de contexto da lista de transações do mês exibido.
//
// POR QUE EXISTE (debug 260721-financeiro-freeze-save-despesa): salvar/editar/
// excluir uma transação chamava router.refresh(), que re-executa o Server
// Component /financeiro INTEIRO (~14 queries render-blocking, embrulhadas por
// withRetry). Sob um soluço do pooler, o withRetry abandona as SELECTs da 1ª
// tentativa; a maior (listTransacoes) fica pendurada em ClientRead segurando
// lock = a conexão zumbi que derrubava a página e travava até migrations.
//
// A cura é o mesmo padrão do excluir-aquisição (commit 1e84e67): a mutação já
// persistiu no banco; a UI reflete a mudança LOCALMENTE (sem recarregar a
// página pesada). Os KPIs/analítica recalculam no próximo carregamento real
// (troca de mês, F5, navegação) — tradeoff aceito e idêntico ao 1e84e67.
//
// O provider é keyed por mês/ano na página, então trocar de mês remonta o
// store com os dados frescos do servidor (ver page.tsx).

export type TransacaoRow = {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  clienteId?: string | null
  clienteNome: string | null
  descricao: string
  valor: string
  data: string
  status: 'pago' | 'pendente' | 'vencido'
  diaVencto?: number | null
  notas?: string | null
  centroCusto?: string | null
  recorrencia?: string | null
  formaPagamento?: string | null
  responsavelId?: string | null
  responsavelNome?: string | null
  comprovanteUrl?: string | null
}

type TransacoesStore = {
  transacoes: TransacaoRow[]
  /** Adiciona (se cair no mês exibido) uma transação recém-criada. */
  adicionar: (t: TransacaoRow) => void
  /** Substitui uma transação editada; remove da visão se saiu do mês exibido. */
  atualizar: (t: TransacaoRow) => void
  /** Remove uma transação excluída. */
  remover: (id: string) => void
}

const Ctx = createContext<TransacoesStore | null>(null)

/** Mesma ordenação do servidor (`order by data desc`). */
function ordenar(lista: TransacaoRow[]): TransacaoRow[] {
  return [...lista].sort((a, b) => b.data.localeCompare(a.data))
}

export function TransacoesProvider({
  initial,
  mes,
  ano,
  children,
}: {
  initial: TransacaoRow[]
  mes: number
  ano: number
  children: ReactNode
}) {
  const [transacoes, setTransacoes] = useState<TransacaoRow[]>(() => ordenar(initial))

  // Uma transação pertence ao mês exibido? (data = 'YYYY-MM-DD')
  const noMesExibido = (data: string) =>
    Number(data.slice(0, 4)) === ano && Number(data.slice(5, 7)) === mes

  const adicionar = (t: TransacaoRow) => {
    if (!noMesExibido(t.data)) return // salva no banco, mas é de outro mês
    setTransacoes((prev) => ordenar([t, ...prev.filter((x) => x.id !== t.id)]))
  }

  const atualizar = (t: TransacaoRow) => {
    setTransacoes((prev) => {
      const semItem = prev.filter((x) => x.id !== t.id)
      return noMesExibido(t.data) ? ordenar([t, ...semItem]) : semItem
    })
  }

  const remover = (id: string) => {
    setTransacoes((prev) => prev.filter((x) => x.id !== id))
  }

  return (
    <Ctx.Provider value={{ transacoes, adicionar, atualizar, remover }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTransacoesStore(): TransacoesStore {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error('useTransacoesStore precisa estar dentro de <TransacoesProvider>.')
  }
  return ctx
}

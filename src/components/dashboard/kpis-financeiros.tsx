'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, HandCoins, TrendingUp, Wallet } from 'lucide-react'

import { KpiCard } from '@/components/dashboard/kpi-card'

const CHAVE_STORAGE = 'jsr:valores-visiveis'
const MASCARA = 'R$ ••••••'

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Props = {
  mrr: number
  receitaMes: number
  percentRecebido: number
  lucroMes: number
}

// KPIs financeiros do Painel (Faturamento, Recebimentos, Lucro) com "olho" de
// privacidade: por padrão os valores ficam OCULTOS (para apresentar a tela sem
// expor os números); clicar no olho revela. A escolha é lembrada no navegador.
export function KpisFinanceiros({ mrr, receitaMes, percentRecebido, lucroMes }: Props) {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    setVisivel(localStorage.getItem(CHAVE_STORAGE) === '1')
  }, [])

  function alternar() {
    setVisivel((atual) => {
      const novo = !atual
      localStorage.setItem(CHAVE_STORAGE, novo ? '1' : '0')
      return novo
    })
  }

  const v = (valor: number) => (visivel ? formatador.format(valor) : MASCARA)

  return (
    <>
      <div className="relative">
        <KpiCard label="Faturamento (MRR)" valor={v(mrr)} icon={Wallet} cor="info" />
        <button
          type="button"
          onClick={alternar}
          aria-label={visivel ? 'Ocultar valores' : 'Mostrar valores'}
          title={visivel ? 'Ocultar valores' : 'Mostrar valores'}
          className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {visivel ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
      </div>

      <KpiCard
        label="Recebimentos (Mês)"
        valor={v(receitaMes)}
        icon={HandCoins}
        cor="success"
        helper={`${percentRecebido}% do MRR`}
        progresso={percentRecebido}
      />

      <KpiCard label="Lucro Líquido (Mês)" valor={v(lucroMes)} icon={TrendingUp} cor="purple" />
    </>
  )
}

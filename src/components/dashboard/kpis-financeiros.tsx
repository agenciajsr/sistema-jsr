'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, HandCoins, TrendingUp, Wallet } from 'lucide-react'

import { KpiCard } from '@/components/dashboard/kpi-card'
import type { Tendencia } from '@/lib/mock/dashboard-ref'

const CHAVE_STORAGE = 'jsr:valores-visiveis'
const MASCARA = 'R$ ••••'

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Props = {
  mrr: number
  receitaMes: number
  percentRecebido: number
  lucroMes: number
  tendencias?: { mrr?: Tendencia; receita?: Tendencia; lucro?: Tendencia }
  series?: { mrr?: number[]; lucro?: number[] }
}

// KPIs financeiros do Painel (Faturamento, Recebimentos, Lucro) com "olho" de
// privacidade: por padrão os valores ficam OCULTOS (para apresentar a tela sem
// expor os números); clicar no olho revela. A escolha é lembrada no navegador.
// O botão vive no slot `acao` do KpiCard — ao lado do ícone, nunca por cima —
// e os 3 cards são filhos diretos do grid (altura uniforme com os demais).
// Tendências (%) e sparklines seguem visíveis com valores ocultos: mostram
// direção, não os números absolutos.
export function KpisFinanceiros({
  mrr,
  receitaMes,
  percentRecebido,
  lucroMes,
  tendencias,
  series,
}: Props) {
  const [visivel, setVisivel] = useState(false)

  // Timeout 0: evita setState síncrono no effect (regra react-hooks).
  useEffect(() => {
    const t = setTimeout(() => {
      setVisivel(localStorage.getItem(CHAVE_STORAGE) === '1')
    }, 0)
    return () => clearTimeout(t)
  }, [])

  function alternar() {
    setVisivel((atual) => {
      const novo = !atual
      localStorage.setItem(CHAVE_STORAGE, novo ? '1' : '0')
      return novo
    })
  }

  const v = (valor: number) => (visivel ? formatador.format(valor) : MASCARA)

  const botaoOlho = (
    <button
      type="button"
      onClick={alternar}
      aria-label={visivel ? 'Ocultar valores' : 'Mostrar valores'}
      title={visivel ? 'Ocultar valores' : 'Mostrar valores'}
      className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {visivel ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
    </button>
  )

  return (
    <>
      <KpiCard
        label="Faturamento (MRR)"
        valor={v(mrr)}
        icon={Wallet}
        cor="info"
        tendencia={tendencias?.mrr}
        serie={series?.mrr}
        acao={botaoOlho}
      />

      <KpiCard
        label="Recebimentos (Mês)"
        valor={v(receitaMes)}
        icon={HandCoins}
        cor="success"
        tendencia={tendencias?.receita}
        helper={`${percentRecebido}% do MRR`}
        progresso={percentRecebido}
      />

      <KpiCard
        label="Lucro Líquido (Mês)"
        valor={v(lucroMes)}
        icon={TrendingUp}
        cor="purple"
        tendencia={tendencias?.lucro}
        serie={series?.lucro}
      />
    </>
  )
}

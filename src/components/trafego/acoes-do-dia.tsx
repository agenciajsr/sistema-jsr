'use client'

// Painel "Ações do dia" (Feature 3): o sistema recomenda o que fazer hoje —
// Cortar / Escalar / Renovar criativo. SOMENTE recomendação (nada é executado
// na Meta). "Marcar como feito" esconde o card localmente (localStorage) até a
// condição disparar de novo em outro dia.

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, ImageOff, Scissors, Sparkles, TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { AcaoDoDia, TipoAcao } from '@/lib/trafego/acoes-dia'

const TIPO_CONFIG: Record<TipoAcao, { label: string; icone: React.ComponentType<{ className?: string }>; classes: string }> = {
  cortar: { label: 'Cortar', icone: Scissors, classes: 'text-destructive' },
  escalar: { label: 'Escalar', icone: TrendingUp, classes: 'text-chart-success' },
  renovar: { label: 'Renovar criativo', icone: Sparkles, classes: 'text-chart-warning' },
}

type AcoesDoDiaProps = {
  clienteId: string
  acoes: AcaoDoDia[]
}

export function AcoesDoDia({ clienteId, acoes }: AcoesDoDiaProps) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const storageKey = `acoes-feitas:${clienteId}:${hoje}`
  const [feitas, setFeitas] = useState<Set<string>>(new Set())
  const [aba, setAba] = useState<TipoAcao>('cortar')

  // localStorage só existe no cliente: carregar no effect evita mismatch de
  // hidratação (o SSR renderiza sem nada marcado). setState aqui é proposital.
  useEffect(() => {
    let salvas: string[] = []
    try {
      salvas = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]
    } catch {
      salvas = []
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização com armazenamento externo (localStorage)
    setFeitas(new Set(salvas))
  }, [storageKey])

  function marcarFeita(chave: string) {
    setFeitas((atual) => {
      const novo = new Set(atual)
      novo.add(chave)
      try {
        localStorage.setItem(storageKey, JSON.stringify([...novo]))
      } catch {
        // sem localStorage (SSR/privado) — só o estado da sessão
      }
      return novo
    })
  }

  const visiveis = useMemo(() => acoes.filter((a) => !feitas.has(a.chave)), [acoes, feitas])
  const porTipo: Record<TipoAcao, AcaoDoDia[]> = {
    cortar: visiveis.filter((a) => a.tipo === 'cortar'),
    escalar: visiveis.filter((a) => a.tipo === 'escalar'),
    renovar: visiveis.filter((a) => a.tipo === 'renovar'),
  }

  // Aba exibida: a escolhida, ou a primeira com conteúdo (derivado, sem efeito).
  const abaEfetiva: TipoAcao =
    porTipo[aba].length > 0
      ? aba
      : ((['cortar', 'escalar', 'renovar'] as TipoAcao[]).find((t) => porTipo[t].length > 0) ?? aba)

  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Ações do dia</CardTitle>
        {visiveis.length > 0 && (
          <Tabs value={abaEfetiva} onValueChange={(v) => setAba(v as TipoAcao)}>
            <TabsList>
              {(['cortar', 'escalar', 'renovar'] as TipoAcao[]).map((t) => (
                <TabsTrigger key={t} value={t} className="gap-1.5">
                  {TIPO_CONFIG[t].label}
                  <Badge variant="outline" className="px-1.5 text-[11px]">{porTipo[t].length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </CardHeader>
      <CardContent>
        {visiveis.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-muted-foreground">
            <Check className="size-4 text-chart-success" />
            Nenhuma ação necessária hoje — conta saudável ✓
          </div>
        ) : porTipo[abaEfetiva].length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nada em “{TIPO_CONFIG[abaEfetiva].label}” hoje.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {porTipo[abaEfetiva].map((acao) => {
              const conf = TIPO_CONFIG[acao.tipo]
              const Icone = conf.icone
              return (
                <div
                  key={acao.chave}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3"
                >
                  <div className="flex items-center gap-2">
                    {acao.entidade === 'anuncio' &&
                      (acao.thumbnailUrl ? (
                        <Image
                          src={acao.thumbnailUrl}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="size-8 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          <ImageOff className="size-4 text-muted-foreground/60" />
                        </span>
                      ))}
                    <Icone className={cn('size-4 shrink-0', conf.classes)} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" title={acao.nome}>
                      {acao.nome}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{acao.motivo}</p>
                  <p className="text-xs">{acao.recomendacao}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-auto h-7 self-start text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => marcarFeita(acao.chave)}
                  >
                    <Check className="size-3.5" />
                    Marcar como feito
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { PlugZap, CheckCircle2, Building2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { testarConexaoGoogleAds } from '@/actions/google-ads'
import type { ContaGoogleAds } from '@/lib/google/ads-client'

// Botão "Testar conexão" do Google Ads: chama a MCC e mostra as contas
// encontradas — prova visível de que token + OAuth + MCC funcionam.
export function TestarGoogleAds() {
  const [isPending, startTransition] = useTransition()
  const [contas, setContas] = useState<ContaGoogleAds[] | null>(null)

  function testar() {
    startTransition(async () => {
      const r = await testarConexaoGoogleAds()
      if ('error' in r) {
        setContas(null)
        toast.error(r.error)
        return
      }
      setContas(r.contas)
      const anuncio = r.contas.filter((c) => !c.gerenciadora).length
      toast.success(`Conexão OK — ${anuncio} conta(s) de anúncio na MCC.`)
    })
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={testar} disabled={isPending}>
        <PlugZap className="size-3.5" />
        {isPending ? 'Testando…' : 'Testar conexão'}
      </Button>

      {contas && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="mb-1.5 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-4 text-chart-success" />
            {contas.length} conta(s) na MCC
          </p>
          <ul className="space-y-1">
            {contas.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" />
                <span className="font-medium text-foreground">{c.nome || '(sem nome)'}</span>
                <span>· {c.id}</span>
                {c.gerenciadora ? (
                  <span className="rounded bg-muted px-1 text-[10px]">gerenciadora</span>
                ) : (
                  <span className="rounded bg-chart-success/10 px-1 text-[10px] text-chart-success">
                    conta de anúncio
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

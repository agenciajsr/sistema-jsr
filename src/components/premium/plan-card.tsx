import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

type PlanCardProps = {
  nome: string
  vence: string
  percentUtilizado: number
}

// Card "Plano Atual" do rodapé da sidebar. Oculta os detalhes quando a sidebar
// está colapsada no modo ícone (mesmo padrão do restante do shell).
export function PlanCard({ nome, vence, percentUtilizado }: PlanCardProps) {
  return (
    <div className="rounded-xl bg-[image:var(--gradient-surface)] p-3 ring-1 ring-inset ring-border group-data-[collapsible=icon]:hidden">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{nome}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          PRO
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Vence em {vence}</p>
      <Progress value={percentUtilizado} className="mt-2 h-1.5" />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {percentUtilizado}% utilizado
      </p>
      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
        <Link href="/financeiro">Ver plano</Link>
      </Button>
    </div>
  )
}

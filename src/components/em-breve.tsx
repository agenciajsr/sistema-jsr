import { Card, CardContent } from '@/components/ui/card'

type EmBreveProps = {
  titulo: string
  descricao: string
  icon: React.ComponentType<{ className?: string }>
}

// Placeholder premium para rotas ainda não implementadas. Mantém a linguagem
// visual do resto do sistema (card + ícone em círculo da marca).
export function EmBreve({ titulo, descricao, icon: Icon }: EmBreveProps) {
  return (
    <Card className="border-none shadow-[var(--shadow-sm)]">
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <Icon className="size-7" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-tight">{titulo}</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Em breve.</span> {descricao}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

import { Info } from 'lucide-react'

// Aviso visível em telas que ainda exibem dados de exemplo, não conectadas a
// nenhuma integração real. Deve ser removido quando a fase correspondente do
// roadmap (ver .planning/ROADMAP.md) implementar os dados reais desta tela.
export function MockNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-2 rounded-md border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

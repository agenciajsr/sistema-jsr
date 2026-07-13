import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MockNotice } from '@/components/mock-notice'
import { funilMock } from '@/lib/mock/extra'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 25

export default function FunilPage() {
  const maximo = Math.max(...funilMock.map((etapa) => etapa.quantidade))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Funil</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline simples de novas oportunidades.
        </p>
      </div>

      <MockNotice>
        Esta tela usa dados de exemplo (FUN-01, adicionado ao escopo em
        2026-07-10 — reverte uma exclusão original do projeto). Nenhuma
        oportunidade real está cadastrada ainda.
      </MockNotice>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Etapas do Funil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {funilMock.map((etapa, index) => {
            const largura = Math.max(20, Math.round((etapa.quantidade / maximo) * 100))
            const opacidade = 1 - index * 0.15
            return (
              <div key={etapa.etapa} className="flex items-center gap-4">
                <div className="w-40 shrink-0 text-sm font-medium">{etapa.etapa}</div>
                <div className="flex-1">
                  <div
                    className="flex h-10 items-center justify-end rounded-md px-3 text-sm font-semibold text-primary-foreground"
                    style={{
                      width: `${largura}%`,
                      backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(opacidade * 100)}%, transparent)`,
                    }}
                  >
                    {etapa.quantidade}
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

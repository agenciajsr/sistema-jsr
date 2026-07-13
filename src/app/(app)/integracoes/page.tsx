import Link from 'next/link'
import { CalendarDays, CheckCircle2, Plug } from 'lucide-react'

import { EmBreve } from '@/components/em-breve'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCredentials } from '@/lib/google/credentials'
import { desconectarGoogle } from '@/actions/integracoes-google'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

// Mensagens de feedback vindas do callback OAuth (via searchParams).
const MENSAGENS_ERRO: Record<string, string> = {
  acesso_negado: 'Você cancelou ou negou o acesso à conta Google.',
  state_invalido: 'A sessão de conexão expirou ou é inválida. Tente conectar novamente.',
  falha_conexao: 'Não foi possível concluir a conexão com o Google. Tente novamente.',
}

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; erro?: string }>
}) {
  const sp = await searchParams
  const cred = await getCredentials().catch(() => null)
  const conectado = cred !== null

  const mensagemErro = sp.erro ? MENSAGENS_ERRO[sp.erro] : undefined
  const mensagemSucesso = sp.conectado === '1' ? 'Conta Google conectada com sucesso.' : undefined

  // Wrapper compatível com <form action> (precisa retornar void).
  async function desconectarAction() {
    'use server'
    await desconectarGoogle()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>

      {mensagemSucesso && (
        <div className="rounded-lg border border-chart-success/30 bg-chart-success/10 px-4 py-3 text-sm text-chart-success">
          {mensagemSucesso}
        </div>
      )}
      {mensagemErro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {mensagemErro}
        </div>
      )}

      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">Google Agenda</CardTitle>
            <p className="text-sm text-muted-foreground">
              Veja e crie compromissos direto no sistema.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {conectado ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-chart-success" />
                {cred?.email ? (
                  <span>
                    Conectado como <span className="font-medium">{cred.email}</span>
                  </span>
                ) : (
                  <span>Conta Google conectada</span>
                )}
              </p>
              <form action={desconectarAction}>
                <Button type="submit" variant="outline" size="sm">
                  Desconectar
                </Button>
              </form>
            </div>
          ) : (
            <Button asChild>
              <Link href="/api/integrations/google/start">Conectar Google Agenda</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <EmBreve
        titulo="Outras integrações"
        descricao="A conexão com Meta Ads, Google Ads e demais serviços externos será configurada nesta área."
        icon={Plug}
      />
    </div>
  )
}

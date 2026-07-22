import Link from 'next/link'
import {
  CalendarDays,
  CheckCircle2,
  FileSignature,
  Megaphone,
  MessageCircle,
  Wallet,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCredentials } from '@/lib/google/credentials'
import { getAdsCredentials } from '@/lib/google/ads-credentials'
import { desconectarGoogle, desconectarGoogleAds } from '@/actions/integracoes-google'
import { asaasDisponivel } from '@/lib/asaas/client'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

// Serviços externos do hub (fora o Google, que tem card próprio com OAuth).
// `conectado` = presença de credencial no ambiente — status real, sem chute.
const SERVICOS = [
  {
    nome: 'Meta Ads',
    descricao: 'Sincroniza campanhas, verbas e resultados dos clientes.',
    icon: Megaphone,
    conectado: () => Boolean(process.env.META_SYSTEM_USER_TOKEN),
    href: '/campanhas',
    acao: 'Ver campanhas',
    badge: undefined as (() => string) | undefined,
  },
  {
    nome: 'Asaas (cobrança)',
    descricao: 'Gera cobranças, recebe pagamentos e baixa faturas via webhook.',
    icon: Wallet,
    conectado: () => asaasDisponivel(),
    href: '/financeiro',
    acao: 'Ver financeiro',
    badge: () => (process.env.ASAAS_ENV === 'production' ? 'Produção' : 'Sandbox'),
  },
  {
    nome: 'Autentique (assinatura)',
    descricao: 'Envia contratos para assinatura digital e recebe o retorno.',
    icon: FileSignature,
    conectado: () =>
      Boolean(process.env.AUTENTIQUE_API_TOKEN || process.env.AUTENTIQUE_API_KEY),
    href: '/contratos',
    acao: 'Ver contratos',
    badge: undefined,
  },
  {
    nome: 'Captação de leads (webhook)',
    descricao: 'Landing page, Meta Lead Ads (Make) e extensão de WhatsApp caindo no CRM.',
    icon: MessageCircle,
    conectado: () => Boolean(process.env.CRM_LEADS_TOKEN),
    href: '/ferramentas',
    acao: 'Ver automações',
    badge: undefined,
  },
]

// Mensagens de feedback vindas do callback OAuth (via searchParams).
const MENSAGENS_ERRO: Record<string, string> = {
  acesso_negado: 'Você cancelou ou negou o acesso à conta Google.',
  state_invalido: 'A sessão de conexão expirou ou é inválida. Tente conectar novamente.',
  falha_conexao: 'Não foi possível concluir a conexão com o Google. Tente novamente.',
}

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    conectado?: string
    erro?: string
    ads_conectado?: string
    ads_erro?: string
  }>
}) {
  const sp = await searchParams
  const cred = await getCredentials().catch(() => null)
  const conectado = cred !== null
  const adsCred = await getAdsCredentials().catch(() => null)
  const adsConectado = adsCred !== null
  // Env necessários para o SYNC do Google Ads (Parte 2) — a conexão OAuth já
  // funciona sem eles, mas o sync precisa do developer token + ID da MCC.
  const adsEnvOk = Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)

  const mensagemErro = sp.erro
    ? MENSAGENS_ERRO[sp.erro]
    : sp.ads_erro
      ? MENSAGENS_ERRO[sp.ads_erro]
      : undefined
  const mensagemSucesso =
    sp.conectado === '1'
      ? 'Conta Google conectada com sucesso.'
      : sp.ads_conectado === '1'
        ? 'Google Ads conectado com sucesso.'
        : undefined

  // Wrappers compatíveis com <form action> (precisam retornar void).
  async function desconectarAction() {
    'use server'
    await desconectarGoogle()
  }
  async function desconectarAdsAction() {
    'use server'
    await desconectarGoogleAds()
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

      {/* Google Ads — conexão OAuth PRÓPRIA (escopo adwords), separada da Agenda. */}
      <Card className="border-none shadow-[var(--shadow-sm)]">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Megaphone className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">Google Ads</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sincroniza campanhas e resultados das contas de Google Ads dos clientes (via MCC da agência).
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {adsConectado ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-chart-success" />
                {adsCred?.email ? (
                  <span>
                    Conectado como <span className="font-medium">{adsCred.email}</span>
                  </span>
                ) : (
                  <span>Google Ads conectado</span>
                )}
              </p>
              <form action={desconectarAdsAction}>
                <Button type="submit" variant="outline" size="sm">
                  Desconectar
                </Button>
              </form>
            </div>
          ) : (
            <Button asChild>
              <Link href="/api/integrations/google-ads/start">Conectar Google Ads</Link>
            </Button>
          )}
          {/* Aviso do que falta para o SYNC (Parte 2) funcionar. */}
          {!adsEnvOk && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <XCircle className="size-3.5 text-chart-orange" />
              Para o sync das campanhas, faltam as variáveis GOOGLE_ADS_DEVELOPER_TOKEN e GOOGLE_ADS_LOGIN_CUSTOMER_ID.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hub de conexões: status REAL de cada serviço externo (presença de
          credencial), com atalho para a área onde a integração é usada. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SERVICOS.map((s) => {
          const ok = s.conectado()
          return (
            <Card key={s.nome} className="border-none shadow-[var(--shadow-sm)]">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {s.nome}
                    {s.badge && (
                      <Badge variant="outline" className="text-[10px]">
                        {s.badge()}
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{s.descricao}</p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm">
                  {ok ? (
                    <>
                      <CheckCircle2 className="size-4 text-chart-success" /> Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4 text-muted-foreground" /> Não configurado
                    </>
                  )}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={s.href}>{s.acao}</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

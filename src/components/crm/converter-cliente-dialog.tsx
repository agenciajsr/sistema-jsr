'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Check, Copy, Link2, Phone, Trophy, User } from 'lucide-react'
import { toast } from 'sonner'

import { converterOportunidadeEmCliente } from '@/actions/crm'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ServicosChecklist,
  paraServicosContratados,
  validarChecklist,
  type ItemChecklist,
} from '@/components/contratos/servicos-checklist'
import type { OportunidadeCard } from '@/lib/crm/dados'

// Fase 3 do funil — Ganho → Cliente. Abre DEPOIS do ganho confirmado no
// kanban: converter é uma OFERTA, nunca uma condição ("Agora não" mantém o
// negócio ganho). A action é idempotente — se o lead já virou cliente antes,
// só vincula e avisa "Este lead já é cliente."
//
// Fase 4 Parte 1: a conversão agora coleta duração (3/6 meses), serviço e
// mensalidade, cria o contrato 'aguardando_dados' e mostra o link público
// /contrato/[token] com botão copiar no estado de SUCESSO do próprio dialog.
//
// quick-260716-ky2: o serviço único + mensalidade digitada viraram um
// CHECKLIST de serviços com valor individual (plataformas no Tráfego Pago);
// o total do contrato é a SOMA — calculado, nunca digitado.

const conversaoSchema = z.object({
  duracaoMeses: z.union([z.literal(3), z.literal(6)]),
  // quick-260716-sr5: modo de cobrança do cliente. Default seguro manual_pix
  // (manual nunca gera taxa no Asaas).
  modoCobranca: z.enum(['automatico_asaas', 'manual_pix']),
})

const MODOS_COBRANCA = [
  { valor: 'automatico_asaas', rotulo: 'Automático via Asaas (boleto/link)' },
  { valor: 'manual_pix', rotulo: 'Manual via PIX (direto na chave)' },
] as const

type ConversaoForm = z.infer<typeof conversaoSchema>

/** Formata o telefone só-dígitos para leitura ((62) 99999-0000). */
function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digitos
}

type Sucesso = { clienteId: string; contratoToken: string | null }

export function ConverterClienteDialog({
  oportunidade,
  onOpenChange,
}: {
  oportunidade: OportunidadeCard | null
  onOpenChange: (aberta: boolean) => void
}) {
  const router = useRouter()
  const [convertendo, startTransition] = useTransition()
  const [sucesso, setSucesso] = useState<Sucesso | null>(null)
  const [copiado, setCopiado] = useState(false)

  const [itens, setItens] = useState<ItemChecklist[]>([])
  const [erroServicos, setErroServicos] = useState<string | null>(null)

  const form = useForm<ConversaoForm>({
    resolver: zodResolver(conversaoSchema),
    defaultValues: { duracaoMeses: 3, modoCobranca: 'manual_pix' },
  })
  const duracao = form.watch('duracaoMeses')
  const modoCobranca = form.watch('modoCobranca')

  function fechar(aberta: boolean) {
    if (!aberta) {
      setSucesso(null)
      setCopiado(false)
      setItens([])
      setErroServicos(null)
      form.reset()
    }
    onOpenChange(aberta)
  }

  function converter(valores: ConversaoForm) {
    if (!oportunidade) return
    const erro = validarChecklist(itens)
    setErroServicos(erro)
    if (erro) return
    startTransition(async () => {
      const result = await converterOportunidadeEmCliente(oportunidade.id, {
        duracaoMeses: valores.duracaoMeses,
        servicos: paraServicosContratados(itens),
        modoCobranca: valores.modoCobranca,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if ('data' in result && result.data) {
        const { clienteId, jaExistia, contratoToken } = result.data
        toast.success(jaExistia ? 'Este lead já é cliente.' : 'Cliente criado — aguardando início.')
        setSucesso({ clienteId, contratoToken: contratoToken ?? null })
        router.refresh()
      }
    })
  }

  async function copiarLink(token: string) {
    const link = `${window.location.origin}/contrato/${token}`
    await navigator.clipboard.writeText(link)
    setCopiado(true)
    toast.success('Link copiado')
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Dialog open={oportunidade !== null} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-md">
        {sucesso ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-emerald-600 dark:text-emerald-400" />
                Cliente convertido!
              </DialogTitle>
              <DialogDescription>
                {sucesso.contratoToken
                  ? 'Contrato criado aguardando os dados do contratante. Envie o link abaixo para o cliente preencher no celular.'
                  : 'Cliente criado. O contrato não pôde ser gerado agora — cadastre pelo painel de contratos.'}
              </DialogDescription>
            </DialogHeader>

            {sucesso.contratoToken && (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Link2 className="size-3.5" />
                  Link de coleta de dados
                </p>
                <p className="break-all text-sm tabular-nums">
                  {`${window.location.origin}/contrato/${sucesso.contratoToken}`}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => copiarLink(sucesso.contratoToken!)}
                >
                  {copiado ? (
                    <>
                      <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copiar link
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => fechar(false)}>
                Fechar
              </Button>
              <Button type="button" onClick={() => router.push(`/clientes/${sucesso.clienteId}`)}>
                Abrir ficha
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-emerald-600 dark:text-emerald-400" />
                Negócio ganho! Converter em cliente?
              </DialogTitle>
              <DialogDescription>
                Cria a ficha do cliente com status <span className="font-medium">Aguardando início</span> e
                gera o contrato com link para o cliente preencher os dados. Você pode recusar — o negócio
                continua ganho do mesmo jeito.
              </DialogDescription>
            </DialogHeader>

            {oportunidade && (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dados que serão usados
                </p>
                {oportunidade.contatoNome && (
                  <p className="flex items-center gap-2">
                    <User className="size-3.5 shrink-0 text-muted-foreground" />
                    {oportunidade.contatoNome}
                  </p>
                )}
                {oportunidade.empresaNome && (
                  <p className="flex items-center gap-2">
                    <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                    {oportunidade.empresaNome}
                  </p>
                )}
                {oportunidade.telefoneNormalizado && (
                  <p className="flex items-center gap-2 tabular-nums">
                    <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                    {formatarTelefone(oportunidade.telefoneNormalizado)}
                  </p>
                )}
              </div>
            )}

            <form onSubmit={form.handleSubmit(converter)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Duração do contrato</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([3, 6] as const).map((meses) => (
                    <Button
                      key={meses}
                      type="button"
                      variant={duracao === meses ? 'default' : 'outline'}
                      onClick={() => form.setValue('duracaoMeses', meses, { shouldValidate: true })}
                    >
                      {meses} meses
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Modo de cobrança</Label>
                <div className="grid grid-cols-1 gap-2">
                  {MODOS_COBRANCA.map((modo) => (
                    <Button
                      key={modo.valor}
                      type="button"
                      variant={modoCobranca === modo.valor ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() =>
                        form.setValue('modoCobranca', modo.valor, { shouldValidate: true })
                      }
                    >
                      {modo.rotulo}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  No modo manual, a fatura mensal é registrada só internamente — nada é enviado ao Asaas.
                </p>
              </div>

              <ServicosChecklist
                itens={itens}
                onChange={(novos) => {
                  setItens(novos)
                  if (erroServicos) setErroServicos(null)
                }}
                erro={erroServicos}
              />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={convertendo}
                  onClick={() => fechar(false)}
                >
                  Agora não
                </Button>
                <Button type="submit" disabled={convertendo}>
                  {convertendo ? 'Convertendo…' : 'Converter em cliente'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

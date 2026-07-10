import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { format, parseISO } from 'date-fns'

import { deleteCliente } from '@/actions/clientes'
import { deleteContrato, getContratosDoCliente } from '@/actions/contratos'
import { ContratoForm } from '@/components/contrato-form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'

type Cliente = typeof clientes.$inferSelect

// D-10: cores exatas de badge de status (01-UI-SPEC.md § Status Badge Colors).
const STATUS_LABEL: Record<Cliente['status'], string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
}

const STATUS_COLOR: Record<Cliente['status'], string> = {
  ativo: '#16A34A',
  pausado: '#D97706',
  encerrado: '#71717A',
}

const NICHO_LABEL: Record<Cliente['nicho'], string> = {
  ecommerce: 'E-commerce',
  negocio_local: 'Negócio Local',
  infoproduto: 'Infoproduto',
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatarData(data: string): string {
  return format(parseISO(data), 'dd/MM/yyyy')
}

// Server Actions inline: mantêm a checagem role === 'admin' e a copy exata de
// confirmação diretamente neste arquivo (D-03), sem extrair para um client
// component separado.
async function excluirClienteAction(clienteId: string) {
  'use server'
  const resultado = await deleteCliente(clienteId)
  if (!('error' in resultado)) {
    redirect('/clientes')
  }
}

async function excluirContratoAction(contratoId: string) {
  'use server'
  await deleteContrato(contratoId)
}

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cliente = await db.query.clientes.findFirst({
    where: eq(clientes.id, id),
  })
  if (!cliente) {
    notFound()
  }

  const [{ contratoAtual, historico }, usuario] = await Promise.all([
    getContratosDoCliente(id),
    getCurrentUser(),
  ])

  // D-03: exclusão de cliente/contrato é exclusiva do Admin.
  const isAdmin = usuario?.role === 'admin'

  // D-06: histórico exclui o contrato vigente, que já é exibido em destaque acima.
  const registrosAnteriores = historico.filter((contrato) => contrato.id !== contratoAtual?.id)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-[28px] leading-tight font-semibold">{cliente.nome}</h1>
          <div className="flex items-center gap-2">
            <Badge
              style={{ backgroundColor: STATUS_COLOR[cliente.status] }}
              className="text-white"
            >
              {STATUS_LABEL[cliente.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {NICHO_LABEL[cliente.nicho]}
            </span>
          </div>
          {(cliente.contatoNome || cliente.contatoTelefone || cliente.contatoEmail) && (
            <p className="text-sm text-muted-foreground">
              Contato responsável: {[cliente.contatoNome, cliente.contatoTelefone, cliente.contatoEmail]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {cliente.notas && <p className="text-sm text-muted-foreground">{cliente.notas}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/clientes/${id}/editar`}>Editar</Link>
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Excluir cliente</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
                  <AlertDialogDescription>
                    {'Esta ação não pode ser desfeita. O cliente e todo o histórico de contratos vinculados serão removidos permanentemente. Deseja continuar?'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <form action={excluirClienteAction.bind(null, id)}>
                    <AlertDialogAction type="submit" variant="destructive">
                      Excluir cliente
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <section className="space-y-4 rounded-xl border bg-secondary/40 p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-[20px] leading-tight font-semibold">Contrato Atual</h2>
          {contratoAtual && <Badge variant="outline">Contrato Atual</Badge>}
        </div>

        {contratoAtual ? (
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">Início: </span>
              {formatarData(contratoAtual.dataInicio)}
            </p>
            <p>
              <span className="text-muted-foreground">Vencimento: </span>
              {formatarData(contratoAtual.dataVencimento)}
            </p>
            <p>
              <span className="text-muted-foreground">Valor mensal: </span>
              {formatadorMoeda.format(Number(contratoAtual.valorMensal))}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>
        )}

        <ContratoForm clienteId={id} />
      </section>

      <section className="space-y-4">
        <h2 className="text-[20px] leading-tight font-semibold">Histórico de Contratos</h2>

        {registrosAnteriores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contrato anterior registrado.</p>
        ) : (
          <ul className="space-y-3">
            {registrosAnteriores.map((contrato) => (
              <li
                key={contrato.id}
                className="flex flex-col gap-4 rounded-lg border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                  <p>
                    <span className="text-muted-foreground">Início: </span>
                    {formatarData(contrato.dataInicio)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Vencimento: </span>
                    {formatarData(contrato.dataVencimento)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Valor mensal: </span>
                    {formatadorMoeda.format(Number(contrato.valorMensal))}
                  </p>
                </div>

                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Excluir contrato
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
                        <AlertDialogDescription>
                          {'Esta ação não pode ser desfeita. Este registro de contrato será removido permanentemente do histórico. Deseja continuar?'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <form action={excluirContratoAction.bind(null, contrato.id)}>
                          <AlertDialogAction type="submit" variant="destructive">
                            Excluir contrato
                          </AlertDialogAction>
                        </form>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

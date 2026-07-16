import Link from 'next/link'
import { FileSignature, Hourglass, Inbox } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listarTodosContratos } from '@/actions/contratos'
import { rotuloStatusFluxo, badgeStatusFluxo } from '@/lib/contratos/fluxo'
import { rotuloServico } from '@/lib/crm/servicos'
import { CopiarLinkBotao } from '@/components/contratos/copiar-link-botao'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

// Formata 'YYYY-MM-DD' como 'DD/MM/YYYY' sem passar por Date (evita erro de fuso).
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default async function ContratosPage() {
  const contratos = await listarTodosContratos()

  const vigentes = contratos.filter((c) => c.vigente)
  const mrrTotal = vigentes.reduce((acc, c) => acc + Number(c.valorMensal), 0)
  const aguardandoDados = contratos.filter((c) => c.statusFluxo === 'aguardando_dados').length
  const dadosRecebidos = contratos.filter((c) => c.statusFluxo === 'dados_recebidos').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
        <p className="text-sm text-muted-foreground">
          Todos os contratos, de todos os clientes — do link enviado ao contrato assinado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Contratos Vigentes"
          value={String(vigentes.length)}
          icon={FileSignature}
          color="primary"
          helper="contrato atual de cada cliente"
        />
        <StatCard
          label="MRR dos Contratos Vigentes"
          value={formatadorMoeda.format(mrrTotal)}
          icon={FileSignature}
          color="success"
        />
        <StatCard
          label="Aguardando Dados"
          value={String(aguardandoDados)}
          icon={Hourglass}
          color="warning"
          helper="link enviado, cliente ainda não preencheu"
        />
        <StatCard
          label="Dados Recebidos"
          value={String(dadosRecebidos)}
          icon={Inbox}
          color="primary"
          helper="prontos para gerar o contrato"
        />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Todos os Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          {contratos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum contrato registrado. Converta um negócio ganho no CRM ou cadastre pela ficha do
              cliente.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status do fluxo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Mensalidade</TableHead>
                  <TableHead className="w-12 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/clientes/${contrato.clienteId}`}
                        className="hover:underline"
                      >
                        {contrato.clienteNome}
                      </Link>
                      {!contrato.vigente && (
                        <span className="ml-2 text-xs text-muted-foreground">(anterior)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contrato.servico ? rotuloServico(contrato.servico) : '—'}
                    </TableCell>
                    <TableCell>
                      {contrato.duracaoMeses ? `${contrato.duracaoMeses} meses` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={badgeStatusFluxo(contrato.statusFluxo)}>
                        {rotuloStatusFluxo(contrato.statusFluxo)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatarData(contrato.dataInicio)}</TableCell>
                    <TableCell>{formatarData(contrato.dataVencimento)}</TableCell>
                    <TableCell className="text-right">
                      {formatadorMoeda.format(Number(contrato.valorMensal))}
                    </TableCell>
                    <TableCell className="text-right">
                      {contrato.token ? <CopiarLinkBotao token={contrato.token} /> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

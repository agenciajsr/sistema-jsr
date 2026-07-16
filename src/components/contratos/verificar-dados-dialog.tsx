'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { contratanteSchema } from '@/lib/validations/contratante'
import { formatarCpf, formatarCnpj } from '@/lib/contratos/variaveis'

// Dialog "Verificar": mostra os dados PJ/PF que o contratante enviou pelo
// link público, formatados com rótulos pt-BR.

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-medium break-words">{valor}</span>
    </div>
  )
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
}

export function VerificarDadosDialog({
  aberto,
  onFechar,
  clienteNome,
  dadosContratante,
  dadosRecebidosEm,
}: {
  aberto: boolean
  onFechar: () => void
  clienteNome: string
  dadosContratante: unknown
  dadosRecebidosEm: string | null
}) {
  const parsed = contratanteSchema.safeParse(dadosContratante)

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dados do contratante — {clienteNome}</DialogTitle>
          <DialogDescription>
            Recebidos pelo link público em {formatarDataHora(dadosRecebidosEm)}.
          </DialogDescription>
        </DialogHeader>

        {!parsed.success ? (
          <p className="py-4 text-sm text-muted-foreground">
            Os dados recebidos estão incompletos ou em formato inesperado — peça ao contratante
            para preencher o formulário novamente.
          </p>
        ) : parsed.data.tipo === 'pj' ? (
          <div className="divide-y">
            <div className="pb-2">
              <Badge className="bg-blue-100 text-blue-800 border-transparent dark:bg-blue-500/15 dark:text-blue-400">
                Pessoa Jurídica
              </Badge>
            </div>
            <Linha rotulo="Razão social" valor={parsed.data.razaoSocial} />
            <Linha rotulo="CNPJ" valor={formatarCnpj(parsed.data.cnpj)} />
            <Linha rotulo="Endereço da sede" valor={parsed.data.enderecoSede} />
            <Linha rotulo="Telefone" valor={parsed.data.telefone} />
            <Linha rotulo="Representante" valor={parsed.data.nomeRepresentante} />
            <Linha rotulo="Nacionalidade" valor={parsed.data.nacionalidade} />
            <Linha rotulo="Estado civil" valor={parsed.data.estadoCivil} />
            <Linha rotulo="Profissão" valor={parsed.data.profissao} />
            <Linha rotulo="CPF" valor={formatarCpf(parsed.data.cpf)} />
            <Linha rotulo="Endereço" valor={parsed.data.enderecoRepresentante} />
            <Linha rotulo="E-mail" valor={parsed.data.email} />
          </div>
        ) : (
          <div className="divide-y">
            <div className="pb-2">
              <Badge className="bg-violet-100 text-violet-800 border-transparent dark:bg-violet-500/15 dark:text-violet-400">
                Pessoa Física
              </Badge>
            </div>
            <Linha rotulo="Nome completo" valor={parsed.data.nomeCompleto} />
            <Linha rotulo="CPF" valor={formatarCpf(parsed.data.cpf)} />
            <Linha rotulo="Nacionalidade" valor={parsed.data.nacionalidade} />
            <Linha rotulo="Estado civil" valor={parsed.data.estadoCivil} />
            <Linha rotulo="Profissão" valor={parsed.data.profissao} />
            <Linha rotulo="Endereço" valor={parsed.data.endereco} />
            <Linha rotulo="Telefone" valor={parsed.data.telefone} />
            <Linha rotulo="E-mail" valor={parsed.data.email} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

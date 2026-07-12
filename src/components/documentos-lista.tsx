'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Download, Trash2, Loader2, FileText } from 'lucide-react'

import { deletarDocumento, getUrlDocumento } from '@/actions/documentos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

const CATEGORIA_LABEL: Record<string, string> = {
  contrato: 'Contrato',
  comprovante: 'Comprovante',
  briefing: 'Briefing',
  criativo: 'Criativo',
  relatorio: 'Relatorio',
  outro: 'Outro',
}

const CATEGORIA_COLOR: Record<string, string> = {
  contrato: 'bg-blue-100 text-blue-700',
  comprovante: 'bg-green-100 text-green-700',
  briefing: 'bg-purple-100 text-purple-700',
  criativo: 'bg-pink-100 text-pink-700',
  relatorio: 'bg-amber-100 text-amber-700',
  outro: 'bg-gray-100 text-gray-700',
}

export type DocumentoItem = {
  id: string
  clienteId: string
  clienteNome: string
  nome: string
  categoria: string
  tamanhoBytes: number
  mimeType: string
  storagePath: string
  uploadPorNome: string
  notas: string | null
  createdAt: Date
}

interface DocumentosListaProps {
  documentos: DocumentoItem[]
  mostrarCliente?: boolean
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentosLista({ documentos, mostrarCliente = false }: DocumentosListaProps) {
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const docsFiltrados = filtroCategoria === 'todos'
    ? documentos
    : documentos.filter((d) => d.categoria === filtroCategoria)

  const handleDownload = (docId: string) => {
    setLoadingId(docId)
    startTransition(async () => {
      const result = await getUrlDocumento(docId)
      if ('data' in result && result.data) {
        window.open(result.data.url, '_blank')
      }
      setLoadingId(null)
    })
  }

  const handleDelete = (docId: string) => {
    startTransition(async () => {
      await deletarDocumento(docId)
    })
  }

  if (documentos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <FileText className="size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Nenhum documento encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtro por categoria */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            {Object.entries(CATEGORIA_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {docsFiltrados.length} documento{docsFiltrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              {mostrarCliente && <TableHead>Cliente</TableHead>}
              <TableHead>Categoria</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Enviado por</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docsFiltrados.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="max-w-[200px] truncate font-medium" title={doc.nome}>
                  {doc.nome}
                </TableCell>
                {mostrarCliente && (
                  <TableCell className="text-muted-foreground">{doc.clienteNome}</TableCell>
                )}
                <TableCell>
                  <Badge variant="secondary" className={CATEGORIA_COLOR[doc.categoria] || ''}>
                    {CATEGORIA_LABEL[doc.categoria] || doc.categoria}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatarTamanho(doc.tamanhoBytes)}
                </TableCell>
                <TableCell className="text-muted-foreground">{doc.uploadPorNome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(doc.createdAt), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(doc.id)}
                      disabled={isPending && loadingId === doc.id}
                      title="Baixar"
                    >
                      {isPending && loadingId === doc.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Excluir">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir documento</AlertDialogTitle>
                          <AlertDialogDescription>
                            O arquivo &quot;{doc.nome}&quot; sera removido permanentemente. Deseja continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(doc.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

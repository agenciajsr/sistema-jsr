'use client'

import { useState, useTransition, useMemo } from 'react'
import { format, subDays, isAfter } from 'date-fns'
import { Download, Trash2, Loader2, FileText, Pencil } from 'lucide-react'

import { deletarDocumento, getUrlDocumento, atualizarDocumento } from '@/actions/documentos'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const CATEGORIA_LABEL: Record<string, string> = {
  contrato: 'Contrato',
  comprovante: 'Comprovante',
  briefing: 'Briefing',
  criativo: 'Criativo',
  relatorio: 'Relatorio',
  outro: 'Outro',
}

const CATEGORIA_COLOR: Record<string, string> = {
  contrato: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  comprovante: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  briefing: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  criativo: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  relatorio: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  outro: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-zinc-300',
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
  const [filtroData, setFiltroData] = useState<string>('todos')
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Estado do painel de edicao
  const [editDoc, setEditDoc] = useState<DocumentoItem | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editNotas, setEditNotas] = useState('')

  const docsFiltrados = useMemo(() => {
    let resultado = documentos

    if (filtroCategoria !== 'todos') {
      resultado = resultado.filter((d) => d.categoria === filtroCategoria)
    }

    if (filtroData !== 'todos') {
      const dias = filtroData === '7dias' ? 7 : 30
      const dataLimite = subDays(new Date(), dias)
      resultado = resultado.filter((d) => isAfter(new Date(d.createdAt), dataLimite))
    }

    return resultado
  }, [documentos, filtroCategoria, filtroData])

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

  const handleOpenEdit = (doc: DocumentoItem) => {
    setEditNome(doc.nome)
    setEditNotas(doc.notas || '')
    setEditDoc(doc)
  }

  const handleSaveEdit = () => {
    if (!editDoc) return
    startTransition(async () => {
      await atualizarDocumento(editDoc.id, {
        nome: editNome,
        notas: editNotas,
      })
      setEditDoc(null)
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
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
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
        <Select value={filtroData} onValueChange={setFiltroData}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as datas</SelectItem>
            <SelectItem value="7dias">Ultimos 7 dias</SelectItem>
            <SelectItem value="30dias">Ultimos 30 dias</SelectItem>
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
                      onClick={() => handleOpenEdit(doc)}
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
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

      {/* Painel de edicao */}
      <Sheet open={!!editDoc} onOpenChange={(open) => { if (!open) setEditDoc(null) }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar documento</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome do arquivo</Label>
              <Input
                id="edit-nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notas">Notas</Label>
              <Textarea
                id="edit-notas"
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                rows={4}
                placeholder="Observacoes sobre o documento..."
              />
            </div>
            <Button
              onClick={handleSaveEdit}
              disabled={isPending || !editNome.trim()}
              className="w-full"
            >
              {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Salvar alteracoes
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

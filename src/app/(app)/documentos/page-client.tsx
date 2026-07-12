'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'

import { UploadDocumento } from '@/components/upload-documento'
import { DocumentosLista, type DocumentoItem } from '@/components/documentos-lista'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DocumentosPageClientProps {
  documentos: DocumentoItem[]
  clientes: { id: string; nome: string }[]
}

export function DocumentosPageClient({ documentos, clientes }: DocumentosPageClientProps) {
  const [clienteIdFiltro, setClienteIdFiltro] = useState<string>('todos')
  const [clienteIdUpload, setClienteIdUpload] = useState<string>(clientes[0]?.id || '')

  const docsFiltrados = clienteIdFiltro === 'todos'
    ? documentos
    : documentos.filter((d) => d.clienteId === clienteIdFiltro)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Cliente:</span>
          <Select value={clienteIdFiltro} onValueChange={setClienteIdFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Enviar documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Cliente destino</span>
            <Select value={clienteIdUpload} onValueChange={setClienteIdUpload}>
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {clienteIdUpload && <UploadDocumento clienteId={clienteIdUpload} />}
        </CardContent>
      </Card>

      {/* Lista */}
      <DocumentosLista documentos={docsFiltrados} mostrarCliente />
    </div>
  )
}

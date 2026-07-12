'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { Upload, FileUp, Loader2 } from 'lucide-react'

import { uploadDocumento } from '@/actions/documentos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CATEGORIAS = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'comprovante', label: 'Comprovante' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'criativo', label: 'Criativo' },
  { value: 'relatorio', label: 'Relatorio' },
  { value: 'outro', label: 'Outro' },
]

interface UploadDocumentoProps {
  clienteId: string
}

export function UploadDocumento({ clienteId }: UploadDocumentoProps) {
  const [file, setFile] = useState<File | null>(null)
  const [categoria, setCategoria] = useState('outro')
  const [notas, setNotas] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setError(null)
      setSuccess(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError(null)
      setSuccess(false)
    }
  }

  const handleSubmit = () => {
    if (!file) {
      setError('Selecione um arquivo.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clienteId', clienteId)
      formData.append('categoria', categoria)
      if (notas.trim()) {
        formData.append('notas', notas.trim())
      }

      const result = await uploadDocumento(formData)
      if ('error' in result) {
        setError(result.error!)
        setSuccess(false)
      } else {
        setFile(null)
        setNotas('')
        setCategoria('outro')
        setError(null)
        setSuccess(true)
        if (inputRef.current) inputRef.current.value = ''
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <Upload className="size-8 text-muted-foreground" />
        {file ? (
          <p className="text-sm font-medium">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Arraste um arquivo aqui ou clique para selecionar
          </p>
        )}
        <Input
          ref={inputRef}
          type="file"
          className="hidden"
          id={`file-upload-${clienteId}`}
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="mr-1 size-4" />
          Escolher arquivo
        </Button>
      </div>

      {/* Campos extras */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`cat-${clienteId}`}>Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger id={`cat-${clienteId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`notas-${clienteId}`}>Notas (opcional)</Label>
          <Textarea
            id={`notas-${clienteId}`}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observacoes sobre o documento..."
            rows={2}
          />
        </div>
      </div>

      {/* Feedback + acao */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Documento enviado com sucesso!</p>}

      <Button onClick={handleSubmit} disabled={!file || isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" />
            Enviando...
          </>
        ) : (
          'Enviar documento'
        )}
      </Button>
    </div>
  )
}

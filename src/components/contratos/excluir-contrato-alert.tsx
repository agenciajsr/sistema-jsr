'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteContrato } from '@/actions/contratos'

export function ExcluirContratoAlert({
  aberto,
  onFechar,
  contratoId,
  clienteNome,
}: {
  aberto: boolean
  onFechar: () => void
  contratoId: string
  clienteNome: string
}) {
  const [excluindo, startTransition] = useTransition()

  function excluir() {
    startTransition(async () => {
      const resultado = await deleteContrato(contratoId)
      if (resultado && 'error' in resultado && resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success('Contrato excluído.')
      onFechar()
    })
  }

  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir o contrato de {clienteNome}?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              excluir()
            }}
            disabled={excluindo}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

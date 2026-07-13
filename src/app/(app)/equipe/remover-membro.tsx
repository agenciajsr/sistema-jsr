'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { removerMembro } from '@/actions/equipe'
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
import { Button } from '@/components/ui/button'

// Botão de remover membro (só admin, e nunca para si mesmo). Confirma antes de
// apagar de vez o acesso e o perfil.
export function RemoverMembro({ id, nome }: { id: string; nome: string }) {
  const [isPending, startTransition] = useTransition()

  function handleRemover() {
    startTransition(async () => {
      const result = await removerMembro(id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${nome} foi removido da equipe.`)
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label={`Remover ${nome}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação remove o acesso e o perfil do membro de forma permanente.
            Não é possível desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemover}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending ? 'Removendo...' : 'Remover'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import { FormularioUsuario } from '../usuarios/formulario-usuario'

// Painel lateral (só admin) para criar um novo membro reutilizando o
// FormularioUsuario existente. Ao criar com sucesso, fecha o painel e atualiza
// a lista.
export function AdicionarMembro() {
  const [aberto, setAberto] = useState(false)
  const router = useRouter()

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">Adicionar membro</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle>Adicionar membro</SheetTitle>
          <SheetDescription>
            Crie uma nova conta de acesso para a equipe da JSR (Admin ou Membro).
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <FormularioUsuario
            onSuccess={() => {
              setAberto(false)
              router.refresh()
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

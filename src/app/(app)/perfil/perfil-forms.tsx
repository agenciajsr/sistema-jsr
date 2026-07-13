'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { atualizarMeuNome, atualizarMinhaSenha } from '@/actions/perfil'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PerfilForms({
  nomeInicial,
  email,
}: {
  nomeInicial: string
  email: string
}) {
  const router = useRouter()

  // --- Form de nome ---
  const [nome, setNome] = useState(nomeInicial)
  const [salvandoNome, startSalvarNome] = useTransition()

  function salvarNome(e: React.FormEvent) {
    e.preventDefault()
    startSalvarNome(async () => {
      const result = await atualizarMeuNome(nome)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Nome atualizado.')
      router.refresh()
    })
  }

  // --- Form de senha ---
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [salvandoSenha, startSalvarSenha] = useTransition()

  function salvarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 8) {
      toast.error('A senha deve ter ao menos 8 caracteres.')
      return
    }
    if (senha !== confirmar) {
      toast.error('As senhas não coincidem.')
      return
    }
    startSalvarSenha(async () => {
      const result = await atualizarMinhaSenha(senha)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Senha alterada com sucesso.')
      setSenha('')
      setConfirmar('')
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
          <CardDescription>Atualize seu nome de exibição.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvarNome} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={email} readOnly disabled autoComplete="email" />
              <p className="text-xs text-muted-foreground">
                O e-mail de acesso não pode ser alterado por aqui.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
              />
            </div>
            <Button type="submit" disabled={salvandoNome || nome.trim() === nomeInicial.trim()}>
              {salvandoNome ? 'Salvando...' : 'Salvar nome'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
          <CardDescription>Use ao menos 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvarSenha} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar">Confirmar nova senha</Label>
              <Input
                id="confirmar"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={salvandoSenha || senha.length === 0}>
              {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

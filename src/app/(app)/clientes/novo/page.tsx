import { ClienteForm } from '@/components/cliente-form'
import { BotaoVoltar } from '@/components/ui/botao-voltar'

// Backstop contra o timeout de 300s da Vercel: nunca deixa a função rodar
// mais que 25s. Coerente com connect_timeout(10s) + statement_timeout(12s).
export const maxDuration = 60

export default function NovoClientePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-2">
        <BotaoVoltar href="/clientes" label="Clientes" />
        <h1 className="text-[28px] font-semibold leading-tight">Cadastrar Cliente</h1>
      </div>
      <ClienteForm mode="criar" />
    </div>
  )
}

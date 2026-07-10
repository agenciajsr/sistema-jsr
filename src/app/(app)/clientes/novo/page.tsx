import { ClienteForm } from '@/components/cliente-form'

export default function NovoClientePage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <h1 className="text-[28px] font-semibold leading-tight">Cadastrar Cliente</h1>
      <ClienteForm mode="criar" />
    </div>
  )
}

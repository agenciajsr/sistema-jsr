import { redirect } from 'next/navigation'

// O funil mock virou o CRM real. Rota mantida só para não quebrar
// histórico/links antigos — redireciona direto para /crm.
export default function FunilPage() {
  redirect('/crm')
}

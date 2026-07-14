import { Skeleton } from '@/components/ui/skeleton'

// Skeleton exibido instantaneamente durante a navegação para /financeiro.
// Sem este arquivo, o App Router bloqueia a UI até o servidor terminar todas
// as queries — a sensação de "cliquei e não abre". O esqueleto espelha o
// layout real da página (cabeçalho, 6 KPIs, formulário, abas + tabela) para
// não haver "pulo" visual quando os dados chegam.
export default function FinanceiroLoading() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho: título + subtítulo à esquerda, seletor de mês à direita */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>

      {/* Grid de 6 KPIs (mesma grade dos StatCards) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-xl" />
        ))}
      </div>

      {/* Bloco do formulário de transação */}
      <Skeleton className="h-48 rounded-xl" />

      {/* Abas + tabela de transações */}
      <div className="space-y-4">
        <Skeleton className="h-9 w-80 rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  )
}

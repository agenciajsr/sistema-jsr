import { Skeleton } from '@/components/ui/skeleton'

// Loading genérico e leve para todas as rotas do grupo (app) que não têm um
// loading.tsx próprio. Sem ele, o App Router bloqueia a navegação até o
// servidor terminar de renderizar — a página "congela" ao clicar no menu.
// Rotas com loading.tsx específico (ex.: /financeiro) têm precedência.
export default function AppLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

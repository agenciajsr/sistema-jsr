'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, Wallet } from 'lucide-react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Props = {
  abaAtual: string
}

export function AbasCampanhas({ abaAtual }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'performance') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.push(qs ? `/campanhas?${qs}` : '/campanhas')
  }

  return (
    <Tabs value={abaAtual} onValueChange={handleTab}>
      <TabsList className="max-w-full justify-start overflow-x-auto">
        <TabsTrigger value="performance" className="gap-1.5">
          <Activity className="size-3.5" />
          Performance
        </TabsTrigger>
        <TabsTrigger value="verbas" className="gap-1.5">
          <Wallet className="size-3.5" />
          Verbas
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

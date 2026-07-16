'use client'

// Central de automações da aba Ferramentas: liga/desliga + configuração
// editável (token WaScript, números destino, template com variáveis).

import { useState } from 'react'
import { MessageCircle, Megaphone } from 'lucide-react'
import { toast } from 'sonner'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { salvarAutomacao } from '@/actions/automacoes'
import type { ChaveAutomacao, ConfigAutomacao } from '@/lib/crm/automacoes'

type Automacao = { chave: ChaveAutomacao; ativo: boolean; config: ConfigAutomacao }

const META: Record<
  ChaveAutomacao,
  { titulo: string; descricao: string; icone: typeof MessageCircle; temNumeros: boolean }
> = {
  aviso_lead_novo: {
    titulo: 'Avisar equipe de lead novo',
    descricao:
      'Quando um lead novo cai no CRM (landing, Meta, extensão), envia um WhatsApp para você/SDR com os dados dele.',
    icone: Megaphone,
    temNumeros: true,
  },
  mensagem_lead_novo: {
    titulo: 'Primeira mensagem automática ao lead',
    descricao:
      'Responde o lead no WhatsApp em segundos após ele preencher o formulário (speed-to-lead).',
    icone: MessageCircle,
    temNumeros: false,
  },
}

// Ponto de partida editável — o usuário ajusta o texto na própria aba.
const MENSAGEM_PADRAO: Record<ChaveAutomacao, string> = {
  aviso_lead_novo:
    '🔥 Lead novo no CRM!\n\nNome: {nome}\nWhatsApp: {telefone}\nOrigem: {origem}\n\n{respostas}',
  mensagem_lead_novo:
    'Olá, {nome}! Tudo bem? 😊\n\nRecebemos suas informações e em breve alguém do nosso time vai falar com você.',
}

function CardAutomacao({ automacao }: { automacao: Automacao }) {
  const meta = META[automacao.chave]
  const [ativo, setAtivo] = useState(automacao.ativo)
  const [token, setToken] = useState(automacao.config.token ?? '')
  const [numeros, setNumeros] = useState(automacao.config.numeros ?? '')
  const [mensagem, setMensagem] = useState(
    automacao.config.mensagem ?? MENSAGEM_PADRAO[automacao.chave],
  )
  const [salvando, setSalvando] = useState(false)

  async function salvar(novoAtivo = ativo) {
    setSalvando(true)
    try {
      const res = await salvarAutomacao(automacao.chave, novoAtivo, { token, numeros, mensagem })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Automação salva.')
    } finally {
      setSalvando(false)
    }
  }

  const Icone = meta.icone

  return (
    <Card className="gap-4 border-none p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Icone className="size-4" />
          </div>
          <div>
            <p className="font-medium">{meta.titulo}</p>
            <p className="text-sm text-muted-foreground">{meta.descricao}</p>
          </div>
        </div>
        <Switch
          checked={ativo}
          onCheckedChange={(v) => {
            setAtivo(v)
            void salvar(v)
          }}
          aria-label={`Ativar ${meta.titulo}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Token da API (WaScript)</Label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token da extensão"
          />
        </div>
        {meta.temNumeros && (
          <div className="space-y-1.5">
            <Label>Números que recebem o aviso</Label>
            <Input
              value={numeros}
              onChange={(e) => setNumeros(e.target.value)}
              placeholder="5571999998888, 5571988887777"
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Mensagem</Label>
        <Textarea
          rows={5}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Use as variáveis abaixo para personalizar."
        />
        <p className="text-xs text-muted-foreground">
          Variáveis: <code>{'{nome}'}</code> · <code>{'{telefone}'}</code> ·{' '}
          <code>{'{origem}'}</code> · <code>{'{respostas}'}</code> (perguntas e respostas do
          formulário)
        </p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </Card>
  )
}

export function AutomacoesLista({ automacoes }: { automacoes: Automacao[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {automacoes.map((a) => (
        <CardAutomacao key={a.chave} automacao={a} />
      ))}
    </div>
  )
}

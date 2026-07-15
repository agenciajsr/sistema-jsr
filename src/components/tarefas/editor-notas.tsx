'use client'

// Editor de Notas rico (WYSIWYG) compartilhado pelo detalhe da tarefa e pela
// tela de nova tarefa. Usa `document.execCommand` para aplicar formatação real
// (negrito, itálico, sublinhado, listas, link). `execCommand` é DEPRECATED
// porém continua funcional em todos os browsers atuais — é o caminho sem
// dependência para um WYSIWYG simples numa ferramenta interna.
//
// IMPORTANTE (cursor): o contentEditable NÃO é controlado pelo React a cada
// tecla. Se reescrevêssemos `innerHTML` a cada input, o cursor pularia para o
// início a cada caractere. Por isso o HTML inicial é definido UMA vez na
// montagem (ref.innerHTML) e depois só LEMOS o innerHTML no input/blur.

import { useEffect, useRef } from 'react'
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Underline, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Ferramenta = { cmd: string; Icone: LucideIcon; rotulo: string; precisaUrl?: boolean }

const FERRAMENTAS: Ferramenta[] = [
  { cmd: 'bold', Icone: Bold, rotulo: 'Negrito' },
  { cmd: 'italic', Icone: Italic, rotulo: 'Itálico' },
  { cmd: 'underline', Icone: Underline, rotulo: 'Sublinhado' },
  { cmd: 'insertUnorderedList', Icone: List, rotulo: 'Lista' },
  { cmd: 'insertOrderedList', Icone: ListOrdered, rotulo: 'Lista numerada' },
  { cmd: 'createLink', Icone: LinkIcon, rotulo: 'Link', precisaUrl: true },
]

export function EditorNotas({
  valorInicial,
  onChange,
  onBlur,
  placeholder,
  expandido,
  className,
  'aria-label': ariaLabel,
}: {
  /** HTML inicial (pode ser '' ou texto/markdown legado). Setado como innerHTML só na montagem. */
  valorInicial: string
  /** Chamado a cada input com o innerHTML atual. */
  onChange?: (html: string) => void
  /** Chamado ao sair do campo com o innerHTML atual. */
  onBlur?: (html: string) => void
  placeholder?: string
  /** Controla a altura mínima (recolhido vs expandido), como o `rows` do textarea antigo. */
  expandido?: boolean
  className?: string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Define o HTML inicial UMA vez na montagem. NÃO recontrolar via React a cada
  // tecla (o cursor pularia). Deps vazias de propósito.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = valorInicial ?? ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Aplica um comando de formatação preservando a seleção e reporta a mudança. */
  function comando(cmd: string, valor?: string) {
    const el = ref.current
    if (!el) return
    el.focus()
    document.execCommand(cmd, false, valor)
    onChange?.(el.innerHTML)
  }

  function aoClicarFerramenta(f: Ferramenta) {
    if (f.precisaUrl) {
      const url = window.prompt('URL do link:')
      if (!url) return
      comando(f.cmd, url)
      return
    }
    comando(f.cmd)
  }

  // SEGURANÇA (XSS): colar insere apenas TEXTO PURO. Como é ferramenta interna
  // com autores confiáveis e o HTML só aparece dentro deste próprio editor,
  // isso basta — sem biblioteca de sanitização.
  function aoColar(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const texto = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, texto)
    if (ref.current) onChange?.(ref.current.innerHTML)
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
        {FERRAMENTAS.map((f) => (
          <Button
            key={f.cmd}
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            // não perder a seleção do texto ao clicar no botão
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aoClicarFerramenta(f)}
            aria-label={f.rotulo}
            title={f.rotulo}
          >
            <f.Icone className="size-3.5" />
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        onInput={() => onChange?.(ref.current?.innerHTML ?? '')}
        onBlur={() => onBlur?.(ref.current?.innerHTML ?? '')}
        onPaste={aoColar}
        className={cn(
          'w-full overflow-y-auto px-3 py-2 text-sm outline-none',
          // placeholder: contentEditable não tem placeholder nativo
          'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
          // formatação visível: listas com marcadores/numeração, links destacados
          '[&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5',
          expandido ? 'min-h-80' : 'min-h-40',
          className
        )}
      />
    </div>
  )
}

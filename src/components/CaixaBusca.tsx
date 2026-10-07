/* Caixa de busca com autocomplete (kb_sugerir). Enter pesquisa o texto
   digitado; setas navegam pelas sugestões; "/" ou Ctrl+K focam a caixa. */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { sugerir, type KbSugestao } from '@/lib/kb'
import { TIPO_POR_CHAVE } from '@/lib/templates'
import Destaque, { termosDaBusca } from './Destaque'
import { cn } from '@/lib/utils'

interface Props {
  valorInicial?: string
  grande?: boolean
  autoFocus?: boolean
  /** Parâmetros extras preservados ao pesquisar (ex.: categoria escolhida). */
  extras?: Record<string, string | null | undefined>
}

export default function CaixaBusca({ valorInicial = '', grande, autoFocus, extras }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState(valorInicial)
  const [sugestoes, setSugestoes] = useState<KbSugestao[]>([])
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const pedido = useRef(0)

  useEffect(() => {
    setQ(valorInicial)
  }, [valorInicial])

  useEffect(() => {
    const termo = q.trim()
    if (termo.length < 2) {
      setSugestoes([])
      return
    }
    const n = ++pedido.current
    const t = setTimeout(async () => {
      try {
        const r = await sugerir(termo)
        if (n === pedido.current) {
          setSugestoes(r)
          setAtivo(-1)
        }
      } catch {
        if (n === pedido.current) setSugestoes([])
      }
    }, 140)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      const digitando =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !digitando)) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  function pesquisar(texto: string) {
    const params = new URLSearchParams()
    if (texto.trim()) params.set('q', texto.trim())
    for (const [k, v] of Object.entries(extras ?? {})) if (v) params.set(k, v)
    setAberto(false)
    inputRef.current?.blur()
    navigate(`/buscar?${params.toString()}`)
  }

  function escolher(s: KbSugestao) {
    setAberto(false)
    if (s.espec === 'item' && s.item_id) navigate(`/item/${s.item_id}`)
    else {
      setQ(s.texto)
      pesquisar(s.texto)
    }
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberto(true)
      setAtivo((a) => Math.min(a + 1, sugestoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => Math.max(a - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (aberto && ativo >= 0 && sugestoes[ativo]) escolher(sugestoes[ativo])
      else pesquisar(q)
    } else if (e.key === 'Escape') {
      setAberto(false)
    }
  }

  const termos = termosDaBusca(q)
  const itens = sugestoes.filter((s) => s.espec === 'item')
  const palavras = sugestoes.filter((s) => s.espec === 'termo')
  const mostrar = aberto && q.trim().length >= 2 && sugestoes.length > 0

  return (
    <div className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          pesquisar(q)
        }}
        className={cn(
          'flex items-center gap-3 rounded-full border border-border bg-card shadow-subtle transition focus-within:border-foreground/40 focus-within:shadow-elevation',
          grande ? 'h-16 px-6' : 'h-11 px-4',
        )}
      >
        <Search
          className={cn('shrink-0 text-muted-foreground', grande ? 'h-5 w-5' : 'h-4 w-4')}
          aria-hidden
        />
        <input
          ref={inputRef}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value)
            setAberto(true)
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={aoTeclar}
          placeholder="Pesquise por material, técnica, procedimento, marca ou projeto"
          aria-label="Pesquisar conhecimento"
          aria-autocomplete="list"
          aria-expanded={mostrar}
          className={cn(
            'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70',
            grande ? 'text-lg' : 'text-sm',
          )}
        />
        {grande && (
          <button
            type="submit"
            className="hidden items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/85 sm:flex"
          >
            Pesquisar <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </form>

      {mostrar && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-popover py-2 text-left shadow-elevation"
        >
          {itens.map((s) => {
            const idx = sugestoes.indexOf(s)
            return (
              <button
                key={`i-${s.item_id}`}
                type="button"
                role="option"
                aria-selected={idx === ativo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(s)}
                onMouseEnter={() => setAtivo(idx)}
                className={cn(
                  'flex w-full items-baseline justify-between gap-4 px-5 py-2.5 text-left text-sm',
                  idx === ativo && 'bg-muted',
                )}
              >
                <span className="truncate">
                  <Destaque texto={s.texto} termos={termos} />
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {s.tipo ? TIPO_POR_CHAVE[s.tipo]?.singular : ''}
                </span>
              </button>
            )
          })}
          {palavras.length > 0 && (
            <div
              className={cn('px-5 pb-1 pt-2', itens.length > 0 && 'mt-1 border-t border-border')}
            >
              <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Pesquisar por
              </div>
              <div className="flex flex-wrap gap-1.5">
                {palavras.map((s) => {
                  const idx = sugestoes.indexOf(s)
                  return (
                    <button
                      key={`t-${s.texto}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => escolher(s)}
                      onMouseEnter={() => setAtivo(idx)}
                      className={cn(
                        'rounded-full border border-border px-3 py-1 text-xs',
                        idx === ativo ? 'bg-foreground text-background' : 'hover:bg-muted',
                      )}
                    >
                      {s.texto}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

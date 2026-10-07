/* SPEC-165 — Fila de revisão: sugestões de aproveitamento vindas das reuniões.
   Só curador aprova ou rejeita; aprovar abre o template do tema de destino
   pré-preenchido para a pessoa ajustar e salvar. Nada entra num tema sem isso. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { mensagemErro, nomesDeUsuarios, sb, type KbSugestao } from '@/lib/kb'
import { TIPO_POR_CHAVE, formatarData } from '@/lib/templates'
import { cn } from '@/lib/utils'

type Linha = KbSugestao & {
  reuniao: { id: string; titulo: string; project_code: string | null } | null
}
type Aba = 'pendente' | 'aprovada' | 'rejeitada'

export default function Revisao() {
  const { curador } = useAuth()
  const [aba, setAba] = useState<Aba>('pendente')
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const [rejeitando, setRejeitando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  async function carregar() {
    setLinhas(null)
    const { data } = await sb
      .from('kb_sugestoes')
      .select('*, reuniao:kb_itens!kb_sugestoes_reuniao_id_fkey(id, titulo, project_code)')
      .eq('status', aba)
      .order(aba === 'pendente' ? 'created_at' : 'revisado_em', { ascending: aba === 'pendente' })
      .limit(200)
    const l = (data ?? []) as Linha[]
    setLinhas(l)
    setNomes(await nomesDeUsuarios(l.flatMap((x) => [x.criado_por, x.revisado_por])))
  }

  useEffect(() => {
    carregar()
  }, [aba])

  async function rejeitar(id: string, textoMotivo: string) {
    const { error } = await sb
      .from('kb_sugestoes')
      .update({ status: 'rejeitada', motivo_rejeicao: textoMotivo.trim() || null })
      .eq('id', id)
    if (error) return toast.error(mensagemErro(error))
    toast.success('Sugestão rejeitada. Ela fica só no histórico da reunião.')
    window.dispatchEvent(new Event('kb:revisao-mudou'))
    setRejeitando(null)
    setMotivo('')
    carregar()
  }

  return (
    <div className="mx-auto max-w-3xl pt-10">
      <h1 className="font-serif text-4xl">Revisão</h1>
      <p className="mt-2 text-muted-foreground">
        Conhecimento das reuniões que pode servir para outros projetos. Cada sugestão só entra no
        tema depois de aprovada por um curador. Soluções excepcionais de um projeto devem ser
        rejeitadas: ficam apenas no histórico da reunião.
      </p>
      {!curador && (
        <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          Você pode acompanhar a fila; aprovar ou rejeitar é feito pelos curadores da base.
        </p>
      )}

      <div className="mt-8 flex gap-5 border-b border-border text-sm">
        {(['pendente', 'aprovada', 'rejeitada'] as Aba[]).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={cn(
              '-mb-px border-b-2 pb-2 transition',
              aba === a
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {a === 'pendente' ? 'Pendentes' : a === 'aprovada' ? 'Aprovadas' : 'Rejeitadas'}
          </button>
        ))}
      </div>

      {linhas === null ? (
        <p className="mt-8 text-muted-foreground">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {aba === 'pendente' ? 'Nenhuma sugestão aguardando revisão.' : 'Nada por aqui ainda.'}
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {linhas.map((s) => (
            <li key={s.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Sugestão para {TIPO_POR_CHAVE[s.tipo_destino]?.nome}
              </div>
              <h2 className="mt-1 font-serif text-2xl">{s.titulo}</h2>
              {s.justificativa && <p className="mt-2 text-sm">{s.justificativa}</p>}
              {s.trecho_origem && (
                <blockquote className="mt-3 border-l-2 border-[hsl(var(--luz-forte))] pl-3 text-sm italic text-muted-foreground">
                  {s.trecho_origem}
                </blockquote>
              )}
              <div className="mt-3 text-xs text-muted-foreground">
                Da reunião{' '}
                {s.reuniao ? (
                  <Link
                    to={`/item/${s.reuniao.id}`}
                    className="text-foreground underline underline-offset-4"
                  >
                    {s.reuniao.titulo}
                  </Link>
                ) : (
                  '—'
                )}
                {s.reuniao?.project_code && <> · Projeto {s.reuniao.project_code}</>} · sugerida em{' '}
                {formatarData(s.created_at)}
                {s.revisado_em && (
                  <>
                    {' '}
                    · {s.status === 'aprovada' ? 'aprovada' : 'rejeitada'} por{' '}
                    {(s.revisado_por && nomes[s.revisado_por]) || '—'} em{' '}
                    {formatarData(s.revisado_em)}
                  </>
                )}
              </div>
              {s.status === 'rejeitada' && s.motivo_rejeicao && (
                <p className="mt-2 text-sm text-muted-foreground">Motivo: {s.motivo_rejeicao}</p>
              )}
              {s.status === 'aprovada' && s.item_criado_id && (
                <Link
                  to={`/item/${s.item_criado_id}`}
                  className="mt-3 inline-block text-sm underline underline-offset-4"
                >
                  Ver item criado
                </Link>
              )}

              {curador && s.status === 'pendente' && (
                <div className="mt-4 space-y-3">
                  {rejeitando === s.id ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Motivo (ex.: solução excepcional deste projeto, informação insuficiente)"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejeitar(s.id, motivo)}
                        >
                          Confirmar rejeição
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejeitando(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" asChild>
                        <Link to={`/revisao/${s.id}`}>Revisar e aprovar</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejeitar(s.id, 'Solução excepcional deste projeto')}
                      >
                        Rejeitar: solução excepcional
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRejeitando(s.id)
                          setMotivo('')
                        }}
                      >
                        Rejeitar com outro motivo
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

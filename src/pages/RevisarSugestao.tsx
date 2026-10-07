/* SPEC-165 — Aprovar uma sugestão: o curador revisa e ajusta o conteúdo no
   template do tema de destino. Só ao salvar o item a sugestão vira
   'aprovada' (o banco exige o item criado, do mesmo tipo). */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import FormularioItem from '@/components/FormularioItem'
import { useAuth } from '@/hooks/use-auth'
import { mensagemErro, sb, type KbSugestao } from '@/lib/kb'
import { TIPO_POR_CHAVE } from '@/lib/templates'

type Linha = KbSugestao & {
  reuniao: { id: string; titulo: string; project_code: string | null } | null
}

export default function RevisarSugestao() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { curador } = useAuth()
  const [s, setS] = useState<Linha | null | undefined>(undefined)

  useEffect(() => {
    sb.from('kb_sugestoes')
      .select('*, reuniao:kb_itens!kb_sugestoes_reuniao_id_fkey(id, titulo, project_code)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setS((data as Linha) ?? null))
  }, [id])

  if (s === undefined) return <p className="pt-16 text-center text-muted-foreground">Carregando…</p>
  if (s === null)
    return <p className="pt-16 text-center text-muted-foreground">Sugestão não encontrada.</p>
  if (!curador)
    return (
      <p className="pt-16 text-center text-muted-foreground">
        A aprovação é feita pelos curadores da base.
      </p>
    )
  if (s.status !== 'pendente')
    return (
      <p className="pt-16 text-center text-muted-foreground">
        Esta sugestão já foi {s.status}.{' '}
        <Link to="/revisao" className="underline">
          Voltar à revisão
        </Link>
      </p>
    )

  const def = TIPO_POR_CHAVE[s.tipo_destino]

  async function aoSalvar(itemId: string) {
    const { error } = await sb
      .from('kb_sugestoes')
      .update({ status: 'aprovada', item_criado_id: itemId })
      .eq('id', s!.id)
    if (error) {
      toast.error(
        `Item salvo, mas a sugestão não foi marcada como aprovada: ${mensagemErro(error)}`,
      )
    } else {
      toast.success(`Aprovada: incluída em ${def.nome}.`)
    }
    navigate(`/item/${itemId}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl pt-10">
      <Link
        to="/revisao"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> Revisão
      </Link>
      <div className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Aprovar sugestão
      </div>
      <h1 className="mt-1 font-serif text-4xl">{def.singular}</h1>
      <div className="mb-8 mt-4 space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        {s.justificativa && <p>{s.justificativa}</p>}
        {s.trecho_origem && (
          <blockquote className="border-l-2 border-[hsl(var(--luz-forte))] pl-3 italic text-muted-foreground">
            {s.trecho_origem}
          </blockquote>
        )}
        {s.reuniao && (
          <p className="text-xs text-muted-foreground">
            Origem:{' '}
            <Link to={`/item/${s.reuniao.id}`} className="underline underline-offset-4">
              {s.reuniao.titulo}
            </Link>
            {s.reuniao.project_code && <> · Projeto {s.reuniao.project_code}</>}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Revise com olhar de regra geral: se for algo que só vale para este projeto, volte e
          rejeite como solução excepcional.
        </p>
      </div>
      <FormularioItem
        tipo={def}
        preenchimento={{ titulo: s.titulo, campos: s.campos, tags: s.tags }}
        onSalvo={aoSalvar}
        onCancelar={() => navigate('/revisao')}
      />
    </div>
  )
}

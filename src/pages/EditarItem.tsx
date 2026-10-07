/* Edição de um item com o mesmo template da inserção (SPEC-164).
   SPEC-165: em reunião importada (?importada=1) abre logo após o registro,
   para a pessoa corrigir o que a IA preparou e as sugestões pendentes. */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import FormularioItem from '@/components/FormularioItem'
import { useAuth } from '@/hooks/use-auth'
import { sb, type KbAnexo, type KbDecisao, type KbItem, type KbSugestao } from '@/lib/kb'
import { TIPO_POR_CHAVE } from '@/lib/templates'

export default function EditarItem() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const importada = params.get('importada') === '1'
  const navigate = useNavigate()
  const { userId, curador } = useAuth()
  const [item, setItem] = useState<KbItem | null | undefined>(undefined)
  const [anexos, setAnexos] = useState<KbAnexo[]>([])
  const [decisoes, setDecisoes] = useState<KbDecisao[]>([])
  const [sugestoes, setSugestoes] = useState<KbSugestao[]>([])

  useEffect(() => {
    Promise.all([
      sb.from('kb_itens').select('*').eq('id', id).maybeSingle(),
      sb.from('kb_anexos').select('*').eq('item_id', id).order('ordem').order('created_at'),
      sb.from('kb_decisoes').select('*').eq('reuniao_id', id).order('ordem'),
      sb
        .from('kb_sugestoes')
        .select('*')
        .eq('reuniao_id', id)
        .eq('status', 'pendente')
        .order('created_at'),
    ]).then(([{ data: it }, { data: ax }, { data: dc }, { data: sg }]) => {
      setAnexos((ax as KbAnexo[]) ?? [])
      setDecisoes((dc as KbDecisao[]) ?? [])
      setSugestoes((sg as KbSugestao[]) ?? [])
      // Por último: o formulário só monta quando item existe, já com decisões e sugestões.
      setItem((it as KbItem) ?? null)
    })
  }, [id])

  if (item === undefined)
    return <p className="pt-16 text-center text-muted-foreground">Carregando…</p>
  if (item === null || !(item.autor_id === userId || curador))
    return (
      <p className="pt-16 text-center text-muted-foreground">
        Você não tem permissão para editar este item.
      </p>
    )

  const def = TIPO_POR_CHAVE[item.tipo]
  return (
    <div className="mx-auto max-w-2xl pt-10">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Editar · {def.singular}
      </div>
      <h1 className="mb-6 mt-1 font-serif text-3xl">{item.titulo}</h1>
      {importada && (
        <div className="mb-8 rounded-xl border border-[hsl(var(--luz-forte))]/60 bg-card p-4 text-sm">
          <p className="font-medium">
            Reunião registrada no histórico do projeto {item.project_code}.
          </p>
          <p className="mt-1 text-muted-foreground">
            Revise o que a interpretação preparou e corrija o que for preciso: resumo, andamento,
            decisões e próximos passos. As sugestões de aproveitamento, no fim da página, também
            podem ser corrigidas ou descartadas antes da avaliação na Revisão. Ao terminar, clique
            em Salvar alterações.
          </p>
        </div>
      )}
      <FormularioItem
        tipo={def}
        item={item}
        anexosAtuais={anexos}
        decisoesAtuais={decisoes}
        sugestoesAtuais={item.tipo === 'reuniao_projeto' ? sugestoes : undefined}
        onSalvo={(novoId) => navigate(`/item/${novoId}`, { replace: true })}
        onCancelar={() =>
          importada ? navigate(`/item/${item.id}`, { replace: true }) : navigate(-1)
        }
      />
    </div>
  )
}

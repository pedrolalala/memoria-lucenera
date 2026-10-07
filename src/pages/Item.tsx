/* Leitura de um item + ações de quem pode editar (SPEC-164). */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import {
  mensagemErro,
  nomesDeUsuarios,
  sb,
  urlsAssinadas,
  type KbAnexo,
  type KbDecisao,
  type KbItem,
  type KbStatus,
  type KbSugestao,
} from '@/lib/kb'
import { CATEGORIA_POR_CHAVE, TIPO_POR_CHAVE, formatarData } from '@/lib/templates'

interface Versao {
  id: string
  alterado_em: string
  alterado_por: string | null
}

export default function Item() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userId, curador } = useAuth()
  const [item, setItem] = useState<KbItem | null | undefined>(undefined)
  const [anexos, setAnexos] = useState<KbAnexo[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const [versoes, setVersoes] = useState<Versao[]>([])
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const [decisoes, setDecisoes] = useState<KbDecisao[]>([])
  const [sugestoes, setSugestoes] = useState<KbSugestao[]>([])

  async function carregar() {
    const [{ data: it }, { data: ax }, { data: vs }, { data: dc }, { data: sg }] =
      await Promise.all([
        sb.from('kb_itens').select('*').eq('id', id).maybeSingle(),
        sb.from('kb_anexos').select('*').eq('item_id', id).order('ordem').order('created_at'),
        sb
          .from('kb_itens_versoes')
          .select('id, alterado_em, alterado_por')
          .eq('item_id', id)
          .order('alterado_em', { ascending: false }),
        sb.from('kb_decisoes').select('*').eq('reuniao_id', id).order('ordem'),
        sb.from('kb_sugestoes').select('*').eq('reuniao_id', id).order('created_at'),
      ])
    setItem((it as KbItem) ?? null)
    setAnexos((ax as KbAnexo[]) ?? [])
    setVersoes((vs as Versao[]) ?? [])
    setDecisoes((dc as KbDecisao[]) ?? [])
    setSugestoes((sg as KbSugestao[]) ?? [])
    if (it) {
      setNomes(
        await nomesDeUsuarios([
          it.autor_id,
          it.atualizado_por,
          ...(vs ?? []).map((v) => v.alterado_por),
        ]),
      )
      setUrls(
        await urlsAssinadas(((ax as KbAnexo[]) ?? []).map((a) => a.storage_path)).catch(() => ({})),
      )
    }
  }

  useEffect(() => {
    setItem(undefined)
    carregar()
  }, [id])

  if (item === undefined)
    return <p className="pt-16 text-center text-muted-foreground">Carregando…</p>
  if (item === null)
    return (
      <div className="pt-16 text-center text-muted-foreground">
        Item não encontrado ou sem permissão de leitura.{' '}
        <Link to="/" className="underline">
          Voltar ao início
        </Link>
      </div>
    )

  const def = TIPO_POR_CHAVE[item.tipo]
  const podeEditar = item.autor_id === userId || curador
  const referencia = ['tecnico', 'comercial', 'operacional'].includes(item.categoria)
  const imagens = anexos.filter((a) => a.tipo_anexo === 'imagem')
  const documentos = anexos.filter((a) => a.tipo_anexo !== 'imagem')

  async function mudarStatus(status: KbStatus, extra: Partial<KbItem> = {}) {
    const { error } = await sb
      .from('kb_itens')
      .update({ status, ...extra })
      .eq('id', item!.id)
    if (error) toast.error(mensagemErro(error))
    else {
      toast.success(
        status === 'arquivado'
          ? 'Item arquivado.'
          : status === 'publicado'
            ? 'Item publicado.'
            : 'Salvo.',
      )
      carregar()
    }
  }

  async function marcarRevisado() {
    const { error } = await sb
      .from('kb_itens')
      .update({ revisado_em: new Date().toISOString() })
      .eq('id', item!.id)
    if (error) toast.error(mensagemErro(error))
    else {
      toast.success('Revisão registrada.')
      carregar()
    }
  }

  return (
    <article className="mx-auto max-w-3xl pt-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> Voltar
      </button>

      <header className="mt-6 border-b border-border pb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Link to={`/buscar?tipo=${item.tipo}`} className="hover:text-foreground">
            {def.singular}
          </Link>
          <span className="mx-2">·</span>
          <Link to={`/buscar?categoria=${item.categoria}`} className="hover:text-foreground">
            {CATEGORIA_POR_CHAVE[item.categoria].nome}
          </Link>
        </div>
        <h1 className="mt-2 font-serif text-4xl leading-tight">{item.titulo}</h1>
        {item.resumo && <p className="mt-3 text-lg text-foreground/75">{item.resumo}</p>}
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {item.data_referencia && (
            <div>
              <dt className="inline">{def.dataRotulo ?? 'Data'}: </dt>
              <dd className="inline text-foreground">{formatarData(item.data_referencia)}</dd>
            </div>
          )}
          {item.project_code && (
            <div>
              <dt className="inline">Projeto: </dt>
              <dd className="inline text-foreground">
                <Link
                  to={`/projeto/${encodeURIComponent(item.project_code)}`}
                  className="underline underline-offset-4"
                >
                  {item.project_code}
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="inline">Registrado por </dt>
            <dd className="inline text-foreground">
              {(item.autor_id && nomes[item.autor_id]) || '—'}
            </dd>
            <span> em {formatarData(item.created_at)}</span>
          </div>
          {item.updated_at !== item.created_at && (
            <div>Atualizado em {formatarData(item.updated_at)}</div>
          )}
          {referencia && item.revisado_em && (
            <div>Revisado em {formatarData(item.revisado_em)}</div>
          )}
          {item.status !== 'publicado' && (
            <div className="rounded-full border border-border px-2.5 text-foreground">
              {item.status === 'rascunho' ? 'Rascunho' : 'Arquivado'}
            </div>
          )}
        </dl>
        {podeEditar && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => navigate(`/item/${item.id}/editar`)}>
              Editar
            </Button>
            {item.status === 'rascunho' && (
              <Button size="sm" variant="outline" onClick={() => mudarStatus('publicado')}>
                Publicar
              </Button>
            )}
            {item.status === 'arquivado' ? (
              <Button size="sm" variant="outline" onClick={() => mudarStatus('publicado')}>
                Restaurar
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => mudarStatus('arquivado')}>
                Arquivar
              </Button>
            )}
            {curador && referencia && item.status === 'publicado' && (
              <Button size="sm" variant="ghost" onClick={marcarRevisado}>
                Marcar como revisado
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="space-y-8 py-8">
        {def.campos.map((c) => {
          // Reunião: decisões estruturadas (vinculadas ao projeto) em vez do texto.
          if (c.tipo === 'decisoes' && decisoes.length > 0) {
            return (
              <section key={c.chave}>
                <h2 className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {c.rotulo}
                </h2>
                <ol className="space-y-2">
                  {decisoes.map((d, i) => (
                    <li key={d.id} className="flex gap-3 text-[17px] leading-relaxed">
                      <span className="text-sm tabular-nums text-muted-foreground">{i + 1}.</span>
                      <div>
                        {d.decisao}
                        {d.excepcional && (
                          <span className="ml-2 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
                            solução excepcional, só para este projeto
                          </span>
                        )}
                        {d.contexto && (
                          <div className="text-sm text-muted-foreground">{d.contexto}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )
          }
          const valor = item.campos?.[c.chave]
          if (!valor) return null
          const exibido =
            c.tipo === 'opcoes'
              ? (c.opcoes?.find((o) => o.valor === valor)?.rotulo ?? valor)
              : valor
          return (
            <section key={c.chave}>
              <h2 className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {c.rotulo}
              </h2>
              <div className="whitespace-pre-line text-[17px] leading-relaxed">{exibido}</div>
            </section>
          )
        })}

        {imagens.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {def.anexosRotulo}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {imagens.map((a) =>
                urls[a.storage_path] ? (
                  <button
                    key={a.id}
                    onClick={() => setAmpliada(urls[a.storage_path])}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={urls[a.storage_path]}
                      alt={a.legenda || a.nome_arquivo}
                      className="aspect-[4/3] w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : null,
              )}
            </div>
          </section>
        )}

        {documentos.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Arquivos
            </h2>
            <ul className="space-y-2">
              {documentos.map((a) => (
                <li key={a.id}>
                  <a
                    href={urls[a.storage_path]}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
                  >
                    <FileText className="h-4 w-4" aria-hidden /> {a.nome_arquivo}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sugestoes.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Sugestões de aproveitamento em outros temas
            </h2>
            <ul className="space-y-1.5 text-sm">
              {sugestoes.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span>{s.titulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {TIPO_POR_CHAVE[s.tipo_destino]?.singular}
                  </span>
                  <span className="text-xs">
                    {s.status === 'pendente' ? (
                      <Link to="/revisao" className="underline underline-offset-4">
                        aguardando revisão
                      </Link>
                    ) : s.status === 'aprovada' && s.item_criado_id ? (
                      <Link
                        to={`/item/${s.item_criado_id}`}
                        className="underline underline-offset-4"
                      >
                        aprovada
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{s.status}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {item.tags.length > 0 && (
          <section className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <Link
                key={t}
                to={`/buscar?q=${encodeURIComponent(t)}`}
                className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {t}
              </Link>
            ))}
          </section>
        )}

        {versoes.length > 0 && (
          <details className="border-t border-border pt-6 text-sm text-muted-foreground">
            <summary className="cursor-pointer">Histórico de alterações ({versoes.length})</summary>
            <ul className="mt-3 space-y-1">
              {versoes.map((v) => (
                <li key={v.id}>
                  {formatarData(v.alterado_em)} ·{' '}
                  {(v.alterado_por && nomes[v.alterado_por]) || 'alteração'}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setAmpliada(null)}
        >
          <img src={ampliada} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </article>
  )
}

/* SPEC-165 — Histórico de um projeto: reuniões em ordem de data e todas as
   decisões vinculadas ao código do projeto. */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sb, type KbDecisao, type KbItem } from '@/lib/kb'
import { TIPO_POR_CHAVE, formatarData } from '@/lib/templates'

type Decisao = KbDecisao & {
  reuniao: { id: string; titulo: string; data_referencia: string | null } | null
}

export default function ProjetoHistorico() {
  const { codigo = '' } = useParams<{ codigo: string }>()
  const [reunioes, setReunioes] = useState<KbItem[] | null>(null)
  const [decisoes, setDecisoes] = useState<Decisao[]>([])
  const [outros, setOutros] = useState<KbItem[]>([])

  useEffect(() => {
    ;(async () => {
      const [r, d, o] = await Promise.all([
        sb
          .from('kb_itens')
          .select('*')
          .eq('project_code', codigo)
          .eq('tipo', 'reuniao_projeto')
          .neq('status', 'arquivado')
          .order('data_referencia', { ascending: false, nullsFirst: false }),
        sb
          .from('kb_decisoes')
          .select('*, reuniao:kb_itens(id, titulo, data_referencia)')
          .eq('project_code', codigo)
          .order('created_at', { ascending: false }),
        sb
          .from('kb_itens')
          .select('*')
          .eq('project_code', codigo)
          .neq('tipo', 'reuniao_projeto')
          .neq('status', 'arquivado')
          .order('updated_at', { ascending: false }),
      ])
      setReunioes((r.data as KbItem[]) ?? [])
      setDecisoes((d.data as Decisao[]) ?? [])
      setOutros((o.data as KbItem[]) ?? [])
    })()
  }, [codigo])

  const ultima = reunioes?.[0]

  return (
    <div className="mx-auto max-w-3xl pt-10">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Histórico do projeto
      </div>
      <h1 className="mt-1 font-serif text-4xl">Projeto {codigo}</h1>

      {reunioes === null ? (
        <p className="mt-8 text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {ultima?.campos?.andamento && (
            <section className="mt-6 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Andamento mais recente · {formatarData(ultima.data_referencia || ultima.created_at)}
              </h2>
              <p className="mt-2 whitespace-pre-line">{ultima.campos.andamento}</p>
              {ultima.campos.acoes && (
                <>
                  <h3 className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Próximos passos
                  </h3>
                  <p className="mt-1 whitespace-pre-line text-sm">{ultima.campos.acoes}</p>
                </>
              )}
            </section>
          )}

          <section className="mt-10">
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Decisões ({decisoes.length})
            </h2>
            {decisoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma decisão registrada para este projeto.
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {decisoes.map((d) => (
                  <li key={d.id} className="py-3">
                    <div>
                      {d.decisao}
                      {d.excepcional && (
                        <span className="ml-2 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
                          solução excepcional
                        </span>
                      )}
                    </div>
                    {d.contexto && (
                      <div className="text-sm text-muted-foreground">{d.contexto}</div>
                    )}
                    {d.reuniao && (
                      <Link
                        to={`/item/${d.reuniao.id}`}
                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {d.reuniao.titulo} ·{' '}
                        {formatarData(d.reuniao.data_referencia || d.created_at)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Reuniões ({reunioes.length})
            </h2>
            {reunioes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma reunião registrada.{' '}
                <Link
                  to="/importar-reuniao"
                  className="text-foreground underline underline-offset-4"
                >
                  Importar reunião
                </Link>
              </p>
            ) : (
              <ol className="space-y-4">
                {reunioes.map((r) => (
                  <li key={r.id}>
                    <div className="text-xs text-muted-foreground">
                      {formatarData(r.data_referencia || r.created_at)}
                    </div>
                    <Link to={`/item/${r.id}`} className="font-serif text-xl hover:underline">
                      {r.titulo}
                    </Link>
                    {r.resumo && <p className="text-sm text-foreground/75">{r.resumo}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {outros.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Outros registros do projeto
              </h2>
              <ul className="space-y-1">
                {outros.map((o) => (
                  <li key={o.id}>
                    <Link to={`/item/${o.id}`} className="hover:underline">
                      {o.titulo}
                    </Link>{' '}
                    <span className="text-xs text-muted-foreground">
                      {TIPO_POR_CHAVE[o.tipo]?.singular}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

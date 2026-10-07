/* Tela inicial (SPEC-164): a busca é a ação dominante; inserir fica visível
   e secundário; atalhos por tema para quem prefere explorar. */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import CaixaBusca from '@/components/CaixaBusca'
import ChipsCategoria from '@/components/ChipsCategoria'
import { sb, type KbItem, type KbTipo } from '@/lib/kb'
import { CATEGORIA_POR_CHAVE, TIPOS, TIPO_POR_CHAVE, formatarData } from '@/lib/templates'

const ATALHOS: KbTipo[] = [
  'regra_material',
  'padrao_projeto',
  'teste_material',
  'procedimento',
  'marca',
  'designer',
  'reuniao_projeto',
  'visita_obra',
  'vivencia_evento',
]

export default function Index() {
  const navigate = useNavigate()
  const [contagem, setContagem] = useState<Partial<Record<KbTipo, number>>>({})
  const [recentes, setRecentes] = useState<
    Pick<KbItem, 'id' | 'tipo' | 'titulo' | 'updated_at' | 'status'>[]
  >([])

  useEffect(() => {
    Promise.all(
      TIPOS.map(async (t) => {
        const { count } = await sb
          .from('kb_itens')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', t.tipo)
          .eq('status', 'publicado')
        return [t.tipo, count ?? 0] as const
      }),
    ).then((pares) => setContagem(Object.fromEntries(pares)))

    sb.from('kb_itens')
      .select('id, tipo, titulo, updated_at, status')
      .neq('status', 'arquivado')
      .order('updated_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setRecentes((data as typeof recentes) ?? []))
  }, [])

  return (
    <div>
      <section className="mx-auto flex max-w-3xl flex-col items-center pb-14 pt-16 text-center sm:pt-24">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          O conhecimento da casa, a uma busca.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Regras de materiais, padrões de projeto, procedimentos e o que aprendemos em cada obra.
        </p>
        <div className="mt-10 w-full">
          <CaixaBusca grande autoFocus />
        </div>
        <div className="mt-5">
          <ChipsCategoria
            centralizado
            categoria={null}
            tipo={null}
            onCategoria={(c) => navigate(c ? `/buscar?categoria=${c}` : '/buscar')}
          />
        </div>
        <Link
          to="/novo"
          className="mt-10 inline-flex items-center gap-2 text-sm text-foreground/80 underline-offset-4 transition hover:text-foreground hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden /> Inserir novo conhecimento
        </Link>
      </section>

      <section className="border-t border-border pt-10">
        <h2 className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Explorar por tema
        </h2>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {ATALHOS.map((tipo) => {
            const t = TIPO_POR_CHAVE[tipo]
            return (
              <Link
                key={tipo}
                to={`/buscar?tipo=${tipo}`}
                className="group flex flex-col gap-1 bg-card p-5 transition hover:bg-muted/60"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-xl">{t.nome}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {contagem[tipo] ?? ''}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">{t.descricao}</span>
                <span className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                  {CATEGORIA_POR_CHAVE[t.categoria].nome}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {recentes.length > 0 && (
        <section className="pt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Atualizados recentemente
            </h2>
            <Link
              to="/buscar"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Ver tudo <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {recentes.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/item/${r.id}`}
                  className="flex items-baseline justify-between gap-4 py-3 transition hover:text-foreground/70"
                >
                  <span className="truncate">
                    {r.titulo}
                    {r.status === 'rascunho' && (
                      <span className="ml-2 text-xs text-muted-foreground">(rascunho)</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {TIPO_POR_CHAVE[r.tipo]?.singular} · {formatarData(r.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

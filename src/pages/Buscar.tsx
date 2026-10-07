/* Resultados da busca (SPEC-164). Estado inteiro na URL (?q=&categoria=&tipo=)
   para que qualquer busca possa ser compartilhada por link. */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CaixaBusca from '@/components/CaixaBusca'
import ChipsCategoria from '@/components/ChipsCategoria'
import Destaque, { termosDaBusca } from '@/components/Destaque'
import { buscar, mensagemErro, type KbCategoria, type KbResultado, type KbTipo } from '@/lib/kb'
import { CATEGORIA_POR_CHAVE, TIPO_POR_CHAVE, formatarData } from '@/lib/templates'

export default function Buscar() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tipo = (params.get('tipo') as KbTipo) || null
  const categoria =
    (params.get('categoria') as KbCategoria) ||
    (tipo ? TIPO_POR_CHAVE[tipo]?.categoria : null) ||
    null

  const [resultados, setResultados] = useState<KbResultado[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setErro('')
    buscar({ q, categoria, tipo })
      .then((r) => ativo && setResultados(r))
      .catch((e) => ativo && (setErro(mensagemErro(e)), setResultados([])))
    return () => {
      ativo = false
    }
  }, [q, categoria, tipo])

  function atualizar(novo: { categoria?: KbCategoria | null; tipo?: KbTipo | null }) {
    const p = new URLSearchParams(params)
    if ('categoria' in novo) {
      p.delete('tipo')
      if (novo.categoria) p.set('categoria', novo.categoria)
      else p.delete('categoria')
    }
    if ('tipo' in novo) {
      if (novo.tipo) p.set('tipo', novo.tipo)
      else p.delete('tipo')
    }
    setParams(p, { replace: true })
  }

  const termos = termosDaBusca(q)
  const aproximado = resultados?.some((r) => r.aproximado)
  const titulo = tipo
    ? TIPO_POR_CHAVE[tipo]?.nome
    : categoria
      ? CATEGORIA_POR_CHAVE[categoria]?.nome
      : null

  return (
    <div className="mx-auto max-w-3xl pt-8">
      <CaixaBusca
        valorInicial={q}
        extras={{ categoria: params.get('categoria'), tipo: params.get('tipo') }}
      />
      <div className="mt-4">
        <ChipsCategoria
          categoria={categoria}
          tipo={tipo}
          onCategoria={(c) => atualizar({ categoria: c })}
          onTipo={(t) => atualizar({ tipo: t })}
        />
      </div>

      <div className="mt-8 text-sm text-muted-foreground">
        {resultados === null
          ? 'Buscando…'
          : erro
            ? `Não foi possível buscar: ${erro}`
            : resultados.length === 0
              ? q
                ? `Nada encontrado para "${q}"${titulo ? ` em ${titulo}` : ''}.`
                : 'Nenhum item neste tema ainda.'
              : aproximado
                ? `Nenhum resultado exato para "${q}". Mostrando resultados aproximados.`
                : q
                  ? `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}${titulo ? ` em ${titulo}` : ''}`
                  : `${titulo ?? 'Todos os itens'} · ${resultados.length}`}
      </div>

      <ol className="mt-4 space-y-7">
        {resultados?.map((r) => (
          <li key={r.id}>
            <div className="text-xs text-muted-foreground">
              {TIPO_POR_CHAVE[r.tipo]?.singular}
              <span className="mx-1.5">·</span>
              {CATEGORIA_POR_CHAVE[r.categoria]?.nome}
              {(r.data_referencia || r.updated_at) && (
                <>
                  <span className="mx-1.5">·</span>
                  {formatarData(r.data_referencia || r.updated_at)}
                </>
              )}
              {r.project_code && (
                <>
                  <span className="mx-1.5">·</span>Projeto {r.project_code}
                </>
              )}
              {r.status === 'rascunho' && (
                <span className="ml-2 rounded-full border border-border px-2 py-0.5">rascunho</span>
              )}
            </div>
            <Link
              to={`/item/${r.id}`}
              className="mt-1 block font-serif text-2xl leading-snug hover:underline hover:underline-offset-4"
            >
              <Destaque texto={r.titulo} termos={termos} />
            </Link>
            {r.trecho && (
              <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground/75">
                <Destaque texto={r.trecho} termos={termos} />
              </p>
            )}
            {r.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.tags.map((t) => (
                  <Link
                    key={t}
                    to={`/buscar?q=${encodeURIComponent(t)}`}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {resultados && resultados.length === 0 && !erro && (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Não encontrou? Esse conhecimento pode estar só na cabeça de alguém.{' '}
          <Link
            to={tipo ? `/novo/${tipo}` : '/novo'}
            className="text-foreground underline underline-offset-4"
          >
            Registre agora
          </Link>
          .
        </div>
      )}
    </div>
  )
}

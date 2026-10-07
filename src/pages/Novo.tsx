/* Passo 1 da inserção: escolher o tipo de conhecimento (SPEC-164). */
import { Link } from 'react-router-dom'
import { CATEGORIAS, tiposDaCategoria } from '@/lib/templates'

export default function Novo() {
  return (
    <div className="mx-auto max-w-4xl pt-12">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Inserir novo conhecimento
      </div>
      <h1 className="mt-2 font-serif text-4xl">O que você quer registrar?</h1>
      <p className="mt-2 text-muted-foreground">
        Cada tipo abre um roteiro próprio. Só o título é obrigatório.
      </p>

      <div className="mt-10 space-y-10">
        {CATEGORIAS.map((c) => (
          <section key={c.chave}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{c.nome}</h2>
              <span className="text-xs text-muted-foreground/70">
                {c.natureza === 'referência' ? 'referência estável' : 'registro contínuo'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tiposDaCategoria(c.chave).map((t) => (
                <Link
                  key={t.tipo}
                  to={`/novo/${t.tipo}`}
                  className="rounded-2xl border border-border bg-card p-5 transition hover:border-foreground/40 hover:shadow-elevation"
                >
                  <div className="font-serif text-xl">{t.singular}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{t.descricao}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

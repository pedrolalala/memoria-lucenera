/* Filtros opcionais por núcleo (e, dentro dele, por tipo). Nunca obrigatórios. */
import { CATEGORIAS, tiposDaCategoria } from '@/lib/templates'
import type { KbCategoria, KbTipo } from '@/lib/kb'
import { cn } from '@/lib/utils'

interface Props {
  categoria: KbCategoria | null
  tipo: KbTipo | null
  onCategoria: (c: KbCategoria | null) => void
  onTipo?: (t: KbTipo | null) => void
  centralizado?: boolean
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm transition',
        ativo
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground/80 hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export default function ChipsCategoria({
  categoria,
  tipo,
  onCategoria,
  onTipo,
  centralizado,
}: Props) {
  return (
    <div className={cn('space-y-2', centralizado && 'flex flex-col items-center')}>
      <div className={cn('flex flex-wrap gap-2', centralizado && 'justify-center')}>
        <Chip ativo={!categoria} onClick={() => onCategoria(null)}>
          Todos
        </Chip>
        {CATEGORIAS.map((c) => (
          <Chip
            key={c.chave}
            ativo={categoria === c.chave}
            onClick={() => onCategoria(categoria === c.chave ? null : c.chave)}
          >
            {c.nome}
          </Chip>
        ))}
      </div>
      {categoria && onTipo && tiposDaCategoria(categoria).length > 1 && (
        <div
          className={cn('flex flex-wrap gap-x-4 gap-y-1 text-sm', centralizado && 'justify-center')}
        >
          {tiposDaCategoria(categoria).map((t) => (
            <button
              key={t.tipo}
              type="button"
              onClick={() => onTipo(tipo === t.tipo ? null : t.tipo)}
              className={cn(
                'underline-offset-4 transition',
                tipo === t.tipo
                  ? 'font-medium text-foreground underline'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* Materiais enviados pela caixa de entrada antiga que nunca viraram
   conhecimento (a interpretação por IA nunca foi implantada). Cada pessoa vê
   só os seus (RLS do app antigo). SPEC-164. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { BUCKET, mensagemErro, sb } from '@/lib/kb'
import { TIPOS, formatarData } from '@/lib/templates'

interface Entrada {
  id: string
  title: string | null
  raw_text: string | null
  submitted_at: string
  arquivo: { storage_path: string; original_filename: string } | null
}

export default function Pendentes() {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null)
  const [tipoEscolhido, setTipoEscolhido] = useState<Record<string, string>>({})

  async function carregar() {
    const { data } = await sb
      .from('inbox_items')
      .select('id, title, raw_text, submitted_at, arquivo:files(storage_path, original_filename)')
      .in('processing_status', ['new', 'processing', 'awaiting_review', 'failed'])
      .order('submitted_at', { ascending: false })
    setEntradas((data as unknown as Entrada[]) ?? [])
  }

  useEffect(() => {
    carregar()
  }, [])

  async function baixar(e: Entrada) {
    if (!e.arquivo) return
    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(e.arquivo.storage_path, 600)
    if (error) toast.error(mensagemErro(error))
    else window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function descartar(e: Entrada) {
    const { error } = await sb
      .from('inbox_items')
      .update({ processing_status: 'rejected' })
      .eq('id', e.id)
    if (error) toast.error(mensagemErro(error))
    else {
      toast.success('Material descartado da lista.')
      carregar()
    }
  }

  return (
    <div className="mx-auto max-w-3xl pt-10">
      <h1 className="font-serif text-4xl">Pendentes de classificação</h1>
      <p className="mt-2 text-muted-foreground">
        Materiais enviados na versão anterior do sistema. Escolha o tipo e registre: o texto e o
        arquivo original vêm junto.
      </p>
      {entradas === null ? (
        <p className="mt-10 text-muted-foreground">Carregando…</p>
      ) : entradas.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          Nada pendente.{' '}
          <Link to="/" className="underline">
            Voltar ao início
          </Link>
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {entradas.map((e) => {
            const tipo = tipoEscolhido[e.id] ?? 'reuniao_projeto'
            return (
              <li key={e.id} className="space-y-3 py-5">
                <div>
                  <div className="font-serif text-xl">
                    {e.title || e.arquivo?.original_filename || 'Sem título'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Enviado em {formatarData(e.submitted_at)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={tipo}
                    onChange={(ev) => setTipoEscolhido((t) => ({ ...t, [e.id]: ev.target.value }))}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    aria-label="Tipo de conhecimento"
                  >
                    {TIPOS.map((t) => (
                      <option key={t.tipo} value={t.tipo}>
                        {t.singular}
                      </option>
                    ))}
                  </select>
                  <Button asChild size="sm">
                    <Link to={`/novo/${tipo}?pendente=${e.id}`}>Registrar</Link>
                  </Button>
                  {e.arquivo && (
                    <Button size="sm" variant="outline" onClick={() => baixar(e)}>
                      Abrir arquivo
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => descartar(e)}>
                    Descartar
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

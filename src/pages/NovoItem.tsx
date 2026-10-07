/* Passo 2 da inserção: template do tipo escolhido (SPEC-164).
   Com ?pendente=<id>, pré-preenche a partir de um material antigo da caixa de
   entrada. Em "Reunião de projeto" a importação da ata/transcrição fica no
   topo da própria página (SPEC-165) e o preenchimento manual logo abaixo. */
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import FormularioItem, { type Preenchimento } from '@/components/FormularioItem'
import ImportadorReuniao, { codigoProjetoDoNome } from '@/components/ImportadorReuniao'
import { BUCKET, sb, type KbTipo, type PropostaReuniao } from '@/lib/kb'
import { CATEGORIA_POR_CHAVE, TIPO_POR_CHAVE } from '@/lib/templates'

const LIMITE_TEXTO = 1024 * 1024

async function preenchimentoDoPendente(id: string, tipo: KbTipo): Promise<Preenchimento> {
  const { data: entrada } = await sb
    .from('inbox_items')
    .select('*, arquivo:files(*)')
    .eq('id', id)
    .single()
  if (!entrada) return {}
  const arquivo = entrada.arquivo as {
    storage_path: string
    original_filename: string
    mime_type: string
  } | null
  const nomeBase = (entrada.title || arquivo?.original_filename || '').replace(
    /\.[a-z0-9]{2,4}$/i,
    '',
  )
  const p: Preenchimento = {
    titulo: nomeBase.replace(/\s*Recapitula[cç][aã]o\s*$/i, '').trim(),
    data_referencia: (entrada.submitted_at || '').slice(0, 10),
    project_code: entrada.project_code || codigoProjetoDoNome(nomeBase),
    campos: {},
  }
  const campoPrincipal = TIPO_POR_CHAVE[tipo].campos.find((c) => c.tipo === 'textoLongo')?.chave
  const textos: string[] = []
  if (arquivo?.storage_path) {
    const { data: blob } = await sb.storage.from(BUCKET).download(arquivo.storage_path)
    if (blob) {
      p.arquivo = { blob, nome: arquivo.original_filename }
      if ((arquivo.mime_type || '').startsWith('text/') && blob.size <= LIMITE_TEXTO)
        textos.push((await blob.text()).trim())
    }
  }
  if (entrada.raw_text) textos.push(String(entrada.raw_text).trim())
  if (campoPrincipal && textos.length) p.campos![campoPrincipal] = textos.join('\n\n')
  return p
}

/** SPEC-165: proposta da interpretação (sem código de projeto) -> formulário. */
function preenchimentoDaProposta(p: PropostaReuniao, arquivo: File | null): Preenchimento {
  return {
    titulo: p.titulo,
    resumo: p.resumo,
    data_referencia: p.data_reuniao ?? undefined,
    project_code: p.project_code ?? undefined,
    campos: {
      participantes: p.participantes,
      andamento: p.andamento,
      pauta: p.pauta,
      pendencias: p.pendencias,
      acoes: p.proximos_passos,
    },
    decisoes: p.decisoes.map((d) => ({
      decisao: d.decisao,
      contexto: d.contexto ?? '',
      excepcional: d.excepcional,
    })),
    sugestoes: p.sugestoes,
    arquivo: arquivo ? { blob: arquivo, nome: arquivo.name } : undefined,
  }
}

interface EstadoImportacao {
  proposta?: PropostaReuniao
  arquivo?: File | null
  pendente?: string | null
}

export default function NovoItem() {
  const { tipo } = useParams<{ tipo: KbTipo }>()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const def = tipo ? TIPO_POR_CHAVE[tipo] : undefined
  const importacao = (location.state ?? {}) as EstadoImportacao
  const pendente = params.get('pendente') ?? importacao.pendente ?? null
  const ehReuniao = def?.tipo === 'reuniao_projeto'
  // Em reunião, o material pendente vai para o importador (interpretação), não para o formulário.
  const pendenteNoFormulario = pendente && !ehReuniao && !importacao.proposta ? pendente : null
  const [carregado, setCarregado] = useState<Preenchimento | null>(pendenteNoFormulario ? null : {})

  useEffect(() => {
    if (pendenteNoFormulario && def)
      preenchimentoDoPendente(pendenteNoFormulario, def.tipo)
        .then(setCarregado)
        .catch(() => setCarregado({}))
  }, [pendenteNoFormulario, def])

  const preenchimento = useMemo(
    () =>
      importacao.proposta
        ? preenchimentoDaProposta(importacao.proposta, importacao.arquivo ?? null)
        : carregado,
    [importacao.proposta, importacao.arquivo, carregado],
  )

  if (!def) {
    return (
      <div className="pt-16 text-center text-muted-foreground">
        Tipo de conhecimento desconhecido.{' '}
        <Link to="/novo" className="underline">
          Escolher outro
        </Link>
      </div>
    )
  }

  async function aoSalvar(id: string) {
    if (pendente) {
      await sb
        .from('inbox_items')
        .update({ processing_status: 'approved', metadata: { kb_item_id: id } })
        .eq('id', pendente)
    }
    navigate(`/item/${id}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl pt-10">
      <Link
        to="/novo"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> Tipos de conhecimento
      </Link>
      <div className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {CATEGORIA_POR_CHAVE[def.categoria].nome}
      </div>
      <h1 className="mt-1 font-serif text-4xl">{def.singular}</h1>
      <p className="mb-8 mt-2 text-muted-foreground">{def.descricao}</p>

      {ehReuniao && !importacao.proposta && (
        <>
          <ImportadorReuniao pendente={pendente} />
          <div className="my-10 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou registre manualmente{' '}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      {importacao.proposta && (
        <p className="mb-8 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          Reunião interpretada, mas sem código de projeto identificado. Informe o código, confira e
          publique.
        </p>
      )}

      {preenchimento === null ? (
        <p className="text-muted-foreground">Carregando material…</p>
      ) : (
        <FormularioItem
          key={location.key}
          tipo={def}
          preenchimento={preenchimento}
          onSalvo={aoSalvar}
          onCancelar={() => navigate(-1)}
        />
      )}
    </div>
  )
}

/* SPEC-165 — Importação de reunião, dentro do próprio "Reunião de projeto".
   O texto (colado ou .txt/.md/.docx) é interpretado no servidor e a reunião
   vai direto para o histórico do projeto; em seguida abre a edição para a
   pessoa corrigir o que a IA preparou, inclusive as sugestões (que só entram
   nos temas depois de aprovadas na Revisão). Sem código de projeto, o
   formulário da página é preenchido com a proposta para completar. */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { BUCKET, arquivoParaBase64, interpretarReuniao, mensagemErro, sb } from '@/lib/kb'
import { registrarReuniaoImportada } from '@/lib/reuniao'

const LIMITE_BYTES = 15 * 1024 * 1024

/** "Alinhamentos com Luiz - 26_255 Recapitulação.txt" -> "26.255" */
export function codigoProjetoDoNome(nome: string) {
  const m = nome.match(/\b(\d{2})[._](\d{3})\b/)
  return m ? `${m[1]}.${m[2]}` : ''
}

export default function ImportadorReuniao({ pendente }: { pendente: string | null }) {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [projeto, setProjeto] = useState('')
  const [trabalhando, setTrabalhando] = useState(false)
  const [carregandoPendente, setCarregandoPendente] = useState(Boolean(pendente))

  // Material antigo da caixa de entrada: carrega o arquivo original.
  useEffect(() => {
    if (!pendente) return
    ;(async () => {
      try {
        const { data: entrada } = await sb
          .from('inbox_items')
          .select('*, arquivo:files(*)')
          .eq('id', pendente)
          .single()
        const arq = entrada?.arquivo as {
          storage_path: string
          original_filename: string
          mime_type: string
        } | null
        if (entrada?.project_code) setProjeto(entrada.project_code)
        else setProjeto(codigoProjetoDoNome(entrada?.title || arq?.original_filename || ''))
        if (arq?.storage_path) {
          const { data: blob } = await sb.storage.from(BUCKET).download(arq.storage_path)
          if (blob)
            setArquivo(
              new File([blob], arq.original_filename, { type: arq.mime_type || blob.type }),
            )
        }
        if (entrada?.raw_text) setTexto(String(entrada.raw_text))
      } finally {
        setCarregandoPendente(false)
      }
    })()
  }, [pendente])

  function escolher(f: File | undefined) {
    if (!f) return
    if (f.size > LIMITE_BYTES) return toast.error('Arquivo acima de 15 MB.')
    if (!/\.(txt|md|docx)$/i.test(f.name))
      return toast.error('Use .txt, .md ou .docx (ou cole o texto).')
    setArquivo(f)
    if (!projeto) setProjeto(codigoProjetoDoNome(f.name))
  }

  async function importar() {
    if (!texto.trim() && !arquivo)
      return toast.error('Cole o texto da reunião ou escolha um arquivo.')
    setTrabalhando(true)
    try {
      let entrada: Parameters<typeof interpretarReuniao>[0]
      if (arquivo && /\.docx$/i.test(arquivo.name)) {
        entrada = { arquivo_base64: await arquivoParaBase64(arquivo), nome_arquivo: arquivo.name }
      } else {
        const doArquivo = arquivo ? await arquivo.text() : ''
        entrada = {
          texto: [doArquivo, texto].filter((t) => t.trim()).join('\n\n'),
          nome_arquivo: arquivo?.name,
        }
      }
      if (projeto.trim()) entrada.project_code = projeto.trim()
      const proposta = await interpretarReuniao(entrada)
      if (proposta.texto_truncado) toast.info('Texto muito longo: só o início foi interpretado.')
      const codigo = (proposta.project_code || projeto).trim()
      if (!codigo || !userId) {
        // Sem código do projeto não há histórico onde registrar: completa no formulário abaixo.
        toast.info(
          'Não foi possível identificar o código do projeto. Informe-o no formulário e publique.',
        )
        navigate('/novo/reuniao_projeto', { state: { proposta, arquivo, pendente } })
        setTrabalhando(false)
        return
      }
      // A reunião vai direto para o histórico do projeto; em seguida, edição para correções.
      const r = await registrarReuniaoImportada(proposta, codigo, userId, arquivo)
      if (pendente) {
        await sb
          .from('inbox_items')
          .update({ processing_status: 'approved', metadata: { kb_item_id: r.id } })
          .eq('id', pendente)
      }
      if (r.falhaAnexo) toast.error('Não foi possível anexar o arquivo original.')
      window.dispatchEvent(new Event('kb:revisao-mudou'))
      navigate(`/item/${r.id}/editar?importada=1`, { replace: true })
    } catch (e) {
      toast.error(mensagemErro(e))
      setTrabalhando(false)
    }
  }

  if (carregandoPendente) return <p className="text-muted-foreground">Carregando material…</p>

  return (
    <section className="space-y-5 rounded-2xl border border-[hsl(var(--luz-forte))]/60 bg-card p-5">
      <div>
        <h2 className="font-serif text-2xl">Importar a ata ou transcrição</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O sistema lê a reunião e registra no histórico do projeto: resumo, andamento, decisões e
          próximos passos. Em seguida você revisa e corrige o que for preciso. O que puder virar
          conhecimento geral vai para a Revisão e só entra nos temas depois de aprovado.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        <div className="space-y-2">
          <Label htmlFor="imp-projeto">Código do projeto</Label>
          <Input
            id="imp-projeto"
            value={projeto}
            onChange={(e) => setProjeto(e.target.value)}
            placeholder="Ex.: 26.181"
          />
        </div>
        <div className="space-y-2">
          <Label>Arquivo</Label>
          {arquivo ? (
            <div className="flex h-10 items-center gap-3 rounded-md border border-border px-3 text-sm">
              <span className="flex-1 truncate">{arquivo.name}</span>
              <button
                type="button"
                onClick={() => setArquivo(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                Remover
              </button>
            </div>
          ) : (
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground transition hover:border-foreground/40 hover:text-foreground">
              <Paperclip className="h-4 w-4" aria-hidden /> Escolher .txt, .md ou .docx
              <input
                type="file"
                accept=".txt,.md,.docx"
                className="sr-only"
                onChange={(e) => escolher(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="imp-texto">
          {arquivo ? 'Observações adicionais (opcional)' : 'Ou cole o texto da reunião'}
        </Label>
        <Textarea
          id="imp-texto"
          rows={arquivo ? 2 : 6}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <Button type="button" onClick={importar} disabled={trabalhando}>
        {trabalhando
          ? 'Interpretando e registrando… (pode levar até dois minutos)'
          : 'Importar reunião'}
      </Button>
    </section>
  )
}

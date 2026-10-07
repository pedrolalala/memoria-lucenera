/* Formulário guiado por tipo (SPEC-164). Mostra só os campos do template do
   tipo escolhido; apenas o título é obrigatório. Ctrl+Enter publica. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  anexarArquivo,
  decisoesComoTexto,
  enviarSugestoes,
  mensagemErro,
  removerAnexo,
  salvarDecisoes,
  sb,
  urlsAssinadas,
  type DecisaoRascunho,
  type KbAnexo,
  type KbDecisao,
  type KbItem,
  type KbStatus,
  type KbSugestao,
  type SugestaoProposta,
} from '@/lib/kb'
import { TIPO_POR_CHAVE, hojeISO, type TipoDef } from '@/lib/templates'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const LIMITE_BYTES = 25 * 1024 * 1024
const ACEITOS = 'image/jpeg,image/png,image/webp,image/heic,application/pdf'
// Referência fixa: um `= []` no parâmetro criaria um array novo a cada render,
// e o efeito das prévias (que depende dele) entraria em loop infinito,
// travando o formulário de item novo.
const SEM_ANEXOS: KbAnexo[] = []

export interface Preenchimento {
  titulo?: string
  resumo?: string
  data_referencia?: string
  project_code?: string
  campos?: Record<string, string>
  tags?: string[]
  /** Arquivo a anexar automaticamente ao salvar (ex.: vindo dos pendentes antigos). */
  arquivo?: { blob: Blob; nome: string }
  /** SPEC-165: decisões e sugestões propostas pela interpretação da reunião. */
  decisoes?: DecisaoRascunho[]
  sugestoes?: SugestaoProposta[]
}

interface Props {
  tipo: TipoDef
  item?: KbItem
  anexosAtuais?: KbAnexo[]
  decisoesAtuais?: KbDecisao[]
  /** SPEC-165: sugestões já enviadas e ainda pendentes (corrigíveis antes da revisão). */
  sugestoesAtuais?: KbSugestao[]
  preenchimento?: Preenchimento
  onSalvo: (id: string) => void
  onCancelar: () => void
}

// Decisão no formulário com chave local estável (as sugestões apontam para ela
// mesmo que a pessoa remova ou reordene outras decisões).
type DecisaoEditavel = DecisaoRascunho & { chave: string }
type SugestaoEditavel = Omit<SugestaoProposta, 'indice_decisao'> & {
  chave: string
  /** Presente quando a sugestão já está na fila (pendente). */
  id?: string
  chaveDecisao: string | null
}

function EditorSugestoes({
  valor,
  onChange,
  bloqueada,
}: {
  valor: SugestaoEditavel[]
  onChange: (v: SugestaoEditavel[]) => void
  bloqueada: (s: SugestaoEditavel) => boolean
}) {
  const atualizar = (chave: string, parcial: Partial<SugestaoEditavel>) =>
    onChange(valor.map((s) => (s.chave === chave ? { ...s, ...parcial } : s)))
  return (
    <ul className="space-y-4">
      {valor.map((s) => {
        const destino = TIPO_POR_CHAVE[s.tipo_destino]
        return (
          <li
            key={s.chave}
            className={cn('space-y-3 rounded-lg bg-card p-4 text-sm', bloqueada(s) && 'opacity-50')}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Sugestão para {destino?.nome}
              </span>
              <button
                type="button"
                onClick={() => onChange(valor.filter((x) => x.chave !== s.chave))}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Descartar
              </button>
            </div>
            {bloqueada(s) && (
              <p className="text-xs">
                Não será enviada: a decisão de origem foi marcada como solução excepcional.
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{destino?.tituloRotulo ?? 'Título'}</Label>
              <Input
                aria-label="Título da sugestão"
                value={s.titulo}
                onChange={(e) => atualizar(s.chave, { titulo: e.target.value })}
              />
            </div>
            {destino?.campos
              .filter((c) => c.tipo !== 'decisoes')
              .map((c) => (
                <div key={c.chave} className="space-y-1">
                  <Label className="text-xs">{c.rotulo}</Label>
                  {c.tipo === 'opcoes' ? (
                    <select
                      value={s.campos[c.chave] ?? ''}
                      onChange={(e) =>
                        atualizar(s.chave, { campos: { ...s.campos, [c.chave]: e.target.value } })
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">—</option>
                      {c.opcoes!.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  ) : c.tipo === 'texto' ? (
                    <Input
                      value={s.campos[c.chave] ?? ''}
                      onChange={(e) =>
                        atualizar(s.chave, { campos: { ...s.campos, [c.chave]: e.target.value } })
                      }
                    />
                  ) : (
                    <AutoTextarea
                      linhas={2}
                      value={s.campos[c.chave] ?? ''}
                      onChange={(e) =>
                        atualizar(s.chave, { campos: { ...s.campos, [c.chave]: e.target.value } })
                      }
                    />
                  )}
                </div>
              ))}
            <div className="space-y-1">
              <Label className="text-xs">Por que é reaproveitável</Label>
              <AutoTextarea
                linhas={1}
                value={s.justificativa}
                onChange={(e) => atualizar(s.chave, { justificativa: e.target.value })}
              />
            </div>
            {s.trecho_origem && (
              <blockquote className="border-l-2 border-[hsl(var(--luz-forte))] pl-3 text-xs italic text-muted-foreground">
                {s.trecho_origem}
              </blockquote>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function EditorDecisoes({
  valor,
  onChange,
}: {
  valor: DecisaoEditavel[]
  onChange: (v: DecisaoEditavel[]) => void
}) {
  const atualizar = (chave: string, parcial: Partial<DecisaoEditavel>) =>
    onChange(valor.map((d) => (d.chave === chave ? { ...d, ...parcial } : d)))
  return (
    <div className="space-y-3">
      {valor.map((d, i) => (
        <div
          key={d.chave}
          className={cn(
            'rounded-lg border border-border bg-card p-3',
            d.excepcional && 'border-dashed',
          )}
        >
          <div className="flex items-start gap-2">
            <span className="pt-2 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
            <div className="flex-1 space-y-2">
              <AutoTextarea
                aria-label={`Decisão ${i + 1}`}
                linhas={1}
                value={d.decisao}
                onChange={(e) => atualizar(d.chave, { decisao: e.target.value })}
                placeholder="O que foi decidido"
              />
              <Input
                aria-label={`Contexto da decisão ${i + 1}`}
                value={d.contexto}
                onChange={(e) => atualizar(d.chave, { contexto: e.target.value })}
                placeholder="Contexto (opcional)"
                className="text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={d.excepcional}
                  onChange={(e) => atualizar(d.chave, { excepcional: e.target.checked })}
                />
                Solução excepcional para este projeto (fica só no histórico, nunca vira padrão)
              </label>
            </div>
            <button
              type="button"
              onClick={() => onChange(valor.filter((x) => x.chave !== d.chave))}
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label={`Remover decisão ${i + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...valor,
            { chave: crypto.randomUUID(), decisao: '', contexto: '', excepcional: false },
          ])
        }
      >
        Adicionar decisão
      </Button>
    </div>
  )
}

function AutoTextarea({
  linhas = 3,
  ...props
}: React.ComponentProps<typeof Textarea> & { linhas?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, linhas * 24 + 18)}px`
  }, [props.value, linhas])
  return (
    <Textarea
      ref={ref}
      rows={linhas}
      {...props}
      className={cn('resize-none leading-6', props.className)}
    />
  )
}

export default function FormularioItem({
  tipo,
  item,
  anexosAtuais = SEM_ANEXOS,
  decisoesAtuais,
  sugestoesAtuais,
  preenchimento,
  onSalvo,
  onCancelar,
}: Props) {
  const { userId } = useAuth()
  const [titulo, setTitulo] = useState(item?.titulo ?? preenchimento?.titulo ?? '')
  const [resumo, setResumo] = useState(item?.resumo ?? preenchimento?.resumo ?? '')
  const [data, setData] = useState(
    item?.data_referencia ??
      preenchimento?.data_referencia ??
      (tipo.dataRotulo && !item ? hojeISO() : ''),
  )
  const [projeto, setProjeto] = useState(item?.project_code ?? preenchimento?.project_code ?? '')
  const [campos, setCampos] = useState<Record<string, string>>({
    ...(preenchimento?.campos ?? {}),
    ...(item?.campos ?? {}),
  })
  const [tags, setTags] = useState<string[]>(item?.tags ?? preenchimento?.tags ?? [])
  const temDecisoes = tipo.campos.some((c) => c.tipo === 'decisoes')
  const [decisoes, setDecisoes] = useState<DecisaoEditavel[]>(() =>
    decisoesAtuais
      ? decisoesAtuais.map((d) => ({
          chave: d.id,
          decisao: d.decisao,
          contexto: d.contexto ?? '',
          excepcional: d.excepcional,
        }))
      : (preenchimento?.decisoes ?? []).map((d, i) => ({
          chave: `d${i}`,
          decisao: d.decisao,
          contexto: d.contexto ?? '',
          excepcional: d.excepcional,
        })),
  )
  const [sugestoes, setSugestoes] = useState<SugestaoEditavel[]>(() =>
    sugestoesAtuais
      ? sugestoesAtuais.map((s) => ({
          chave: s.id,
          id: s.id,
          tipo_destino: s.tipo_destino,
          titulo: s.titulo,
          campos: s.campos ?? {},
          justificativa: s.justificativa ?? '',
          trecho_origem: s.trecho_origem ?? '',
          chaveDecisao: s.decisao_id,
        }))
      : (preenchimento?.sugestoes ?? []).map(({ indice_decisao, ...s }, i) => ({
          ...s,
          chave: `s${i}`,
          chaveDecisao: indice_decisao !== null ? `d${indice_decisao}` : null,
        })),
  )
  // Sugestão apoiada numa decisão marcada como excepcional nunca é enviada.
  const bloqueada = (s: SugestaoEditavel) =>
    s.chaveDecisao !== null && decisoes.some((d) => d.chave === s.chaveDecisao && d.excepcional)
  const [tagDigitada, setTagDigitada] = useState('')
  const [novos, setNovos] = useState<File[]>([])
  const [remover, setRemover] = useState<string[]>([])
  const [previas, setPrevias] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [erroTitulo, setErroTitulo] = useState(false)

  useEffect(() => {
    const caminhos = anexosAtuais
      .filter((a) => a.tipo_anexo === 'imagem')
      .map((a) => a.storage_path)
    if (!caminhos.length) return
    urlsAssinadas(caminhos)
      .then(setPrevias)
      .catch(() => undefined)
  }, [anexosAtuais])

  const urlsNovos = useMemo(
    () => novos.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : '')),
    [novos],
  )
  useEffect(() => () => urlsNovos.forEach((u) => u && URL.revokeObjectURL(u)), [urlsNovos])

  function adicionarTag(valor: string) {
    const partes = valor
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (!partes.length) return
    setTags((atual) => {
      const vistos = new Set(atual.map((t) => t.toLowerCase()))
      return [...atual, ...partes.filter((t) => !vistos.has(t.toLowerCase()))]
    })
    setTagDigitada('')
  }

  function escolherArquivos(lista: FileList | null) {
    if (!lista) return
    const validos: File[] = []
    for (const f of Array.from(lista)) {
      if (f.size > LIMITE_BYTES) toast.error(`${f.name} passa de 25 MB.`)
      else validos.push(f)
    }
    setNovos((n) => [...n, ...validos])
  }

  async function salvar(status: KbStatus) {
    if (!titulo.trim()) {
      setErroTitulo(true)
      document.getElementById('titulo')?.focus()
      return
    }
    if (!userId) return
    const decisoesValidas = decisoes.filter((d) => d.decisao.trim())
    if (temDecisoes && decisoesValidas.length && !projeto.trim()) {
      toast.error('Informe o código do projeto: toda decisão fica vinculada ao projeto discutido.')
      document.getElementById('projeto')?.focus()
      return
    }
    setSalvando(true)
    const camposLimpos = Object.fromEntries(
      tipo.campos
        .map((c) => [
          c.chave,
          c.tipo === 'decisoes'
            ? decisoesComoTexto(decisoesValidas)
            : (campos[c.chave] ?? '').trim(),
        ])
        .filter(([, v]) => v !== ''),
    )
    const pendenteTag = tagDigitada.trim() ? [tagDigitada.trim()] : []
    const registro = {
      tipo: tipo.tipo,
      titulo: titulo.trim(),
      resumo: resumo.trim() || null,
      campos: camposLimpos,
      tags: [...tags, ...pendenteTag],
      data_referencia: tipo.dataRotulo ? data || null : null,
      project_code: projeto.trim() || null,
      status,
    }
    try {
      let id = item?.id
      if (item) {
        const { error } = await sb.from('kb_itens').update(registro).eq('id', item.id)
        if (error) throw error
      } else {
        const { data: novo, error } = await sb
          .from('kb_itens')
          .insert({ ...registro, autor_id: userId })
          .select('id')
          .single()
        if (error) throw error
        id = novo.id
      }
      if (temDecisoes) {
        // Sugestões já na fila que foram descartadas ou ficaram apoiadas em decisão
        // excepcional saem da fila antes de regravar as decisões.
        const manter = new Set(sugestoes.filter((s) => s.id && !bloqueada(s)).map((s) => s.id!))
        const retirar = (sugestoesAtuais ?? []).filter((s) => !manter.has(s.id)).map((s) => s.id)
        if (retirar.length) {
          const { error: errRet } = await sb.from('kb_sugestoes').delete().in('id', retirar)
          if (errRet) throw errRet
        }
        const idsPorOrdem = await salvarDecisoes(id!, projeto.trim(), decisoesValidas)
        const novoIdDecisao = (chaveDecisao: string | null) => {
          const ordem = decisoesValidas.findIndex((d) => d.chave === chaveDecisao)
          return ordem >= 0 ? (idsPorOrdem.get(ordem) ?? null) : null
        }
        // Correções nas sugestões pendentes.
        for (const s of sugestoes.filter((x) => x.id && manter.has(x.id))) {
          const { error: errUpd } = await sb
            .from('kb_sugestoes')
            .update({
              titulo: s.titulo.trim() || '(sem título)',
              campos: Object.fromEntries(
                Object.entries(s.campos).filter(([, v]) => v && String(v).trim()),
              ),
              justificativa: s.justificativa.trim() || null,
              decisao_id: novoIdDecisao(s.chaveDecisao),
            })
            .eq('id', s.id!)
          if (errUpd) throw errUpd
        }
        // Sugestões novas (ainda não enviadas).
        const enviar = sugestoes.filter((s) => !s.id && !bloqueada(s))
        const idPorPosicao = new Map<number, string>()
        enviar.forEach((s, i) => {
          const d = novoIdDecisao(s.chaveDecisao)
          if (d) idPorPosicao.set(i, d)
        })
        await enviarSugestoes(
          id!,
          enviar.map((s, i) => ({
            ...s,
            titulo: s.titulo.trim() || '(sem título)',
            indice_decisao: idPorPosicao.has(i) ? i : null,
          })),
          idPorPosicao,
          userId,
        )
        if (enviar.length)
          toast.info(`${enviar.length} sugestão(ões) enviada(s) para a fila de revisão.`)
        if (retirar.length) window.dispatchEvent(new Event('kb:revisao-mudou'))
      }
      const falhas: string[] = []
      for (const a of anexosAtuais.filter((a) => remover.includes(a.id))) {
        await removerAnexo(a).catch(() => falhas.push(a.nome_arquivo))
      }
      const envios: { blob: Blob; nome: string }[] = novos.map((f) => ({ blob: f, nome: f.name }))
      if (preenchimento?.arquivo) envios.push(preenchimento.arquivo)
      for (const e of envios) {
        await anexarArquivo(id!, e.blob, e.nome, userId).catch(() => falhas.push(e.nome))
      }
      if (falhas.length) toast.error(`Salvo, mas não foi possível processar: ${falhas.join(', ')}`)
      else
        toast.success(
          status === 'rascunho'
            ? 'Rascunho salvo.'
            : item
              ? 'Alterações salvas.'
              : 'Conhecimento publicado.',
        )
      onSalvo(id!)
    } catch (e) {
      toast.error(`Não foi possível salvar: ${mensagemErro(e)}`)
      setSalvando(false)
    }
  }

  const statusAoPublicar: KbStatus = item?.status === 'arquivado' ? 'arquivado' : 'publicado'

  return (
    <form
      className="space-y-7"
      onSubmit={(e) => {
        e.preventDefault()
        salvar(statusAoPublicar)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          salvar(statusAoPublicar)
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="titulo" className="text-sm">
          {tipo.tituloRotulo}
        </Label>
        <Input
          id="titulo"
          autoFocus={!item}
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value)
            setErroTitulo(false)
          }}
          placeholder={tipo.tituloExemplo}
          className={cn('h-12 font-serif text-xl', erroTitulo && 'border-destructive')}
        />
        {erroTitulo && (
          <p className="text-sm text-destructive">Dê um título para encontrar este item depois.</p>
        )}
      </div>

      {(tipo.dataRotulo || tipo.usaProjeto) && (
        <div className="grid gap-5 sm:grid-cols-2">
          {tipo.dataRotulo && (
            <div className="space-y-2">
              <Label htmlFor="data">{tipo.dataRotulo}</Label>
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          )}
          {tipo.usaProjeto && (
            <div className="space-y-2">
              <Label htmlFor="projeto">Código do projeto</Label>
              <Input
                id="projeto"
                value={projeto}
                onChange={(e) => setProjeto(e.target.value)}
                placeholder="Ex.: 26.181"
              />
            </div>
          )}
        </div>
      )}

      {temDecisoes && (
        // Reunião: o resumo é o que mais se consulta no histórico, fica no topo.
        <div className="space-y-2">
          <Label htmlFor="resumo">Resumo da reunião</Label>
          <AutoTextarea
            id="resumo"
            linhas={3}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
          />
        </div>
      )}

      {tipo.campos.map((c) => (
        <div key={c.chave} className="space-y-2">
          <Label htmlFor={`campo-${c.chave}`}>{c.rotulo}</Label>
          {c.tipo === 'decisoes' ? (
            <EditorDecisoes valor={decisoes} onChange={setDecisoes} />
          ) : c.tipo === 'opcoes' ? (
            <div className="flex flex-wrap gap-2">
              {c.opcoes!.map((o) => (
                <button
                  type="button"
                  key={o.valor}
                  aria-pressed={campos[c.chave] === o.valor}
                  onClick={() =>
                    setCampos((v) => ({ ...v, [c.chave]: v[c.chave] === o.valor ? '' : o.valor }))
                  }
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm transition',
                    campos[c.chave] === o.valor
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:border-foreground/40',
                  )}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
          ) : c.tipo === 'texto' ? (
            <Input
              id={`campo-${c.chave}`}
              value={campos[c.chave] ?? ''}
              onChange={(e) => setCampos((v) => ({ ...v, [c.chave]: e.target.value }))}
            />
          ) : (
            <AutoTextarea
              id={`campo-${c.chave}`}
              linhas={c.linhas ?? 3}
              value={campos[c.chave] ?? ''}
              onChange={(e) => setCampos((v) => ({ ...v, [c.chave]: e.target.value }))}
            />
          )}
          {c.ajuda && <p className="text-xs text-muted-foreground">{c.ajuda}</p>}
        </div>
      ))}

      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          {tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm"
            >
              {t}
              <button
                type="button"
                onClick={() => setTags((a) => a.filter((x) => x !== t))}
                aria-label={`Remover ${t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id="tags"
            value={tagDigitada}
            onChange={(e) =>
              e.target.value.endsWith(',')
                ? adicionarTag(e.target.value)
                : setTagDigitada(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && tagDigitada.trim()) {
                e.preventDefault()
                adicionarTag(tagDigitada)
              } else if (e.key === 'Backspace' && !tagDigitada && tags.length) {
                setTags((a) => a.slice(0, -1))
              }
            }}
            onBlur={() => adicionarTag(tagDigitada)}
            placeholder={tags.length ? '' : 'Ex.: fita LED, sanca, 2700K'}
            className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">Enter ou vírgula para separar.</p>
      </div>

      <div className="space-y-3">
        <Label>{tipo.anexosRotulo}</Label>
        {(anexosAtuais.length > 0 || novos.length > 0 || preenchimento?.arquivo) && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {anexosAtuais.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'relative overflow-hidden rounded-lg border border-border text-xs',
                  remover.includes(a.id) && 'opacity-40',
                )}
              >
                {previas[a.storage_path] ? (
                  <img
                    src={previas[a.storage_path]}
                    alt={a.nome_arquivo}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center p-2 text-center text-muted-foreground">
                    {a.nome_arquivo}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setRemover((r) =>
                      r.includes(a.id) ? r.filter((x) => x !== a.id) : [...r, a.id],
                    )
                  }
                  className="absolute right-1 top-1 rounded-full bg-background/90 px-2 py-0.5"
                >
                  {remover.includes(a.id) ? 'Manter' : 'Remover'}
                </button>
              </div>
            ))}
            {novos.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="relative overflow-hidden rounded-lg border border-border text-xs"
              >
                {urlsNovos[i] ? (
                  <img
                    src={urlsNovos[i]}
                    alt={f.name}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center p-2 text-center text-muted-foreground">
                    {f.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setNovos((n) => n.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1"
                  aria-label={`Remover ${f.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {preenchimento?.arquivo && (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border p-2 text-center text-xs text-muted-foreground">
                {preenchimento.arquivo.nome}
                <br />
                (arquivo original)
              </div>
            )}
          </div>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-foreground/40 hover:text-foreground">
          <Paperclip className="h-4 w-4" aria-hidden /> Adicionar imagens ou PDF
          <input
            type="file"
            multiple
            accept={ACEITOS}
            className="sr-only"
            onChange={(e) => escolherArquivos(e.target.files)}
          />
        </label>
      </div>

      {(sugestoes.length > 0 || (sugestoesAtuais?.length ?? 0) > 0) && (
        <section className="space-y-3 rounded-xl border border-[hsl(var(--luz-forte))]/50 bg-[hsl(var(--luz))]/20 p-4">
          <div>
            <h3 className="text-sm font-medium">Sugestões de aproveitamento para outros temas</h3>
            <p className="text-xs text-muted-foreground">
              Nada disso entra automaticamente nos temas: as sugestões ficam na fila de Revisão até
              um curador aprovar ou rejeitar. Corrija o que for preciso ou descarte o que não fizer
              sentido.
            </p>
          </div>
          {sugestoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todas as sugestões foram descartadas.</p>
          ) : (
            <EditorSugestoes valor={sugestoes} onChange={setSugestoes} bloqueada={bloqueada} />
          )}
        </section>
      )}

      {!temDecisoes && (
        <div className="space-y-2">
          <Label htmlFor="resumo">
            Resumo{' '}
            <span className="font-normal text-muted-foreground">
              (opcional, aparece nos resultados da busca)
            </span>
          </Label>
          <Input id="resumo" value={resumo} onChange={(e) => setResumo(e.target.value)} />
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
        <Button type="submit" disabled={salvando}>
          {salvando
            ? 'Salvando…'
            : item
              ? item.status === 'rascunho'
                ? 'Publicar'
                : 'Salvar alterações'
              : 'Publicar'}
        </Button>
        {(!item || item.status === 'rascunho') && (
          <Button
            type="button"
            variant="outline"
            disabled={salvando}
            onClick={() => salvar('rascunho')}
          >
            Salvar como rascunho
          </Button>
        )}
        <Button type="button" variant="ghost" disabled={salvando} onClick={onCancelar}>
          Cancelar
        </Button>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          Ctrl + Enter publica
        </span>
      </div>
    </form>
  )
}

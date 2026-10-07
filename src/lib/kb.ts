/* SPEC-164 — Acesso à base de conhecimento (schema memoria do Supabase).
   Cliente próprio apontando para o schema `memoria`; usa a mesma chave de
   sessão no localStorage que o app antigo (/legado), então o login vale para
   os dois. */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

export const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: 'memoria' },
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
})

export const BUCKET = 'lucenera-memory-files'

export type KbTipo =
  | 'reuniao_projeto'
  | 'visita_obra'
  | 'teste_material'
  | 'regra_material'
  | 'padrao_projeto'
  | 'procedimento'
  | 'marca'
  | 'designer'
  | 'vivencia_evento'

export type KbCategoria = 'tecnico' | 'comercial' | 'operacional' | 'projeto' | 'aprendizado'
export type KbStatus = 'rascunho' | 'publicado' | 'arquivado'

export interface KbItem {
  id: string
  tipo: KbTipo
  categoria: KbCategoria
  titulo: string
  resumo: string | null
  campos: Record<string, string>
  tags: string[]
  data_referencia: string | null
  project_code: string | null
  status: KbStatus
  origem: 'manual' | 'importada'
  autor_id: string | null
  atualizado_por: string | null
  revisado_em: string | null
  created_at: string
  updated_at: string
}

export interface KbResultado {
  id: string
  tipo: KbTipo
  categoria: KbCategoria
  titulo: string
  trecho: string | null
  tags: string[]
  data_referencia: string | null
  project_code: string | null
  status: KbStatus
  updated_at: string
  relevancia: number
  aproximado: boolean
}

export interface KbSugestao {
  espec: 'item' | 'termo'
  texto: string
  item_id: string | null
  tipo: KbTipo | null
}

export interface KbAnexo {
  id: string
  item_id: string
  storage_path: string
  nome_arquivo: string
  mime_type: string | null
  tamanho_bytes: number | null
  tipo_anexo: string
  legenda: string | null
  autor_id: string | null
  created_at: string
}

export async function buscar(params: {
  q?: string
  categoria?: KbCategoria | null
  tipo?: KbTipo | null
  limite?: number
}): Promise<KbResultado[]> {
  const { data, error } = await sb.rpc('kb_buscar', {
    p_q: params.q?.trim() || null,
    p_categoria: params.categoria || null,
    p_tipo: params.tipo || null,
    p_limite: params.limite ?? 60,
  })
  if (error) throw error
  return (data ?? []) as KbResultado[]
}

export async function sugerir(q: string): Promise<KbSugestao[]> {
  const { data, error } = await sb.rpc('kb_sugerir', { p_q: q, p_limite: 9 })
  if (error) throw error
  return (data ?? []) as KbSugestao[]
}

export function nomeArquivoSeguro(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(-120)
}

/** Envia um arquivo como anexo de um item (storage + linha em kb_anexos). */
export async function anexarArquivo(itemId: string, arquivo: Blob, nome: string, autorId: string) {
  const mime = arquivo.type || 'application/octet-stream'
  const caminho = `kb/${itemId}/${crypto.randomUUID()}-${nomeArquivoSeguro(nome)}`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: mime,
    upsert: false,
  })
  if (upErr) throw upErr
  const { error } = await sb.from('kb_anexos').insert({
    item_id: itemId,
    storage_path: caminho,
    nome_arquivo: nome,
    mime_type: mime,
    tamanho_bytes: arquivo.size,
    tipo_anexo: mime.startsWith('image/') ? 'imagem' : 'documento',
    autor_id: autorId,
  })
  if (error) {
    await sb.storage.from(BUCKET).remove([caminho])
    throw error
  }
}

export async function removerAnexo(anexo: KbAnexo) {
  const { error } = await sb.from('kb_anexos').delete().eq('id', anexo.id)
  if (error) throw error
  await sb.storage.from(BUCKET).remove([anexo.storage_path])
}

export async function urlsAssinadas(caminhos: string[]): Promise<Record<string, string>> {
  if (!caminhos.length) return {}
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(caminhos, 3600)
  if (error) throw error
  const mapa: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl
  return mapa
}

const nomesUsuarios = new Map<string, string>()

/** Nome de exibição dos autores (tabela public.usuarios). */
export async function nomesDeUsuarios(ids: (string | null | undefined)[]) {
  const faltando = [...new Set(ids.filter(Boolean) as string[])].filter(
    (id) => !nomesUsuarios.has(id),
  )
  if (faltando.length) {
    const { data } = await sb
      .schema('public')
      .from('usuarios')
      .select('id, nome, email')
      .in('id', faltando)
    for (const u of data ?? []) nomesUsuarios.set(u.id, u.nome || u.email)
  }
  const mapa: Record<string, string> = {}
  for (const id of ids) if (id && nomesUsuarios.has(id)) mapa[id] = nomesUsuarios.get(id)!
  return mapa
}

/* ---- SPEC-165: reuniões de projeto, decisões e fila de revisão ---- */

/** Decisão em edição no formulário (antes de gravar). */
export interface DecisaoRascunho {
  decisao: string
  contexto: string
  excepcional: boolean
}

export interface KbDecisao extends DecisaoRascunho {
  id: string
  reuniao_id: string
  project_code: string
  ordem: number
  created_at: string
}

/** Sugestão proposta pela IA, ainda não enviada para a fila. */
export interface SugestaoProposta {
  tipo_destino: KbTipo
  titulo: string
  campos: Record<string, string>
  justificativa: string
  trecho_origem: string
  /** Posição da decisão (na lista do formulário) em que se apoia. */
  indice_decisao: number | null
}

export interface KbSugestao {
  id: string
  reuniao_id: string
  decisao_id: string | null
  tipo_destino: KbTipo
  titulo: string
  campos: Record<string, string>
  tags: string[]
  justificativa: string | null
  trecho_origem: string | null
  status: 'pendente' | 'aprovada' | 'rejeitada'
  motivo_rejeicao: string | null
  item_criado_id: string | null
  criado_por: string | null
  created_at: string
  revisado_por: string | null
  revisado_em: string | null
}

export interface PropostaReuniao {
  titulo: string
  data_reuniao: string | null
  project_code: string | null
  participantes: string
  resumo: string
  andamento: string
  pauta: string
  pendencias: string
  proximos_passos: string
  decisoes: (DecisaoRascunho & { motivo_excepcional?: string })[]
  sugestoes: SugestaoProposta[]
  texto_truncado: boolean
}

/** Chama a Edge Function que interpreta a reunião. Não grava nada. */
export async function interpretarReuniao(entrada: {
  texto?: string
  arquivo_base64?: string
  nome_arquivo?: string
  project_code?: string
}): Promise<PropostaReuniao> {
  const { data, error } = await sb.functions.invoke('interpretar-reuniao', { body: entrada })
  if (error) {
    let msg = error.message
    try {
      const corpo = await (error as { context?: Response }).context?.json()
      if (corpo?.error) msg = corpo.error
    } catch {
      /* mantém a mensagem genérica */
    }
    throw new Error(msg)
  }
  return data as PropostaReuniao
}

/** Texto das decisões para campos.decisoes (mantém a reunião pesquisável). */
export function decisoesComoTexto(decisoes: DecisaoRascunho[]) {
  return decisoes
    .filter((d) => d.decisao.trim())
    .map(
      (d) =>
        `- ${d.decisao.trim()}${d.excepcional ? ' (solução excepcional, só para este projeto)' : ''}`,
    )
    .join('\n')
}

/** Substitui as decisões de uma reunião. Devolve os ids na mesma ordem. */
export async function salvarDecisoes(
  reuniaoId: string,
  projectCode: string,
  decisoes: DecisaoRascunho[],
) {
  const { error: errDel } = await sb.from('kb_decisoes').delete().eq('reuniao_id', reuniaoId)
  if (errDel) throw errDel
  const linhas = decisoes
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.decisao.trim())
    .map(({ d, i }) => ({
      reuniao_id: reuniaoId,
      project_code: projectCode,
      decisao: d.decisao.trim(),
      contexto: d.contexto.trim() || null,
      excepcional: d.excepcional,
      ordem: i,
    }))
  if (!linhas.length) return new Map<number, string>()
  const { data, error } = await sb.from('kb_decisoes').insert(linhas).select('id, ordem')
  if (error) throw error
  return new Map<number, string>((data ?? []).map((r) => [r.ordem as number, r.id as string]))
}

/** Envia as sugestões para a fila de revisão (status pendente). */
export async function enviarSugestoes(
  reuniaoId: string,
  sugestoes: SugestaoProposta[],
  idsDecisoes: Map<number, string>,
  autorId: string,
) {
  if (!sugestoes.length) return
  const { error } = await sb.from('kb_sugestoes').insert(
    sugestoes.map((s) => ({
      reuniao_id: reuniaoId,
      decisao_id: s.indice_decisao !== null ? (idsDecisoes.get(s.indice_decisao) ?? null) : null,
      tipo_destino: s.tipo_destino,
      titulo: s.titulo,
      campos: s.campos,
      justificativa: s.justificativa || null,
      trecho_origem: s.trecho_origem || null,
      criado_por: autorId,
    })),
  )
  if (error) throw error
}

/** Lê um arquivo local como base64 (sem o prefixo data:). */
export function arquivoParaBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] ?? '')
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(arquivo)
  })
}

export function mensagemErro(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e)
    return String((e as { message: string }).message)
  return 'Não foi possível concluir a operação.'
}

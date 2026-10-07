/* SPEC-165 (ajuste 2026-09-29, pedido do usuário): a reunião importada vai
   direto para o histórico do projeto, sem passo de conferência. Só as
   sugestões de aproveitamento dependem de aprovação (fila de Revisão). */
import {
  anexarArquivo,
  decisoesComoTexto,
  enviarSugestoes,
  salvarDecisoes,
  sb,
  type PropostaReuniao,
} from './kb'
import { hojeISO } from './templates'

export interface ResultadoRegistro {
  id: string
  sugestoesEnviadas: number
  falhaAnexo: boolean
}

/** Grava a reunião interpretada (publicada), as decisões vinculadas ao projeto,
    o arquivo original e envia as sugestões para a fila. Exige código do projeto. */
export async function registrarReuniaoImportada(
  proposta: PropostaReuniao,
  projectCode: string,
  autorId: string,
  arquivo: File | null,
): Promise<ResultadoRegistro> {
  const decisoes = proposta.decisoes
    .filter((d) => d.decisao?.trim())
    .map((d) => ({
      decisao: d.decisao.trim(),
      contexto: d.contexto ?? '',
      excepcional: Boolean(d.excepcional),
    }))

  const campos = Object.fromEntries(
    Object.entries({
      participantes: proposta.participantes,
      andamento: proposta.andamento,
      pauta: proposta.pauta,
      decisoes: decisoesComoTexto(decisoes),
      pendencias: proposta.pendencias,
      acoes: proposta.proximos_passos,
    }).filter(([, v]) => v && v.trim()),
  )

  const { data: novo, error } = await sb
    .from('kb_itens')
    .insert({
      tipo: 'reuniao_projeto',
      titulo: proposta.titulo?.trim() || `Reunião do projeto ${projectCode}`,
      resumo: proposta.resumo?.trim() || null,
      campos,
      tags: [],
      data_referencia: proposta.data_reuniao || hojeISO(),
      project_code: projectCode,
      status: 'publicado',
      autor_id: autorId,
      metadata: { importada_por_interpretacao: true },
    })
    .select('id')
    .single()
  if (error) throw error
  const id = novo.id as string

  // Decisões (vinculadas ao projeto) e sugestões: mesma regra do formulário —
  // sugestão apoiada em decisão excepcional nunca é enviada.
  const idsPorOrdem = await salvarDecisoes(id, projectCode, decisoes)
  const enviar = proposta.sugestoes.filter(
    (s) => s.indice_decisao === null || !decisoes[s.indice_decisao]?.excepcional,
  )
  const idPorPosicao = new Map<number, string>()
  enviar.forEach((s, i) => {
    if (s.indice_decisao !== null && idsPorOrdem.has(s.indice_decisao)) {
      idPorPosicao.set(i, idsPorOrdem.get(s.indice_decisao)!)
    }
  })
  await enviarSugestoes(
    id,
    enviar.map((s, i) => ({ ...s, indice_decisao: idPorPosicao.has(i) ? i : null })),
    idPorPosicao,
    autorId,
  )

  let falhaAnexo = false
  if (arquivo) {
    await anexarArquivo(id, arquivo, arquivo.name, autorId).catch(() => {
      falhaAnexo = true
    })
  }
  return { id, sugestoesEnviadas: enviar.length, falhaAnexo }
}

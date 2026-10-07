/* SPEC-164 — Templates de inserção: um por tipo de conhecimento.
   As chaves de `campos` são gravadas em kb_itens.campos (jsonb). Só o título
   é obrigatório, para que registrar leve menos de um minuto. */
import type { KbCategoria, KbTipo } from './kb'

export interface CampoDef {
  chave: string
  rotulo: string
  // 'decisoes': lista estruturada (SPEC-165), gravada em kb_decisoes + texto em campos.decisoes
  tipo: 'texto' | 'textoLongo' | 'opcoes' | 'decisoes'
  ajuda?: string
  opcoes?: { valor: string; rotulo: string }[]
  linhas?: number
}

export interface TipoDef {
  tipo: KbTipo
  categoria: KbCategoria
  nome: string
  singular: string
  descricao: string
  tituloRotulo: string
  tituloExemplo: string
  dataRotulo?: string
  usaProjeto: boolean
  anexosRotulo: string
  campos: CampoDef[]
}

export const CATEGORIAS: {
  chave: KbCategoria
  nome: string
  descricao: string
  natureza: 'referência' | 'registro'
}[] = [
  {
    chave: 'tecnico',
    nome: 'Técnico',
    descricao: 'Regras de materiais, padrões de projeto e testes',
    natureza: 'referência',
  },
  {
    chave: 'comercial',
    nome: 'Comercial',
    descricao: 'Marcas e designers com quem trabalhamos',
    natureza: 'referência',
  },
  {
    chave: 'operacional',
    nome: 'Operacional',
    descricao: 'Procedimentos internos',
    natureza: 'referência',
  },
  {
    chave: 'projeto',
    nome: 'Projeto',
    descricao: 'Reuniões de projeto e visitas em obra',
    natureza: 'registro',
  },
  {
    chave: 'aprendizado',
    nome: 'Aprendizado',
    descricao: 'O que vimos e aprendemos em eventos',
    natureza: 'registro',
  },
]

export const TIPOS: TipoDef[] = [
  {
    tipo: 'regra_material',
    categoria: 'tecnico',
    nome: 'Regras de materiais',
    singular: 'Regra de uso de material',
    descricao: 'Como especificar cada material: combinações, acessórios e restrições.',
    tituloRotulo: 'Título da regra',
    tituloExemplo: 'Ex.: Fitas LED em áreas úmidas',
    usaProjeto: false,
    anexosRotulo: 'Referência visual',
    campos: [
      { chave: 'material_aplicacao', rotulo: 'Material / aplicação', tipo: 'texto' },
      { chave: 'combinacoes_permitidas', rotulo: 'Combinações permitidas', tipo: 'textoLongo' },
      {
        chave: 'acessorios_disponiveis',
        rotulo: 'Acessórios disponíveis',
        tipo: 'textoLongo',
        linhas: 2,
      },
      {
        chave: 'acessorios_recomendados',
        rotulo: 'Acessórios recomendados',
        tipo: 'textoLongo',
        linhas: 2,
      },
      { chave: 'restricoes', rotulo: 'Restrições e contraindicações', tipo: 'textoLongo' },
      { chave: 'detalhamento', rotulo: 'Detalhamento', tipo: 'textoLongo', linhas: 4 },
    ],
  },
  {
    tipo: 'padrao_projeto',
    categoria: 'tecnico',
    nome: 'Padrões de projeto',
    singular: 'Padrão de projeto',
    descricao: 'Soluções recorrentes e a diretriz autoral por trás delas.',
    tituloRotulo: 'Padrão',
    tituloExemplo: 'Ex.: Iluminação de colunas isoladas',
    usaProjeto: false,
    anexosRotulo: 'Imagens de referência',
    campos: [
      { chave: 'materiais', rotulo: 'Materiais usados', tipo: 'textoLongo', linhas: 2 },
      { chave: 'posicionamentos', rotulo: 'Posicionamentos', tipo: 'textoLongo' },
      { chave: 'conceito', rotulo: 'Conceito / diretriz autoral', tipo: 'textoLongo', linhas: 4 },
      { chave: 'referencias', rotulo: 'Referências', tipo: 'textoLongo', linhas: 2 },
    ],
  },
  {
    tipo: 'teste_material',
    categoria: 'tecnico',
    nome: 'Testes de materiais',
    singular: 'Resultado de teste de material',
    descricao: 'O que testamos, em que condições e o veredito.',
    tituloRotulo: 'Título do teste',
    tituloExemplo: 'Ex.: Fita LED 5000K em lona tensionada',
    dataRotulo: 'Data do teste',
    usaProjeto: false,
    anexosRotulo: 'Fotos do teste',
    campos: [
      { chave: 'material', rotulo: 'Material testado', tipo: 'texto' },
      { chave: 'fabricante', rotulo: 'Fabricante', tipo: 'texto' },
      {
        chave: 'aprovacao',
        rotulo: 'Aprovação',
        tipo: 'opcoes',
        opcoes: [
          { valor: 'aprovado', rotulo: 'Aprovado' },
          { valor: 'condicional', rotulo: 'Condicional' },
          { valor: 'reprovado', rotulo: 'Reprovado' },
        ],
      },
      { chave: 'condicoes', rotulo: 'Condições do teste', tipo: 'textoLongo', linhas: 2 },
      { chave: 'resultado', rotulo: 'Resultado', tipo: 'textoLongo' },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'textoLongo', linhas: 2 },
    ],
  },
  {
    tipo: 'procedimento',
    categoria: 'operacional',
    nome: 'Procedimentos',
    singular: 'Procedimento interno',
    descricao: 'Como fazemos cada rotina, passo a passo.',
    tituloRotulo: 'Nome do procedimento',
    tituloExemplo: 'Ex.: Cadastro de cliente no Connect',
    usaProjeto: false,
    anexosRotulo: 'Anexos',
    campos: [
      {
        chave: 'passo_a_passo',
        rotulo: 'Passo a passo',
        tipo: 'textoLongo',
        linhas: 5,
        ajuda: 'Um passo por linha.',
      },
      { chave: 'responsavel', rotulo: 'Responsável pela execução', tipo: 'texto' },
      { chave: 'ferramentas', rotulo: 'Ferramentas e sistemas', tipo: 'texto' },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'textoLongo', linhas: 2 },
    ],
  },
  {
    tipo: 'marca',
    categoria: 'comercial',
    nome: 'Marcas',
    singular: 'Marca',
    descricao: 'Fabricantes e fornecedores com quem trabalhamos.',
    tituloRotulo: 'Nome da marca',
    tituloExemplo: 'Ex.: Dessine',
    usaProjeto: false,
    anexosRotulo: 'Anexos',
    campos: [
      { chave: 'segmento', rotulo: 'Segmento / produtos', tipo: 'textoLongo', linhas: 2 },
      { chave: 'tipo_parceria', rotulo: 'Tipo de parceria', tipo: 'texto' },
      { chave: 'contato', rotulo: 'Contato / representante', tipo: 'texto' },
      { chave: 'observacoes_tecnicas', rotulo: 'Observações técnicas', tipo: 'textoLongo' },
    ],
  },
  {
    tipo: 'designer',
    categoria: 'comercial',
    nome: 'Designers',
    singular: 'Designer',
    descricao: 'Designers e escritórios parceiros.',
    tituloRotulo: 'Nome',
    tituloExemplo: 'Nome do designer ou do escritório',
    usaProjeto: false,
    anexosRotulo: 'Anexos',
    campos: [
      { chave: 'especialidade', rotulo: 'Especialidade', tipo: 'texto' },
      { chave: 'projetos', rotulo: 'Projetos em parceria', tipo: 'textoLongo', linhas: 2 },
      { chave: 'contato', rotulo: 'Contato', tipo: 'texto' },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'textoLongo', linhas: 2 },
    ],
  },
  {
    tipo: 'reuniao_projeto',
    categoria: 'projeto',
    nome: 'Reuniões de projeto',
    singular: 'Reunião de projeto',
    descricao:
      'Importe a ata ou transcrição, ou registre à mão: andamento, decisões e próximos passos do projeto.',
    tituloRotulo: 'Assunto da reunião',
    tituloExemplo: 'Ex.: Alinhamento luminotécnico — Residência Alto da Boa Vista',
    dataRotulo: 'Data da reunião',
    usaProjeto: true,
    anexosRotulo: 'Plantas e anexos',
    campos: [
      { chave: 'participantes', rotulo: 'Participantes', tipo: 'texto' },
      {
        chave: 'andamento',
        rotulo: 'Andamento do projeto',
        tipo: 'textoLongo',
        linhas: 3,
        ajuda: 'Status do projeto e o que foi falado.',
      },
      { chave: 'pauta', rotulo: 'Pauta', tipo: 'textoLongo', linhas: 3 },
      {
        chave: 'decisoes',
        rotulo: 'Decisões tomadas',
        tipo: 'decisoes',
        ajuda:
          'Cada decisão fica vinculada ao projeto. Marque "solução excepcional" quando for uma exceção para este projeto: ela fica só no histórico e nunca vira padrão.',
      },
      { chave: 'pendencias', rotulo: 'Pendências', tipo: 'textoLongo', linhas: 2 },
      {
        chave: 'acoes',
        rotulo: 'Próximos passos e responsáveis',
        tipo: 'textoLongo',
        linhas: 3,
        ajuda: 'Uma ação por linha: ação — responsável — prazo.',
      },
    ],
  },
  {
    tipo: 'visita_obra',
    categoria: 'projeto',
    nome: 'Visitas em obra',
    singular: 'Visita em obra',
    descricao: 'O que foi visto, os problemas e as fotos de cada visita.',
    tituloRotulo: 'Obra',
    tituloExemplo: 'Ex.: Residência Alto da Boa Vista',
    dataRotulo: 'Data da visita',
    usaProjeto: true,
    anexosRotulo: 'Fotos da obra',
    campos: [
      { chave: 'local', rotulo: 'Local', tipo: 'texto' },
      { chave: 'objetivo', rotulo: 'Objetivo da visita', tipo: 'textoLongo', linhas: 2 },
      { chave: 'observacoes_tecnicas', rotulo: 'Observações técnicas', tipo: 'textoLongo' },
      { chave: 'problemas', rotulo: 'Problemas encontrados', tipo: 'textoLongo' },
    ],
  },
  {
    tipo: 'vivencia_evento',
    categoria: 'aprendizado',
    nome: 'Vivências de eventos',
    singular: 'Vivência de evento',
    descricao: 'Feiras, exposições e visitas técnicas: o que vimos e aprendemos.',
    tituloRotulo: 'Evento',
    tituloExemplo: 'Ex.: Euroluce — Milão',
    dataRotulo: 'Data',
    usaProjeto: false,
    anexosRotulo: 'Fotos',
    campos: [
      { chave: 'local', rotulo: 'Local', tipo: 'texto' },
      { chave: 'equipe', rotulo: 'Equipe presente', tipo: 'texto' },
      { chave: 'aprendizados', rotulo: 'Aprendizados', tipo: 'textoLongo', linhas: 4 },
      { chave: 'referencias', rotulo: 'Referências de mercado', tipo: 'textoLongo', linhas: 2 },
    ],
  },
]

export const TIPO_POR_CHAVE = Object.fromEntries(TIPOS.map((t) => [t.tipo, t])) as Record<
  KbTipo,
  TipoDef
>
export const CATEGORIA_POR_CHAVE = Object.fromEntries(
  CATEGORIAS.map((c) => [c.chave, c]),
) as Record<KbCategoria, (typeof CATEGORIAS)[number]>

export function tiposDaCategoria(categoria: KbCategoria) {
  return TIPOS.filter((t) => t.categoria === categoria)
}

export function formatarData(valor: string | null | undefined) {
  if (!valor) return ''
  // data pura (AAAA-MM-DD) não pode sofrer fuso horário
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

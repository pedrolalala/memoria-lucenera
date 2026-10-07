/* Realça no texto as palavras buscadas, ignorando acento e caixa. */
import { Fragment } from 'react'

const PALAVRAS_VAZIAS = new Set([
  'a',
  'o',
  'as',
  'os',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'no',
  'na',
  'para',
  'com',
  'por',
  'um',
  'uma',
])

function semAcento(c: string) {
  return c
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function termosDaBusca(q: string) {
  return semAcento(q)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !PALAVRAS_VAZIAS.has(t))
    .map((t) => (t.length > 4 && /[^s]s$/.test(t) ? t.slice(0, -1) : t))
}

export default function Destaque({ texto, termos }: { texto: string; termos: string[] }) {
  if (!texto || !termos.length) return <>{texto}</>
  // Texto normalizado com o mesmo comprimento do original (1 caractere por caractere).
  const normal = Array.from(texto, (c) => semAcento(c).slice(0, 1) || c).join('')
  const marcado = new Array<boolean>(texto.length).fill(false)
  for (const termo of termos) {
    let i = normal.indexOf(termo)
    while (i !== -1) {
      const inicioDePalavra = i === 0 || !/[a-z0-9]/.test(normal[i - 1])
      if (inicioDePalavra) for (let k = i; k < i + termo.length; k++) marcado[k] = true
      i = normal.indexOf(termo, i + 1)
    }
  }
  const partes: { t: string; m: boolean }[] = []
  for (let i = 0; i < texto.length; i++) {
    const ult = partes[partes.length - 1]
    if (ult && ult.m === marcado[i]) ult.t += texto[i]
    else partes.push({ t: texto[i], m: marcado[i] })
  }
  return (
    <>
      {partes.map((p, i) =>
        p.m ? (
          <mark key={i} className="rounded-sm bg-[hsl(var(--luz))] px-0.5 text-foreground">
            {p.t}
          </mark>
        ) : (
          <Fragment key={i}>{p.t}</Fragment>
        ),
      )}
    </>
  )
}

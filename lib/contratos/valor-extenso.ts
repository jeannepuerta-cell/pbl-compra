const UNIDADES = [
  '',
  'um',
  'dois',
  'tres',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
]

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
]

const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
]

/**
 * Converts a group of up to 3 digits into Portuguese words.
 * E.g. 150 -> "cento e cinquenta", 100 -> "cem", 3 -> "tres"
 */
function grupoExtenso(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'

  const centena = Math.floor(n / 100)
  const resto = n % 100
  const dezena = Math.floor(resto / 10)
  const unidade = resto % 10

  const partes: string[] = []

  if (centena > 0) {
    partes.push(CENTENAS[centena])
  }

  if (resto > 0 && resto < 20) {
    partes.push(UNIDADES[resto])
  } else {
    if (dezena >= 2) {
      partes.push(DEZENAS[dezena])
    }
    if (unidade > 0 && dezena >= 2) {
      partes.push(UNIDADES[unidade])
    }
  }

  return partes.join(' e ')
}

interface Escala {
  valor: number
  singular: string
  plural: string
}

const ESCALAS: Escala[] = [
  { valor: 1_000_000_000, singular: 'bilhao', plural: 'bilhoes' },
  { valor: 1_000_000, singular: 'milhao', plural: 'milhoes' },
  { valor: 1_000, singular: 'mil', plural: 'mil' },
  { valor: 1, singular: '', plural: '' },
]

/**
 * Converts the integer part into Portuguese words (without "reais").
 * Returns an array of group strings, e.g. ["cento e cinquenta", "mil"]
 */
function inteiroExtenso(n: number): string {
  if (n === 0) return 'zero'

  const partes: string[] = []
  let restante = n

  for (const escala of ESCALAS) {
    const quantidade = Math.floor(restante / escala.valor)
    restante = restante % escala.valor

    if (quantidade === 0) continue

    const texto = grupoExtenso(quantidade)

    if (escala.valor === 1) {
      // Units group (1-999)
      partes.push(texto)
    } else if (escala.valor === 1000) {
      // "mil" — no prefix for 1, otherwise prefix
      if (quantidade === 1) {
        partes.push('mil')
      } else {
        partes.push(`${texto} mil`)
      }
    } else {
      // milhao/bilhao
      if (quantidade === 1) {
        partes.push(`${texto} ${escala.singular}`)
      } else {
        partes.push(`${texto} ${escala.plural}`)
      }
    }
  }

  return partes.join(' e ')
}

/**
 * Determines whether "de" should be inserted before "reais"/"real".
 * Rule: "de reais" is used when the value is an exact million/billion
 * (i.e., the last 6 digits for million, last 9 for billion are all zero).
 */
function usarDeReais(n: number): boolean {
  if (n === 0) return false
  if (n >= 1_000_000 && n % 1_000_000 === 0) return true
  if (n >= 1_000_000_000 && n % 1_000_000_000 === 0) return true
  return false
}

/**
 * Converts a numeric value to Brazilian Portuguese currency words.
 *
 * Examples:
 *   33000       -> "trinta e tres mil reais"
 *   150000.50   -> "cento e cinquenta mil reais e cinquenta centavos"
 *   1000000     -> "um milhao de reais"
 *   1           -> "um real"
 *   0.01        -> "um centavo"
 *   0           -> "zero reais"
 */
export function valorExtenso(valor: number): string {
  if (valor < 0) {
    return `menos ${valorExtenso(Math.abs(valor))}`
  }

  // Split into integer and centavos
  // Round to 2 decimal places to avoid floating point issues
  const rounded = Math.round(valor * 100) / 100
  const parteInteira = Math.floor(rounded)
  const centavos = Math.round((rounded - parteInteira) * 100)

  const partes: string[] = []

  // Integer part
  if (parteInteira > 0) {
    const extenso = inteiroExtenso(parteInteira)
    const de = usarDeReais(parteInteira) ? ' de' : ''
    const moeda = parteInteira === 1 ? 'real' : 'reais'
    partes.push(`${extenso}${de} ${moeda}`)
  } else if (centavos === 0) {
    return 'zero reais'
  }

  // Centavos part
  if (centavos > 0) {
    const extensoCentavos = inteiroExtenso(centavos)
    const unidadeCentavos = centavos === 1 ? 'centavo' : 'centavos'
    partes.push(`${extensoCentavos} ${unidadeCentavos}`)
  }

  return partes.join(' e ')
}

import { Operacao, PessoaStats, Producao, Profile } from './types'

// Calculate commission for a single operation
export function calcularComissao(tipo: string, creditos: number, valor: number): number {
  const bonus = valor > 20000 ? 2 : 0
  if (tipo === 'processo') {
    return 0.50 + (creditos + bonus) * 20
  }
  // precatorio or comercial
  return (creditos + bonus) * 20
}

// Calculate volume bonus (for anyone above R$400k)
export function calcularBonusVolume(volumeTotal: number): number {
  if (volumeTotal < 400000) return 0
  return Math.floor(volumeTotal / 100000) * 100
}

// Calculate liquidation share for one person
export function calcularLiquidacaoPessoa(
  processosLiquidadosPessoa: number,
  totalProcessosEmpresa: number,
  poolTotal: number
): number {
  if (totalProcessosEmpresa === 0) return 0
  const valorPorProcesso = poolTotal / totalProcessosEmpresa
  return processosLiquidadosPessoa * valorPorProcesso
}

// Calculate total stats for a person
export function calcularTotalPessoa(
  profile: Profile,
  operacoes: Operacao[],
  liquidacaoTotal: number,
  producaoData?: Producao[]
): PessoaStats {
  const ops = operacoes.filter(o => o.responsavel === profile.login)
  const volumeTotal = ops.reduce((s, o) => s + Number(o.valor), 0)

  // Créditos comprados from operacoes
  const comprados = ops.reduce((s, o) => s + (Number(o.creditos) || 0), 0)

  // Processos inseridos from producao table (daily data, tipo='insercao')
  const prodPessoa = producaoData?.filter(p => p.login === profile.login) || []
  const processosInseridos = prodPessoa
    .filter(p => p.tipo === 'insercao')
    .reduce((s, p) => s + (Number(p.quantidade) || 0), 0)

  // Compras from producao (for comercial, tipo='compra')
  const comprasProd = prodPessoa
    .filter(p => p.tipo === 'compra')
    .reduce((s, p) => s + (Number(p.quantidade) || 0), 0)

  // Comissão de processos inseridos: R$0,50 por processo (apenas jurídico)
  const comissaoInseridos = profile.setor === 'juridico' ? processosInseridos * 0.50 : 0

  // Comissão base from operacoes (créditos comprados * R$20 + bônus valor alto)
  const comBaseOps = ops.reduce(
    (s, o) => s + calcularComissao(o.tipo, Number(o.creditos) || 1, Number(o.valor)),
    0
  )

  // Total comBase = comissão de inseridos + comissão de créditos
  const comBase = comissaoInseridos + comBaseOps

  const bonus = calcularBonusVolume(volumeTotal)
  const liq = liquidacaoTotal
  const salario = Number(profile.salario) || 0

  return {
    login: profile.login,
    name: profile.name,
    setor: profile.setor,
    volumeTotal,
    comBase,
    bonus,
    liq,
    salario,
    totalComissao: comBase + bonus + liq,
    totalBruto: comBase + bonus + liq + salario,
    operacoes: ops.length,
    comprados: profile.setor === 'comercial' ? comprasProd || comprados : comprados,
    processosInseridos,
    comissaoInseridos,
  }
}

// Format currency in BRL
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Calculate gestora commission
export function calcularComissaoGestora(
  metaAtingida: boolean,
  superMetaAtingida: boolean,
  campanhasAtingidas: number
): number {
  let base = 10000
  if (superMetaAtingida) base = 14000
  else if (metaAtingida) base = 12000
  return base + (campanhasAtingidas * 500)
}

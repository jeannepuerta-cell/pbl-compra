'use client'

import { Profile, Operacao, Liquidacao, PessoaStats } from '@/lib/types'
import { calcularTotalPessoa, formatBRL } from '@/lib/comissoes'
import { SimpleBarChart } from '@/components/ui/SimpleBarChart'

interface RelatoriosClientProps {
  profiles: Profile[]
  operacoes: Operacao[]
  liquidacao: Liquidacao | null
}

const SETOR_BADGE: Record<string, string> = {
  juridico: 'bg-verde-claro text-verde-escuro',
  comercial: 'bg-dourado-claro text-dourado-escuro',
  gestor: 'bg-gray-100 text-gray-600',
}

const SETOR_COLORS: Record<string, string> = {
  juridico: '#01423e',
  comercial: '#c39152',
  gestor: '#6b7280',
}

export default function RelatoriosClient({
  profiles,
  operacoes,
  liquidacao,
}: RelatoriosClientProps) {
  const pessoaStats: PessoaStats[] = profiles.map((p) => {
    const liqPessoa = liquidacao?.por_pessoa?.[p.login] ?? 0
    return calcularTotalPessoa(p, operacoes, liqPessoa)
  })

  const totals = pessoaStats.reduce(
    (acc, p) => ({
      operacoes: acc.operacoes + p.operacoes,
      volumeTotal: acc.volumeTotal + p.volumeTotal,
      comBase: acc.comBase + p.comBase,
      bonus: acc.bonus + p.bonus,
      liq: acc.liq + p.liq,
      salario: acc.salario + p.salario,
      totalBruto: acc.totalBruto + p.totalBruto,
    }),
    {
      operacoes: 0,
      volumeTotal: 0,
      comBase: 0,
      bonus: 0,
      liq: 0,
      salario: 0,
      totalBruto: 0,
    }
  )

  // Participation chart data
  const volumeTotal = totals.volumeTotal || 1
  const participacaoData = pessoaStats
    .filter((p) => p.volumeTotal > 0)
    .map((p) => ({
      name: p.name.split(' ')[0],
      value: Number(((p.volumeTotal / volumeTotal) * 100).toFixed(1)),
      color: SETOR_COLORS[p.setor] || SETOR_COLORS.gestor,
    }))
    .sort((a, b) => b.value - a.value)

  const hasData = operacoes.length > 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatorios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Relatorio consolidado de comissoes e volumes
        </p>
      </div>

      {/* Consolidated table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Nome
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Setor
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Ops
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Volume
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Com. Base
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Bonus
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Liquidacao
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Salario
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {pessoaStats.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    Nenhum dado encontrado
                  </td>
                </tr>
              ) : (
                <>
                  {pessoaStats.map((p) => (
                    <tr
                      key={p.login}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                            SETOR_BADGE[p.setor] || SETOR_BADGE.gestor
                          }`}
                        >
                          {p.setor}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {p.operacoes}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatBRL(p.volumeTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatBRL(p.comBase)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatBRL(p.bonus)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatBRL(p.liq)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatBRL(p.salario)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-verde">
                        {formatBRL(p.totalBruto)}
                      </td>
                    </tr>
                  ))}

                  {/* Totals row */}
                  <tr className="bg-verde-claro font-semibold border-t-2 border-verde">
                    <td className="px-4 py-3 text-verde-escuro">Total</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right text-verde-escuro">
                      {totals.operacoes}
                    </td>
                    <td className="px-4 py-3 text-right text-verde-escuro">
                      {formatBRL(totals.volumeTotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-verde-escuro">
                      {formatBRL(totals.comBase)}
                    </td>
                    <td className="px-4 py-3 text-right text-verde-escuro">
                      {formatBRL(totals.bonus)}
                    </td>
                    <td className="px-4 py-3 text-right text-verde-escuro">
                      {formatBRL(totals.liq)}
                    </td>
                    <td className="px-4 py-3 text-right text-verde-escuro">
                      {formatBRL(totals.salario)}
                    </td>
                    <td className="px-4 py-3 text-right text-verde">
                      {formatBRL(totals.totalBruto)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Participation chart */}
      {hasData && participacaoData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <SimpleBarChart
            data={participacaoData}
            title="Participacao Percentual no Volume"
            formatValue={(v) => `${v}%`}
          />
        </div>
      )}
    </div>
  )
}

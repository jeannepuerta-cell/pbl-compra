'use client'

import { Profile, Operacao, Liquidacao, PessoaStats } from '@/lib/types'
import { calcularTotalPessoa, formatBRL } from '@/lib/comissoes'
import { MetricCard } from '@/components/ui/MetricCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SimpleBarChart } from '@/components/ui/SimpleBarChart'

interface DashboardClientProps {
  profiles: Profile[]
  operacoes: Operacao[]
  liquidacao: Liquidacao | null
}

const SETOR_COLORS: Record<string, string> = {
  juridico: '#01423e',
  comercial: '#c39152',
  gestor: '#6b7280',
}

export default function DashboardClient({
  profiles,
  operacoes,
  liquidacao,
}: DashboardClientProps) {
  const pessoaStats: PessoaStats[] = profiles.map((p) => {
    const liqPessoa = liquidacao?.por_pessoa?.[p.login] ?? 0
    return calcularTotalPessoa(p, operacoes, liqPessoa)
  })

  const volumeTotal = pessoaStats.reduce((s, p) => s + p.volumeTotal, 0)
  const comissoesTotais = pessoaStats.reduce((s, p) => s + p.totalComissao, 0)
  const folhaSalarial = pessoaStats.reduce((s, p) => s + p.salario, 0)
  const totalAPagar = comissoesTotais + folhaSalarial

  // Chart data: volume por colaborador
  const volumeChartData = pessoaStats
    .filter((p) => p.volumeTotal > 0 || p.operacoes > 0)
    .map((p) => ({
      name: p.name.split(' ')[0],
      value: p.volumeTotal,
      color: SETOR_COLORS[p.setor] || SETOR_COLORS.gestor,
    }))

  // Chart data: comissoes por setor
  const comissoesPorSetor = [
    {
      name: 'Juridico',
      value: pessoaStats
        .filter((p) => p.setor === 'juridico')
        .reduce((s, p) => s + p.totalComissao, 0),
      color: SETOR_COLORS.juridico,
    },
    {
      name: 'Comercial',
      value: pessoaStats
        .filter((p) => p.setor === 'comercial')
        .reduce((s, p) => s + p.totalComissao, 0),
      color: SETOR_COLORS.comercial,
    },
  ]

  const hasData = operacoes.length > 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visao geral de resultados e comissoes
        </p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Volume Total"
          value={formatBRL(volumeTotal)}
          subtitle={`${operacoes.length} operacoes`}
          color="verde"
        />
        <MetricCard
          title="Comissoes Totais"
          value={formatBRL(comissoesTotais)}
          subtitle="Base + Bonus + Liq."
          color="dourado"
        />
        <MetricCard
          title="Folha Salarial"
          value={formatBRL(folhaSalarial)}
          subtitle={`${profiles.length} colaboradores`}
          color="verde"
        />
        <MetricCard
          title="Total a Pagar"
          value={formatBRL(totalAPagar)}
          subtitle="Comissoes + Salarios"
          color="dourado"
        />
      </div>

      {!hasData ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-lg">Nenhum dado encontrado</p>
          <p className="text-gray-300 text-sm mt-1">
            Adicione operacoes para visualizar os graficos.
          </p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <SimpleBarChart
                data={volumeChartData}
                title="Volume por Colaborador"
                formatValue={(v) => formatBRL(v)}
              />
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <SimpleBarChart
                data={comissoesPorSetor}
                title="Comissoes por Setor"
                formatValue={(v) => formatBRL(v)}
              />
            </div>
          </div>

          {/* Progress bars */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Progresso para Meta (R$ 400.000)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pessoaStats
                .filter((p) => p.setor !== 'gestor')
                .map((p) => (
                  <ProgressBar
                    key={p.login}
                    label={p.name}
                    current={p.volumeTotal}
                    target={400000}
                    color={SETOR_COLORS[p.setor]}
                  />
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

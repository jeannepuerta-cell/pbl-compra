import { PessoaStats } from '@/lib/types'
import { formatBRL } from '@/lib/comissoes'
import { ProgressBar } from './ProgressBar'

interface PersonCardProps {
  stats: PessoaStats
  showLiquidacao?: boolean
}

const setorColors: Record<string, string> = {
  juridico: 'bg-blue-100 text-blue-700',
  comercial: 'bg-amber-100 text-amber-700',
  gestor: 'bg-purple-100 text-purple-700',
}

export function PersonCard({ stats, showLiquidacao }: PersonCardProps) {
  const initials = stats.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const statItems = [
    { label: 'Volume', value: formatBRL(stats.volumeTotal) },
    { label: 'Com. Base', value: formatBRL(stats.comBase) },
    { label: 'Bônus Volume', value: formatBRL(stats.bonus) },
    ...(showLiquidacao
      ? [{ label: 'Liquidação', value: formatBRL(stats.liq) }]
      : []),
    { label: 'Salário', value: formatBRL(stats.salario) },
    { label: 'Total', value: formatBRL(stats.totalBruto), highlight: true },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-verde flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {stats.name}
          </p>
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${
              setorColors[stats.setor] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {stats.setor}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Operações</p>
          <p className="text-sm font-bold text-gray-900">{stats.operacoes}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
        {statItems.map((item) => (
          <div key={item.label} className={item.highlight ? 'col-span-2 pt-2 border-t border-gray-100' : ''}>
            <p className="text-xs text-gray-400">{item.label}</p>
            <p
              className={`text-sm font-semibold ${
                item.highlight ? 'text-verde text-base' : 'text-gray-800'
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Meta progress */}
      <ProgressBar
        label="Meta R$400k"
        current={stats.volumeTotal}
        target={400000}
      />
    </div>
  )
}

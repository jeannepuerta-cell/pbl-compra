'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Profile, Operacao, Liquidacao, Producao, PessoaStats } from '@/lib/types'
import { calcularTotalPessoa, formatBRL } from '@/lib/comissoes'
import { MetricCard } from '@/components/ui/MetricCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SimpleBarChart } from '@/components/ui/SimpleBarChart'

interface DashboardClientProps {
  profiles: Profile[]
  operacoes: Operacao[]
  liquidacoes: Liquidacao[]
  currentProfile: Profile
  metaConfig: Record<string, { meta: number; supermeta: number }>
  producaoData: Producao[]
}

type PeriodType = 'dia' | 'semana' | 'mes' | 'trimestre' | 'personalizado'

const SETOR_COLORS: Record<string, string> = {
  juridico: '#01423e',
  comercial: '#c39152',
  gestor: '#6b7280',
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  dia: 'Dia',
  semana: 'Semana',
  mes: 'Mês',
  trimestre: 'Trimestre',
  personalizado: 'Personalizado',
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  const monthIdx = parseInt(month, 10) - 1
  return `${MONTH_NAMES[monthIdx]} ${year}`
}

function getMonthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d)
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), q, 1)
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3 + 2
  return new Date(d.getFullYear(), q + 1, 0)
}

export default function DashboardClient({
  profiles,
  operacoes,
  liquidacoes,
  currentProfile,
  metaConfig: initialMetaConfig,
  producaoData,
}: DashboardClientProps) {
  const isAdmin = currentProfile.role === 'admin'
  const today = new Date()

  // Compute available months from operacoes
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    operacoes.forEach((o) => {
      if (o.data) months.add(o.data.slice(0, 7))
    })
    return Array.from(months).sort().reverse()
  }, [operacoes])

  const currentMonthKey = getMonthKey(today)
  const defaultMonth =
    availableMonths.includes(currentMonthKey)
      ? currentMonthKey
      : availableMonths[0] ?? currentMonthKey

  // Period state
  const [periodType, setPeriodType] = useState<PeriodType>('mes')
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [selectedDate, setSelectedDate] = useState(toDateStr(today))
  const [customFrom, setCustomFrom] = useState(toDateStr(today))
  const [customTo, setCustomTo] = useState(toDateStr(today))

  // Meta state
  const [metaConfig, setMetaConfig] = useState(initialMetaConfig)
  const [metaInput, setMetaInput] = useState('')
  const [supermetaInput, setSupermetaInput] = useState('')
  const [metaSaving, setMetaSaving] = useState(false)

  // Compute date range from period
  const dateRange = useMemo<{ from: string; to: string }>(() => {
    if (periodType === 'dia') {
      return { from: selectedDate, to: selectedDate }
    }
    if (periodType === 'semana') {
      const d = new Date(selectedDate + 'T12:00:00')
      return { from: toDateStr(startOfWeek(d)), to: toDateStr(endOfWeek(d)) }
    }
    if (periodType === 'mes') {
      const [y, m] = selectedMonth.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      return { from: toDateStr(start), to: toDateStr(end) }
    }
    if (periodType === 'trimestre') {
      const d = new Date(selectedDate + 'T12:00:00')
      return { from: toDateStr(startOfQuarter(d)), to: toDateStr(endOfQuarter(d)) }
    }
    // personalizado
    return { from: customFrom, to: customTo }
  }, [periodType, selectedMonth, selectedDate, customFrom, customTo])

  // The month key for the currently viewed period (use start date)
  const viewedMonthKey = useMemo(() => {
    return dateRange.from.slice(0, 7)
  }, [dateRange])

  // Keep meta inputs in sync with viewed month
  const monthMeta = metaConfig[viewedMonthKey] ?? { meta: 0, supermeta: 0 }
  useEffect(() => {
    const m = metaConfig[viewedMonthKey] ?? { meta: 0, supermeta: 0 }
    setMetaInput(m.meta > 0 ? String(m.meta) : '')
    setSupermetaInput(m.supermeta > 0 ? String(m.supermeta) : '')
  }, [viewedMonthKey, metaConfig])

  // Filter operacoes by date range
  const filteredOperacoes = useMemo(() => {
    return operacoes.filter((o) => {
      if (!o.data) return false
      const d = o.data.slice(0, 10)
      return d >= dateRange.from && d <= dateRange.to
    })
  }, [operacoes, dateRange])

  // Find matching liquidacao for the viewed month
  const matchedLiquidacao = useMemo(() => {
    return liquidacoes.find((l) => l.mes === viewedMonthKey) ?? null
  }, [liquidacoes, viewedMonthKey])

  // Compute stats
  const pessoaStats: PessoaStats[] = useMemo(() => {
    return profiles
      .filter((p) => p.setor !== 'gestor')
      .map((p) => {
        const liqPessoa = matchedLiquidacao?.por_pessoa?.[p.login] ?? 0
        return calcularTotalPessoa(p, filteredOperacoes, liqPessoa, producaoData)
      })
  }, [profiles, filteredOperacoes, matchedLiquidacao, producaoData])

  const volumeTotal = pessoaStats.reduce((s, p) => s + p.volumeTotal, 0)
  const comissoesTotais = pessoaStats.reduce((s, p) => s + p.totalComissao, 0)
  const folhaSalarial = pessoaStats.reduce((s, p) => s + p.salario, 0)
  const totalAPagar = comissoesTotais + folhaSalarial

  // Chart data
  const volumeChartData = pessoaStats
    .filter((p) => p.volumeTotal > 0 || p.operacoes > 0)
    .map((p) => ({
      name: p.name.split(' ')[0],
      value: p.volumeTotal,
      color: SETOR_COLORS[p.setor] || SETOR_COLORS.gestor,
    }))

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

  const hasData = filteredOperacoes.length > 0

  // Meta target for progress bars
  const metaTarget = monthMeta.meta > 0 ? monthMeta.meta : 400000

  // Is the viewed month in the past?
  const isPastMonth = viewedMonthKey < currentMonthKey
  const canEditMeta = !isPastMonth

  const handleSaveMeta = useCallback(async () => {
    setMetaSaving(true)
    try {
      const metaVal = parseFloat(metaInput.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
      const supermetaVal =
        parseFloat(supermetaInput.replace(/[^\d.,]/g, '').replace(',', '.')) || 0

      const newMonthMeta = { meta: metaVal, supermeta: supermetaVal }

      const res = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'metas',
          valor: { [viewedMonthKey]: newMonthMeta },
          merge: true,
        }),
      })

      if (res.ok) {
        setMetaConfig((prev) => ({
          ...prev,
          [viewedMonthKey]: newMonthMeta,
        }))
      }
    } catch {
      // silent
    } finally {
      setMetaSaving(false)
    }
  }, [metaInput, supermetaInput, viewedMonthKey])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visao geral de resultados e comissoes
        </p>
      </div>

      {/* Period Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {(Object.keys(PERIOD_LABELS) as PeriodType[]).map((pt) => (
            <button
              key={pt}
              onClick={() => setPeriodType(pt)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                periodType === pt
                  ? 'bg-verde text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {PERIOD_LABELS[pt]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {periodType === 'mes' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm text-gray-800 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-verde/30"
            >
              {availableMonths.length === 0 && (
                <option value={currentMonthKey}>
                  {formatMonthLabel(currentMonthKey)}
                </option>
              )}
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          )}

          {(periodType === 'dia' ||
            periodType === 'semana' ||
            periodType === 'trimestre') && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm text-gray-800 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-verde/30"
            />
          )}

          {periodType === 'personalizado' && (
            <>
              <label className="text-sm text-gray-500">De:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-sm text-gray-800 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-verde/30"
              />
              <label className="text-sm text-gray-500">Ate:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-sm text-gray-800 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-verde/30"
              />
            </>
          )}

          <span className="text-xs text-gray-400 ml-auto">
            {dateRange.from === dateRange.to
              ? dateRange.from
              : `${dateRange.from} a ${dateRange.to}`}
            {' '}&middot; {filteredOperacoes.length} operacoes
          </span>
        </div>
      </div>

      {/* Meta / Supermeta Section (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-dourado p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Metas do Mes: {formatMonthLabel(viewedMonthKey)}
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Meta (R$)</label>
              <input
                type="text"
                value={metaInput}
                onChange={(e) => setMetaInput(e.target.value)}
                disabled={!canEditMeta}
                placeholder="0"
                className="w-40 text-sm text-gray-800 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-verde/30 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Super Meta (R$)
              </label>
              <input
                type="text"
                value={supermetaInput}
                onChange={(e) => setSupermetaInput(e.target.value)}
                disabled={!canEditMeta}
                placeholder="0"
                className="w-40 text-sm text-gray-800 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-verde/30 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            {canEditMeta && (
              <button
                onClick={handleSaveMeta}
                disabled={metaSaving}
                className="px-4 py-1.5 text-sm font-medium text-white bg-verde rounded-md hover:bg-verde/90 transition-colors disabled:opacity-50"
              >
                {metaSaving ? 'Salvando...' : 'Salvar Metas'}
              </button>
            )}
          </div>
          {!canEditMeta && (
            <p className="text-xs text-amber-600 mt-2">
              Metas de meses anteriores nao podem ser editadas.
            </p>
          )}
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Volume Total"
          value={formatBRL(volumeTotal)}
          subtitle={`${filteredOperacoes.length} operacoes`}
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
            Nenhuma operacao no periodo selecionado.
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
              Progresso para Meta ({formatBRL(metaTarget)})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pessoaStats
                .filter((p) => p.setor !== 'gestor')
                .map((p) => (
                  <ProgressBar
                    key={p.login}
                    label={p.name}
                    current={p.volumeTotal}
                    target={metaTarget}
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

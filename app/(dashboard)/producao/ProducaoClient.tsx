'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// --- Types ---
interface ProducaoRecord {
  id: number
  data: string
  login: string
  tipo: string
  quantidade: number
}

interface CellKey {
  date: string
  login: string
  tipo: string
}

// --- Constants ---
const JURIDICO_MEMBERS = [
  { login: 'daniel', label: 'Daniel' },
  { login: 'fernanda', label: 'Fernanda' },
  { login: 'luizfernando', label: 'Luiz F.' },
  { login: 'luizhenrique', label: 'Luiz H.' },
  { login: 'nataly', label: 'Nataly' },
  { login: 'nicolli', label: 'Nicolli' },
  { login: 'tarciane', label: 'Tarciane' },
  { login: 'tatiana', label: 'Tatiana' },
]

const COMERCIAL_MEMBERS = [
  { login: 'andressa', label: 'Andressa' },
  { login: 'barbara', label: 'Barbara' },
  { login: 'gabriella', label: 'Gabriella' },
  { login: 'hilary', label: 'Hilary' },
  { login: 'vitor', label: 'Vitor' },
]

function cellKey(date: string, login: string, tipo: string) {
  return `${date}|${login}|${tipo}`
}

function getDaysInMonth(year: number, month: number): string[] {
  const lastDay = new Date(year, month, 0).getDate()
  const days: string[] = []
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push(dateStr)
  }
  return days
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  return days[d.getDay()]
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

function countBusinessDays(days: string[]): number {
  return days.filter((d) => !isWeekend(d)).length
}

// --- Cell Component ---
function EditableCell({
  value,
  onSave,
  isWeekendDay,
}: {
  value: number
  onSave: (val: number) => Promise<void>
  isWeekendDay: boolean
}) {
  const [localValue, setLocalValue] = useState(String(value || ''))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalValue(String(value || ''))
  }, [value])

  const handleSave = useCallback(async () => {
    const numVal = parseInt(localValue, 10) || 0
    if (numVal === value) return
    setSaving(true)
    try {
      await onSave(numVal)
      setSaved(true)
      setTimeout(() => setSaved(false), 800)
    } finally {
      setSaving(false)
    }
  }, [localValue, value, onSave])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur()
    }
  }

  return (
    <td className={`border border-gray-200 p-0 ${isWeekendDay ? 'bg-gray-50' : ''}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={1}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`w-16 h-8 text-center text-sm border-0 outline-none focus:ring-2 focus:ring-verde/40 transition-colors ${
            saving ? 'bg-yellow-50' : saved ? 'bg-green-50' : 'bg-transparent'
          }`}
        />
        {saved && (
          <span className="absolute right-0.5 top-0.5 text-green-500 text-xs">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        )}
      </div>
    </td>
  )
}

// --- Grid Component ---
function ProducaoGrid({
  title,
  headerColor,
  members,
  tipo,
  days,
  dataMap,
  onCellSave,
}: {
  title: string
  headerColor: string
  members: { login: string; label: string }[]
  tipo: string
  days: string[]
  dataMap: Map<string, number>
  onCellSave: (cell: CellKey, quantidade: number) => Promise<void>
}) {
  const businessDays = countBusinessDays(days)

  // Column totals
  const colTotals = members.map((m) =>
    days.reduce((sum, d) => sum + (dataMap.get(cellKey(d, m.login, tipo)) || 0), 0)
  )

  // Column averages
  const colAverages = colTotals.map((t) =>
    businessDays > 0 ? (t / businessDays).toFixed(1) : '0.0'
  )

  return (
    <div className="flex-1 min-w-0">
      <h2
        className="text-sm font-bold text-white px-3 py-2 rounded-t-lg"
        style={{ backgroundColor: headerColor }}
      >
        {title}
      </h2>
      <div className="overflow-x-auto border border-gray-200 rounded-b-lg">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ backgroundColor: headerColor + '20' }}>
              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold sticky left-0 bg-white z-10 min-w-[72px]">
                Data
              </th>
              {members.map((m) => (
                <th
                  key={m.login}
                  className="border border-gray-200 px-1 py-1.5 text-center font-semibold w-16"
                >
                  {m.label}
                </th>
              ))}
              <th className="border border-gray-200 px-2 py-1.5 text-center font-bold w-16">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((dateStr, rowIdx) => {
              const day = parseInt(dateStr.split('-')[2], 10)
              const dow = getDayOfWeek(dateStr)
              const isWknd = isWeekend(dateStr)
              const rowTotal = members.reduce(
                (sum, m) => sum + (dataMap.get(cellKey(dateStr, m.login, tipo)) || 0),
                0
              )

              return (
                <tr
                  key={dateStr}
                  className={`${isWknd ? 'bg-gray-50' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <td className="border border-gray-200 px-2 py-0.5 font-medium sticky left-0 bg-inherit z-10 whitespace-nowrap">
                    <span className={isWknd ? 'text-gray-400' : ''}>
                      {String(day).padStart(2, '0')} {dow}
                    </span>
                  </td>
                  {members.map((m) => (
                    <EditableCell
                      key={m.login}
                      value={dataMap.get(cellKey(dateStr, m.login, tipo)) || 0}
                      isWeekendDay={isWknd}
                      onSave={async (val) => {
                        await onCellSave({ date: dateStr, login: m.login, tipo }, val)
                      }}
                    />
                  ))}
                  <td className="border border-gray-200 px-2 py-0.5 text-center font-bold bg-gray-100">
                    {rowTotal || ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold" style={{ backgroundColor: headerColor + '15' }}>
              <td className="border border-gray-200 px-2 py-1.5 sticky left-0 bg-gray-100 z-10">
                TOTAL
              </td>
              {colTotals.map((t, i) => (
                <td key={i} className="border border-gray-200 px-1 py-1.5 text-center bg-gray-100">
                  {t || ''}
                </td>
              ))}
              <td className="border border-gray-200 px-2 py-1.5 text-center bg-gray-200">
                {colTotals.reduce((a, b) => a + b, 0) || ''}
              </td>
            </tr>
            <tr className="text-gray-600" style={{ backgroundColor: headerColor + '10' }}>
              <td className="border border-gray-200 px-2 py-1.5 sticky left-0 bg-gray-50 z-10">
                MEDIA
              </td>
              {colAverages.map((a, i) => (
                <td key={i} className="border border-gray-200 px-1 py-1.5 text-center bg-gray-50">
                  {a !== '0.0' ? a : ''}
                </td>
              ))}
              <td className="border border-gray-200 px-2 py-1.5 text-center bg-gray-100">
                {businessDays > 0
                  ? (colTotals.reduce((a, b) => a + b, 0) / businessDays).toFixed(1)
                  : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// --- Ranking Component ---
function RankingSection({
  dataMap,
  days,
}: {
  dataMap: Map<string, number>
  days: string[]
}) {
  const businessDays = countBusinessDays(days)

  const juridicoRanking = JURIDICO_MEMBERS.map((m) => {
    const total = days.reduce(
      (sum, d) => sum + (dataMap.get(cellKey(d, m.login, 'insercao')) || 0),
      0
    )
    return { ...m, total, avg: businessDays > 0 ? total / businessDays : 0 }
  }).sort((a, b) => b.total - a.total)

  const comercialRanking = COMERCIAL_MEMBERS.map((m) => {
    const total = days.reduce(
      (sum, d) => sum + (dataMap.get(cellKey(d, m.login, 'compra')) || 0),
      0
    )
    return { ...m, total, avg: businessDays > 0 ? total / businessDays : 0 }
  }).sort((a, b) => b.total - a.total)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {/* Juridico Ranking */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <h3 className="text-sm font-bold text-white px-3 py-2" style={{ backgroundColor: '#01423e' }}>
          Ranking Juridico - Insercoes
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-1.5 text-left">#</th>
              <th className="px-3 py-1.5 text-left">Nome</th>
              <th className="px-3 py-1.5 text-center">Total</th>
              <th className="px-3 py-1.5 text-center">Media/dia</th>
            </tr>
          </thead>
          <tbody>
            {juridicoRanking.map((p, i) => (
              <tr key={p.login} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-1.5 font-bold text-gray-500">{i + 1}</td>
                <td className="px-3 py-1.5">{p.label}</td>
                <td className="px-3 py-1.5 text-center font-semibold">{p.total}</td>
                <td className="px-3 py-1.5 text-center text-gray-600">{p.avg.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Comercial Ranking */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <h3 className="text-sm font-bold text-white px-3 py-2" style={{ backgroundColor: '#c39152' }}>
          Ranking Comercial - Compras
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-1.5 text-left">#</th>
              <th className="px-3 py-1.5 text-left">Nome</th>
              <th className="px-3 py-1.5 text-center">Total</th>
              <th className="px-3 py-1.5 text-center">Media/dia</th>
            </tr>
          </thead>
          <tbody>
            {comercialRanking.map((p, i) => (
              <tr key={p.login} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-1.5 font-bold text-gray-500">{i + 1}</td>
                <td className="px-3 py-1.5">{p.label}</td>
                <td className="px-3 py-1.5 text-center font-semibold">{p.total}</td>
                <td className="px-3 py-1.5 text-center text-gray-600">{p.avg.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Main Component ---
export default function ProducaoClient() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [dataMap, setDataMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const [year, month] = selectedMonth.split('-').map(Number)
  const days = getDaysInMonth(year, month)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/producao?mes=${selectedMonth}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const records: ProducaoRecord[] = await res.json()
      const map = new Map<string, number>()
      records.forEach((r) => {
        map.set(cellKey(r.data, r.login, r.tipo), r.quantidade)
      })
      setDataMap(map)
    } catch (err) {
      console.error('Error fetching producao:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCellSave = useCallback(
    async (cell: CellKey, quantidade: number) => {
      // Optimistic update
      setDataMap((prev) => {
        const next = new Map(prev)
        next.set(cellKey(cell.date, cell.login, cell.tipo), quantidade)
        return next
      })

      const res = await fetch('/api/producao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: cell.date,
          login: cell.login,
          tipo: cell.tipo,
          quantidade,
        }),
      })

      if (!res.ok) {
        console.error('Failed to save cell')
        // Revert on error
        fetchData()
      }
    },
    [fetchData]
  )

  // Generate month options (last 12 months + next 2)
  const monthOptions: { value: string; label: string }[] = []
  for (let i = -12; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    monthOptions.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-verde-escuro">Producao Diaria</h1>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-verde/40 focus:border-verde"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-verde" />
        </div>
      ) : (
        <>
          {/* Grids */}
          <div className="flex flex-col xl:flex-row gap-6">
            <ProducaoGrid
              title="Processos Inseridos - Juridico"
              headerColor="#01423e"
              members={JURIDICO_MEMBERS}
              tipo="insercao"
              days={days}
              dataMap={dataMap}
              onCellSave={handleCellSave}
            />
            <ProducaoGrid
              title="Processos Comprados - Comercial"
              headerColor="#c39152"
              members={COMERCIAL_MEMBERS}
              tipo="compra"
              days={days}
              dataMap={dataMap}
              onCellSave={handleCellSave}
            />
          </div>

          {/* Rankings */}
          <RankingSection dataMap={dataMap} days={days} />
        </>
      )}
    </div>
  )
}

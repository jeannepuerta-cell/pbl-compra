'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Profile, Operacao, Liquidacao, PessoaStats, MetaConfig } from '@/lib/types'
import {
  calcularTotalPessoa,
  calcularLiquidacaoPessoa,
  calcularComissaoGestora,
  formatBRL,
} from '@/lib/comissoes'
import { PersonCard } from '@/components/ui/PersonCard'

interface Props {
  currentProfile: Profile
  allProfiles: Profile[]
}

type Tab = 'individual' | 'equipe' | 'liquidacao' | 'gestora'

export default function ComissoesClient({ currentProfile, allProfiles }: Props) {
  const isAdmin = currentProfile.role === 'admin'
  const [activeTab, setActiveTab] = useState<Tab>('individual')
  const [operacoes, setOperacoes] = useState<Operacao[]>([])
  const [liquidacoes, setLiquidacoes] = useState<Liquidacao[]>([])
  const [loading, setLoading] = useState(true)

  // Individual tab
  const [filterPerson, setFilterPerson] = useState<string>('todos')

  // Liquidacao tab
  const [liqMes, setLiqMes] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [liqTotalProc, setLiqTotalProc] = useState(0)
  const [liqPool, setLiqPool] = useState(0)
  const [liqPorPessoa, setLiqPorPessoa] = useState<Record<string, number>>({})
  const [liqSaving, setLiqSaving] = useState(false)

  // Gestora tab
  const [metaConfig, setMetaConfig] = useState<MetaConfig>({ meta: 0, supermeta: 0 })
  const [campanhas, setCampanhas] = useState<boolean[]>([false, false, false, false])
  const [gestoraSaving, setGestoraSaving] = useState(false)

  const juridicoMembers = useMemo(
    () => allProfiles.filter((p) => p.setor === 'juridico'),
    [allProfiles]
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [opsRes, liqRes] = await Promise.all([
        fetch('/api/operacoes'),
        fetch('/api/liquidacoes'),
      ])
      if (opsRes.ok) setOperacoes(await opsRes.json())
      if (liqRes.ok) setLiquidacoes(await liqRes.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchConfiguracoes = useCallback(async () => {
    try {
      const [metaRes, campRes] = await Promise.all([
        fetch('/api/configuracoes?chave=metas'),
        fetch('/api/configuracoes?chave=campanhas_semanais'),
      ])
      if (metaRes.ok) {
        const data = await metaRes.json()
        if (data?.valor) setMetaConfig(data.valor)
      }
      if (campRes.ok) {
        const data = await campRes.json()
        if (data?.valor) setCampanhas(data.valor)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchData()
    if (isAdmin) fetchConfiguracoes()
  }, [fetchData, fetchConfiguracoes, isAdmin])

  // Current month liquidacao
  const currentMonthLiq = useMemo(() => {
    const now = new Date()
    const currentMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return liquidacoes.find((l) => l.mes === currentMes)
  }, [liquidacoes])

  // Build person stats
  const buildPersonStats = useCallback(
    (profile: Profile): PessoaStats => {
      let liqTotal = 0
      if (profile.setor === 'juridico' && currentMonthLiq) {
        liqTotal = currentMonthLiq.por_pessoa?.[profile.login] || 0
      }
      return calcularTotalPessoa(profile, operacoes, liqTotal)
    },
    [operacoes, currentMonthLiq]
  )

  const personStats = useMemo(() => {
    const nonGestor = allProfiles.filter((p) => p.setor !== 'gestor')
    const relevantProfiles = isAdmin
      ? nonGestor
      : nonGestor.filter((p) => p.login === currentProfile.login)
    return relevantProfiles.map(buildPersonStats)
  }, [allProfiles, isAdmin, currentProfile.login, buildPersonStats])

  const filteredStats = useMemo(() => {
    if (!isAdmin || filterPerson === 'todos') return personStats
    return personStats.filter((s) => s.login === filterPerson)
  }, [personStats, isAdmin, filterPerson])

  // Team aggregations
  const teamStats = useMemo(() => {
    const compute = (setor: string) => {
      const members = personStats.filter((s) => s.setor === setor)
      return {
        equipe: setor === 'juridico' ? 'Juridico' : 'Comercial',
        membros: members.length,
        volumeTotal: members.reduce((s, m) => s + m.volumeTotal, 0),
        comBase: members.reduce((s, m) => s + m.comBase, 0),
        bonus: members.reduce((s, m) => s + m.bonus, 0),
        total: members.reduce((s, m) => s + m.totalComissao, 0),
      }
    }
    return [compute('juridico'), compute('comercial')]
  }, [personStats])

  // VPP calculation for liquidacao form
  const liqVPP = useMemo(() => {
    if (liqTotalProc <= 0) return 0
    return liqPool / liqTotalProc
  }, [liqPool, liqTotalProc])

  const handleSaveLiquidacao = async () => {
    setLiqSaving(true)
    try {
      // Calculate each person's share based on their process count
      const porPessoa: Record<string, number> = {}
      for (const [login, count] of Object.entries(liqPorPessoa)) {
        porPessoa[login] = calcularLiquidacaoPessoa(count, liqTotalProc, liqPool)
      }

      const res = await fetch('/api/liquidacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes: liqMes,
          total_proc: liqTotalProc,
          pool: liqPool,
          por_pessoa: porPessoa,
        }),
      })
      if (res.ok) {
        await fetchData()
        setLiqPorPessoa({})
      }
    } catch {
      // ignore
    } finally {
      setLiqSaving(false)
    }
  }

  // Gestora calculations
  const volumeTotal = useMemo(
    () => operacoes.reduce((s, o) => s + Number(o.valor), 0),
    [operacoes]
  )
  const metaAtingida = volumeTotal >= metaConfig.meta && metaConfig.meta > 0
  const superMetaAtingida = volumeTotal >= metaConfig.supermeta && metaConfig.supermeta > 0
  const campanhasAtingidas = campanhas.filter(Boolean).length
  const comissaoGestora = calcularComissaoGestora(metaAtingida, superMetaAtingida, campanhasAtingidas)

  const handleSaveGestora = async () => {
    setGestoraSaving(true)
    try {
      await Promise.all([
        fetch('/api/configuracoes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: 'metas', valor: metaConfig }),
        }),
        fetch('/api/configuracoes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: 'campanhas_semanais', valor: campanhas }),
        }),
      ])
    } catch {
      // ignore
    } finally {
      setGestoraSaving(false)
    }
  }

  const tabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: 'individual', label: 'Individual' },
    { key: 'equipe', label: 'Por Equipe' },
    { key: 'liquidacao', label: 'Liquidacao Juridica', adminOnly: true },
    { key: 'gestora', label: 'Painel da Gestora', adminOnly: true },
  ]

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Comissoes</h1>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-verde text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Individual */}
      {activeTab === 'individual' && (
        <div className="space-y-4">
          {isAdmin && (
            <div>
              <select
                value={filterPerson}
                onChange={(e) => setFilterPerson(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
              >
                <option value="todos">Todos</option>
                {allProfiles.filter((p) => p.setor !== 'gestor').map((p) => (
                  <option key={p.login} value={p.login}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStats.map((stats) => (
              <PersonCard
                key={stats.login}
                stats={stats}
                showLiquidacao={stats.setor === 'juridico'}
              />
            ))}
          </div>

          {filteredStats.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center text-gray-400">
              Nenhuma comissao encontrada.
            </div>
          )}
        </div>
      )}

      {/* Tab: Por Equipe */}
      {activeTab === 'equipe' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Equipe</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Membros</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Volume Total</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Com. Base</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Bonus</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teamStats.map((team) => (
                  <tr key={team.equipe} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{team.equipe}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{team.membros}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatBRL(team.volumeTotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatBRL(team.comBase)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatBRL(team.bonus)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">{formatBRL(team.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Liquidacao Juridica */}
      {activeTab === 'liquidacao' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nova Liquidacao</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                <input
                  type="month"
                  value={liqMes}
                  onChange={(e) => setLiqMes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Processos</label>
                <input
                  type="number"
                  value={liqTotalProc || ''}
                  onChange={(e) => setLiqTotalProc(Number(e.target.value) || 0)}
                  min={0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pool (R$)</label>
                <input
                  type="number"
                  value={liqPool || ''}
                  onChange={(e) => setLiqPool(Number(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                />
              </div>
            </div>

            {/* VPP display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
              <p className="text-sm text-blue-600">
                VPP (Valor Por Processo): <span className="font-bold">{formatBRL(liqVPP)}</span>
              </p>
            </div>

            {/* Per-person inputs */}
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-gray-700">Processos por pessoa (Juridico)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {juridicoMembers.map((m) => (
                  <div key={m.login} className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 w-32 truncate">{m.name}</label>
                    <input
                      type="number"
                      value={liqPorPessoa[m.login] || ''}
                      onChange={(e) =>
                        setLiqPorPessoa((prev) => ({
                          ...prev,
                          [m.login]: Number(e.target.value) || 0,
                        }))
                      }
                      min={0}
                      placeholder="0"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                    />
                    <span className="text-sm text-gray-500 w-28 text-right">
                      {formatBRL(calcularLiquidacaoPessoa(liqPorPessoa[m.login] || 0, liqTotalProc, liqPool))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveLiquidacao}
              disabled={liqSaving || liqTotalProc <= 0 || liqPool <= 0}
              className="px-6 py-2 bg-verde text-white rounded-lg text-sm font-medium hover:bg-verde/90 disabled:opacity-50 transition-colors"
            >
              {liqSaving ? 'Salvando...' : 'Salvar Liquidacao'}
            </button>
          </div>

          {/* History */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Historico de Liquidacoes</h2>
            </div>
            {liquidacoes.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Nenhuma liquidacao registrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-600">Mes</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-right">Total Proc.</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-right">Pool</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-right">VPP</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Distribuicao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {liquidacoes.map((liq) => (
                      <tr key={liq.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{liq.mes}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{liq.total_proc}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatBRL(liq.pool)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatBRL(liq.vpp)}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {liq.por_pessoa
                            ? Object.entries(liq.por_pessoa)
                                .map(([login, val]) => `${login}: ${formatBRL(val as number)}`)
                                .join(', ')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Painel da Gestora */}
      {activeTab === 'gestora' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Metas do Mes</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta (R$)</label>
                <input
                  type="number"
                  value={metaConfig.meta || ''}
                  onChange={(e) =>
                    setMetaConfig((prev) => ({ ...prev, meta: Number(e.target.value) || 0 }))
                  }
                  min={0}
                  step={1000}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Super Meta (R$)</label>
                <input
                  type="number"
                  value={metaConfig.supermeta || ''}
                  onChange={(e) =>
                    setMetaConfig((prev) => ({ ...prev, supermeta: Number(e.target.value) || 0 }))
                  }
                  min={0}
                  step={1000}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                />
              </div>
            </div>

            {/* Volume vs Meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Volume Total</p>
                <p className="text-lg font-bold text-gray-900">{formatBRL(volumeTotal)}</p>
              </div>
              <div
                className={`rounded-lg p-4 border ${
                  metaAtingida ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <p className="text-xs text-gray-500">Meta</p>
                <p className={`text-lg font-bold ${metaAtingida ? 'text-green-700' : 'text-gray-900'}`}>
                  {formatBRL(metaConfig.meta)} {metaAtingida ? ' - Atingida' : ''}
                </p>
              </div>
              <div
                className={`rounded-lg p-4 border ${
                  superMetaAtingida ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <p className="text-xs text-gray-500">Super Meta</p>
                <p className={`text-lg font-bold ${superMetaAtingida ? 'text-green-700' : 'text-gray-900'}`}>
                  {formatBRL(metaConfig.supermeta)} {superMetaAtingida ? ' - Atingida' : ''}
                </p>
              </div>
            </div>

            {/* Campanhas Semanais */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Campanhas Semanais (R$500 cada)
              </h3>
              <div className="flex gap-4 flex-wrap">
                {[0, 1, 2, 3].map((i) => (
                  <label
                    key={i}
                    className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={campanhas[i] || false}
                      onChange={(e) => {
                        const updated = [...campanhas]
                        updated[i] = e.target.checked
                        setCampanhas(updated)
                      }}
                      className="rounded border-gray-300 text-verde focus:ring-verde"
                    />
                    <span className="text-sm text-gray-700">Semana {i + 1}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Projected commission */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-600">Comissao Gestora Projetada</p>
              <p className="text-2xl font-bold text-green-700">{formatBRL(comissaoGestora)}</p>
              <p className="text-xs text-green-500 mt-1">
                Base: {formatBRL(superMetaAtingida ? 14000 : metaAtingida ? 12000 : 10000)} +
                Campanhas: {formatBRL(campanhasAtingidas * 500)}
              </p>
            </div>

            <button
              onClick={handleSaveGestora}
              disabled={gestoraSaving}
              className="px-6 py-2 bg-verde text-white rounded-lg text-sm font-medium hover:bg-verde/90 disabled:opacity-50 transition-colors"
            >
              {gestoraSaving ? 'Salvando...' : 'Salvar Configuracoes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

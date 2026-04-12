'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Operacao, Profile } from '@/lib/types'
import { calcularComissao, formatBRL } from '@/lib/comissoes'

type TeamMember = Pick<Profile, 'login' | 'name' | 'setor'>

interface Props {
  profiles: TeamMember[]
}

const TIPOS = [
  { key: 'processo', label: 'Processo Jurídico' },
  { key: 'precatorio', label: 'Precatório' },
  { key: 'comercial', label: 'Comercial' },
] as const

type Tipo = (typeof TIPOS)[number]['key']

export default function LancamentosClient({ profiles }: Props) {
  const [operacoes, setOperacoes] = useState<Operacao[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [tipo, setTipo] = useState<Tipo>('processo')
  const [responsavel, setResponsavel] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [numero, setNumero] = useState('')
  const [creditos, setCreditos] = useState(1)
  const [valor, setValor] = useState(0)

  // Edit modal state
  const [editOp, setEditOp] = useState<Operacao | null>(null)
  const [editTipo, setEditTipo] = useState<Tipo>('processo')
  const [editResponsavel, setEditResponsavel] = useState('')
  const [editData, setEditData] = useState('')
  const [editNumero, setEditNumero] = useState('')
  const [editCreditos, setEditCreditos] = useState(1)
  const [editValor, setEditValor] = useState(0)
  const [editSaving, setEditSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const juridicoMembers = useMemo(
    () => profiles.filter((p) => p.setor === 'juridico'),
    [profiles]
  )
  const comercialMembers = useMemo(
    () => profiles.filter((p) => p.setor === 'comercial'),
    [profiles]
  )

  const relevantMembers = useMemo(() => {
    if (tipo === 'processo') return juridicoMembers
    if (tipo === 'precatorio') return profiles.filter((p) => p.login === 'nicolli')
    return comercialMembers
  }, [tipo, juridicoMembers, comercialMembers, profiles])

  // Auto-set responsavel when type changes
  useEffect(() => {
    if (tipo === 'precatorio') {
      setResponsavel('nicolli')
    } else if (relevantMembers.length > 0 && !relevantMembers.find((m) => m.login === responsavel)) {
      setResponsavel(relevantMembers[0].login)
    }
  }, [tipo, relevantMembers, responsavel])

  const previewComissao = useMemo(
    () => calcularComissao(tipo, creditos, valor),
    [tipo, creditos, valor]
  )

  const fetchOperacoes = useCallback(async () => {
    try {
      const res = await fetch('/api/operacoes')
      if (res.ok) {
        const data = await res.json()
        setOperacoes(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOperacoes()
  }, [fetchOperacoes])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!responsavel || !data) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/operacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, responsavel, data, numero, creditos, valor }),
      })
      if (res.ok) {
        setNumero('')
        setCreditos(1)
        setValor(0)
        await fetchOperacoes()
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta operação?')) return
    try {
      const res = await fetch(`/api/operacoes?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchOperacoes()
      }
    } catch {
      // ignore
    }
  }

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('data'))

    const rows = lines.map((line) => {
      const [csvData, csvTipo, login, csvNumero, csvCreditos, csvValor] = line.split(',').map((s) => s.trim())
      return {
        data: csvData,
        tipo: csvTipo,
        responsavel: login,
        numero: csvNumero || null,
        creditos: Number(csvCreditos) || 1,
        valor: Number(csvValor) || 0,
      }
    })

    if (rows.length === 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/operacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      if (res.ok) {
        await fetchOperacoes()
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function openEditModal(op: Operacao) {
    setEditOp(op)
    setEditTipo(op.tipo as Tipo)
    setEditResponsavel(op.responsavel)
    setEditData(op.data)
    setEditNumero(op.numero || '')
    setEditCreditos(op.creditos)
    setEditValor(op.valor)
  }

  async function handleEditSave() {
    if (!editOp) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/operacoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editOp.id,
          tipo: editTipo,
          responsavel: editResponsavel,
          numero: editNumero,
          creditos: editCreditos,
          valor: editValor,
          data: editData,
        }),
      })
      if (res.ok) {
        setEditOp(null)
        await fetchOperacoes()
      }
    } catch {
      // ignore
    } finally {
      setEditSaving(false)
    }
  }

  const editPreviewComissao = useMemo(
    () => calcularComissao(editTipo, editCreditos, editValor),
    [editTipo, editCreditos, editValor]
  )

  const editRelevantMembers = useMemo(() => {
    if (editTipo === 'processo') return juridicoMembers
    if (editTipo === 'precatorio') return profiles.filter((p) => p.login === 'nicolli')
    return comercialMembers
  }, [editTipo, juridicoMembers, comercialMembers, profiles])

  const tipoLabel = (t: string) => {
    const found = TIPOS.find((x) => x.key === t)
    return found ? found.label : t
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Lançamentos</h1>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nova Operação</h2>

        {/* Type tabs */}
        <div className="flex gap-2 mb-6">
          {TIPOS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTipo(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tipo === t.key
                  ? 'bg-verde text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Responsavel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Responsável
              </label>
              <select
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                disabled={tipo === 'precatorio'}
                className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde disabled:bg-gray-100"
              >
                {relevantMembers.map((m) => (
                  <option key={m.login} value={m.login}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
              />
            </div>

            {/* Numero */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número
              </label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Número do processo/operação"
                className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
              />
            </div>

            {/* Creditos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Créditos
              </label>
              <input
                type="number"
                value={creditos}
                onChange={(e) => setCreditos(Number(e.target.value) || 1)}
                min={1}
                className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
              />
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                value={valor}
                onChange={(e) => setValor(Number(e.target.value) || 0)}
                min={0}
                step={0.01}
                className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
              />
            </div>

            {/* Comissao preview */}
            <div className="flex items-end">
              <div className="w-full rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <p className="text-xs text-green-600">Comissão estimada</p>
                <p className="text-lg font-bold text-green-700">
                  {formatBRL(previewComissao)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-verde text-white rounded-lg text-sm font-medium hover:bg-verde/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Salvando...' : 'Salvar Operação'}
            </button>

            {/* CSV Import */}
            <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 cursor-pointer transition-colors">
              Importar CSV
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
              />
            </label>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Operações ({operacoes.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : operacoes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nenhuma operação registrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Responsável</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Número</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Créditos</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Comissão</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {operacoes.map((op) => (
                  <tr key={op.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(op.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                          op.tipo === 'processo'
                            ? 'bg-blue-100 text-blue-700'
                            : op.tipo === 'precatorio'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {tipoLabel(op.tipo)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{op.responsavel}</td>
                    <td className="px-4 py-3 text-gray-500">{op.numero || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{op.creditos}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatBRL(op.valor)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {formatBRL(op.comissao)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(op)}
                          className="text-verde hover:text-verde-escuro text-xs font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(op.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Edit Modal */}
      {editOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditOp(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Editar Operação</h2>

            <div className="space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <div className="flex gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setEditTipo(t.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        editTipo === t.key
                          ? 'bg-verde text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Responsavel */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                  <select
                    value={editResponsavel}
                    onChange={(e) => setEditResponsavel(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                  >
                    {editRelevantMembers.map((m) => (
                      <option key={m.login} value={m.login}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={editData}
                    onChange={(e) => setEditData(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                  />
                </div>

                {/* Numero */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                  <input
                    type="text"
                    value={editNumero}
                    onChange={(e) => setEditNumero(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                  />
                </div>

                {/* Creditos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Créditos</label>
                  <input
                    type="number"
                    value={editCreditos}
                    onChange={(e) => setEditCreditos(Number(e.target.value) || 1)}
                    min={1}
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                  />
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    value={editValor}
                    onChange={(e) => setEditValor(Number(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-sm focus:border-verde focus:ring-1 focus:ring-verde"
                  />
                </div>

                {/* Preview comissao */}
                <div className="flex items-end">
                  <div className="w-full rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                    <p className="text-xs text-green-600">Comissão</p>
                    <p className="text-lg font-bold text-green-700">{formatBRL(editPreviewComissao)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOp(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-verde rounded-lg hover:bg-verde-escuro disabled:opacity-50 transition-colors"
                >
                  {editSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Campanha } from '@/lib/types'
import { formatBRL } from '@/lib/comissoes'

function EquipeBadge({ equipe }: { equipe: string }) {
  const colors: Record<string, string> = {
    todos: 'bg-gray-500 text-white',
    juridico: 'bg-verde text-white',
    comercial: 'bg-dourado text-white',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[equipe] ?? 'bg-gray-300 text-gray-700'}`}>
      {equipe}
    </span>
  )
}

export default function CampanhasClient() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Form state
  const [nome, setNome] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [premio, setPremio] = useState(500)
  const [equipe, setEquipe] = useState<'todos' | 'juridico' | 'comercial'>('todos')

  useEffect(() => {
    fetchCampanhas()
  }, [])

  async function fetchCampanhas() {
    try {
      const res = await fetch('/api/campanhas')
      if (res.ok) {
        const data = await res.json()
        setCampanhas(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return

    setFormLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/campanhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, objetivo, premio, equipe }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao criar campanha')
      }

      const newCampanha = await res.json()
      setCampanhas((prev) => [newCampanha, ...prev])
      setNome('')
      setObjetivo('')
      setPremio(500)
      setEquipe('todos')
      setMessage({ type: 'success', text: 'Campanha criada com sucesso!' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar campanha'
      setMessage({ type: 'error', text: msg })
    } finally {
      setFormLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  async function handleToggleAtingido(campanha: Campanha) {
    try {
      const res = await fetch('/api/campanhas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campanha.id, atingido: !campanha.atingido }),
      })

      if (res.ok) {
        setCampanhas((prev) =>
          prev.map((c) => (c.id === campanha.id ? { ...c, atingido: !c.atingido } : c))
        )
      }
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/campanhas?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setCampanhas((prev) => prev.filter((c) => c.id !== id))
      }
    } catch {
      // ignore
    } finally {
      setDeleteConfirm(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-verde-escuro mb-6">Campanhas</h1>

      {/* Create Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-verde-escuro mb-4">Nova Campanha</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da campanha"
              required
              className="w-full border border-gray-300 rounded bg-white text-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo</label>
            <input
              type="text"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Objetivo da campanha"
              className="w-full border border-gray-300 rounded bg-white text-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Premio (R$)</label>
            <input
              type="number"
              value={premio}
              onChange={(e) => setPremio(Number(e.target.value))}
              min={0}
              className="w-full border border-gray-300 rounded bg-white text-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipe</label>
            <select
              value={equipe}
              onChange={(e) => setEquipe(e.target.value as 'todos' | 'juridico' | 'comercial')}
              className="w-full border border-gray-300 rounded bg-white text-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/50"
            >
              <option value="todos">Todos</option>
              <option value="juridico">Juridico</option>
              <option value="comercial">Comercial</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={formLoading || !nome.trim()}
              className="px-6 py-2 bg-verde text-white rounded hover:bg-verde-escuro disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {formLoading ? 'Criando...' : 'Criar Campanha'}
            </button>
            {message && (
              <span
                className={`text-sm ${
                  message.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {message.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Campaigns List */}
      <h2 className="text-lg font-semibold text-verde-escuro mb-4">Campanhas Ativas</h2>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : campanhas.length === 0 ? (
        <p className="text-gray-400">Nenhuma campanha encontrada.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campanhas.map((campanha) => (
            <div
              key={campanha.id}
              className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                campanha.atingido ? 'border-green-500' : 'border-dourado'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-verde-escuro">{campanha.nome}</h3>
                <EquipeBadge equipe={campanha.equipe} />
              </div>

              {campanha.objetivo && (
                <p className="text-sm text-gray-600 mb-2">{campanha.objetivo}</p>
              )}

              <p className="text-lg font-bold text-dourado mb-3">
                {formatBRL(campanha.premio)}
              </p>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      campanha.atingido ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    onClick={() => handleToggleAtingido(campanha)}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        campanha.atingido ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                  <span className="text-sm text-gray-600">
                    {campanha.atingido ? 'Atingido' : 'Pendente'}
                  </span>
                </label>

                {deleteConfirm === campanha.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(campanha.id)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(campanha.id)}
                    className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

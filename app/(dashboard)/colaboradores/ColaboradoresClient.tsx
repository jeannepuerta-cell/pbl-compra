'use client'

import { useState } from 'react'
import { Profile } from '@/lib/types'

interface Props {
  profiles: Profile[]
}

export default function ColaboradoresClient({ profiles: initialProfiles }: Props) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [editState, setEditState] = useState<Record<string, { cargo: string; salario: number }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null)

  const juridicos = profiles.filter((p) => p.setor === 'juridico')
  const comerciais = profiles.filter((p) => p.setor === 'comercial')

  function getEdited(profile: Profile) {
    return editState[profile.id] ?? { cargo: profile.cargo ?? '', salario: profile.salario }
  }

  function handleChange(id: string, field: 'cargo' | 'salario', value: string) {
    const current = editState[id] ?? {
      cargo: profiles.find((p) => p.id === id)?.cargo ?? '',
      salario: profiles.find((p) => p.id === id)?.salario ?? 0,
    }
    setEditState((prev) => ({
      ...prev,
      [id]: {
        ...current,
        [field]: field === 'salario' ? Number(value) : value,
      },
    }))
  }

  async function handleSave(id: string) {
    const edited = editState[id]
    if (!edited) return

    setSaving((prev) => ({ ...prev, [id]: true }))
    setMessage(null)

    try {
      const res = await fetch('/api/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cargo: edited.cargo, salario: edited.salario }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, cargo: edited.cargo, salario: edited.salario } : p
        )
      )
      setMessage({ id, type: 'success', text: 'Salvo com sucesso!' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      setMessage({ id, type: 'error', text: msg })
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }))
      setTimeout(() => setMessage(null), 3000)
    }
  }

  function renderTable(title: string, team: Profile[], colorClass: string, bgClass: string) {
    return (
      <div className="mb-8">
        <h2 className={`text-lg font-semibold px-4 py-2 rounded-t-lg text-white ${bgClass}`}>
          {title}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-b-lg shadow">
            <thead>
              <tr className="border-b text-left text-sm text-gray-600">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Salario Base</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {team.map((profile) => {
                const edited = getEdited(profile)
                return (
                  <tr key={profile.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{profile.name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={edited.cargo}
                        onChange={(e) => handleChange(profile.id, 'cargo', e.target.value)}
                        className="border border-gray-300 rounded bg-white text-gray-800 px-2 py-1 text-sm w-full max-w-[200px] focus:outline-none focus:ring-2 focus:ring-verde/50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={edited.salario}
                        onChange={(e) => handleChange(profile.id, 'salario', e.target.value)}
                        className="border border-gray-300 rounded bg-white text-gray-800 px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-verde/50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(profile.id)}
                          disabled={saving[profile.id]}
                          className={`px-3 py-1 text-sm text-white rounded hover:opacity-90 disabled:opacity-50 ${colorClass}`}
                        >
                          {saving[profile.id] ? 'Salvando...' : 'Salvar'}
                        </button>
                        {message?.id === profile.id && (
                          <span
                            className={`text-sm ${
                              message.type === 'success' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {message.text}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {team.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    Nenhum colaborador nesta equipe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-verde-escuro mb-6">Colaboradores</h1>
      {renderTable('Equipe Juridica', juridicos, 'bg-verde', 'bg-verde')}
      {renderTable('Equipe Comercial', comerciais, 'bg-dourado', 'bg-dourado')}
    </div>
  )
}

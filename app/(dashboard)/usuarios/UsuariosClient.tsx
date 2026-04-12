'use client'

import { useState } from 'react'
import { Profile } from '@/lib/types'

interface Props {
  profiles: Profile[]
}

function SetorBadge({ setor }: { setor: string }) {
  const colors: Record<string, string> = {
    juridico: 'bg-verde text-white',
    comercial: 'bg-dourado text-white',
    gestor: 'bg-gray-500 text-white',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[setor] ?? 'bg-gray-300 text-gray-700'}`}>
      {setor}
    </span>
  )
}

export default function UsuariosClient({ profiles }: Props) {
  const [modalUser, setModalUser] = useState<Profile | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleResetPassword() {
    if (!modalUser || !newPassword) return
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: modalUser.id, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao redefinir senha')
      }

      setMessage({ type: 'success', text: 'Senha redefinida com sucesso!' })
      setNewPassword('')
      setTimeout(() => {
        setModalUser(null)
        setMessage(null)
      }, 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao redefinir senha'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  function closeModal() {
    setModalUser(null)
    setNewPassword('')
    setMessage(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-verde-escuro mb-6">Usuarios</h1>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm text-gray-600 bg-gray-50">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Setor</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b last:border-b-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{profile.name}</td>
                <td className="px-4 py-3 text-gray-600">{profile.login}</td>
                <td className="px-4 py-3">
                  <SetorBadge setor={profile.setor} />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setModalUser(profile)}
                    className="px-3 py-1 text-sm bg-verde text-white rounded hover:bg-verde-escuro transition-colors"
                  >
                    Redefinir Senha
                  </button>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  Nenhum usuario encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-verde-escuro mb-1">Redefinir Senha</h2>
            <p className="text-sm text-gray-600 mb-4">
              Usuario: <span className="font-medium">{modalUser.name}</span>
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nova Senha
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha"
              className="w-full border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-verde/50"
            />

            {message && (
              <p
                className={`text-sm mb-3 ${
                  message.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {message.text}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                disabled={loading || !newPassword}
                className="px-4 py-2 text-sm bg-verde text-white rounded hover:bg-verde-escuro disabled:opacity-50 transition-colors"
              >
                {loading ? 'Redefinindo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const USERS_BY_SETOR = {
  Gestora: [
    { login: 'jeanne', name: 'Jeanne' },
  ],
  Juridico: [
    { login: 'daniel', name: 'Daniel' },
    { login: 'fernanda', name: 'Fernanda' },
    { login: 'luizfernando', name: 'Luiz Fernando' },
    { login: 'luizhenrique', name: 'Luiz Henrique' },
    { login: 'nataly', name: 'Nataly' },
    { login: 'nicolli', name: 'Nicolli' },
    { login: 'tarciane', name: 'Tarciane' },
    { login: 'tatiana', name: 'Tatiana' },
  ],
  Comercial: [
    { login: 'andressa', name: 'Andressa' },
    { login: 'barbara', name: 'Bárbara' },
    { login: 'gabriella', name: 'Gabriella' },
    { login: 'hilary', name: 'Hilary' },
    { login: 'vitor', name: 'Vitor' },
  ],
} as const

export default function LoginPage() {
  const router = useRouter()
  const [selectedLogin, setSelectedLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedLogin) {
      setError('Selecione um usuário.')
      return
    }

    if (!password) {
      setError('Digite sua senha.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: `${selectedLogin}@pblcompra.com`,
        password,
      })

      if (authError) {
        setError('Credenciais inválidas. Verifique sua senha.')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-verde-escuro">
      <div className="w-full max-w-md mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            PBL <span className="text-dourado">Compra</span>
          </h1>
          <p className="text-verde-claro/70 mt-2 text-sm">
            Sistema de Gestão de Compras
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl p-8 space-y-6"
        >
          <div>
            <h2 className="text-xl font-semibold text-verde-escuro">Entrar</h2>
            <p className="text-sm text-gray-500 mt-1">
              Selecione seu nome e digite sua senha.
            </p>
          </div>

          {/* User dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="user-select"
              className="block text-sm font-medium text-gray-700"
            >
              Usuário
            </label>
            <select
              id="user-select"
              value={selectedLogin}
              onChange={(e) => setSelectedLogin(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:border-dourado focus:ring-2 focus:ring-dourado/30 focus:outline-none transition"
            >
              <option value="">Selecione um usuário...</option>
              {Object.entries(USERS_BY_SETOR).map(([setor, users]) => (
                <optgroup key={setor} label={setor}>
                  {users.map((user) => (
                    <option key={user.login} value={user.login}>
                      {user.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-dourado focus:ring-2 focus:ring-dourado/30 focus:outline-none transition"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-dourado px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-dourado-escuro focus:outline-none focus:ring-2 focus:ring-dourado/50 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-verde-claro/40 text-xs mt-6">
          PBL Compra &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

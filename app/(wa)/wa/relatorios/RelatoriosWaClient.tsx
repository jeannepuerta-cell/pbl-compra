'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WaPromptRelatorio } from '@/lib/wa-types'

export default function RelatoriosWaClient() {
  const [relatorios, setRelatorios] = useState<WaPromptRelatorio[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchRelatorios = useCallback(async () => {
    try {
      const res = await fetch('/api/wa/prompts')
      if (!res.ok) return
      // For now we fetch from a placeholder — the real endpoint would be /api/wa/relatorios
      // Since the relatorios API may not exist yet, we handle gracefully
      const relRes = await fetch('/api/wa/relatorios').catch(() => null)
      if (relRes?.ok) {
        setRelatorios(await relRes.json())
      }
    } catch {
      // silently fail for now
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRelatorios()
  }, [fetchRelatorios])

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#01423e] mb-2">Relatorios de Evolucao de Prompt</h1>
      <p className="text-sm text-gray-500 mb-6">
        Analise automatica de divergencias entre respostas da IA e correcoes humanas para evolucao continua dos prompts.
      </p>

      <div className="mb-6">
        <button
          disabled
          className="px-5 py-2.5 bg-gray-300 text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed"
          title="OpenAI nao configurada"
        >
          Gerar Analise (indisponivel)
        </button>
        <span className="ml-3 text-xs text-gray-400">Requer configuracao OpenAI para gerar novas analises.</span>
      </div>

      <h2 className="text-lg font-semibold text-gray-700 mb-3">Historico de Relatorios</h2>

      {loading ? (
        <div className="text-gray-500 text-center py-12">Carregando...</div>
      ) : relatorios.length === 0 ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-lg border">
          Nenhum relatorio disponivel.
        </div>
      ) : (
        <div className="space-y-3">
          {relatorios.map((r) => {
            const isExpanded = expandedId === r.id
            return (
              <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
                <button
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">
                        {new Date(r.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-medium">
                        {r.divergencias_analisadas} divergencia(s)
                      </span>
                      {r.aprovado && (
                        <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">
                          Aprovado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      Periodo: {new Date(r.periodo_inicio).toLocaleDateString('pt-BR')} -{' '}
                      {new Date(r.periodo_fim).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <svg
                    className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-5 py-4 border-t border-gray-100 space-y-3">
                    {r.analise_texto && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 mb-1">Analise</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                          {r.analise_texto}
                        </p>
                      </div>
                    )}
                    {r.prompt_sugerido && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 mb-1">Prompt Sugerido</h4>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 font-mono">
                          {r.prompt_sugerido}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

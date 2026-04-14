'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Fechamento } from '@/lib/contratos/types'

type FechamentoWithContratos = Fechamento & {
  ct_contratos: { count: number }[]
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'gerado', label: 'Gerado' },
  { value: 'enviado_contencioso', label: 'Enviado Contencioso' },
  { value: 'assinado', label: 'Assinado' },
]

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  rascunho: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Rascunho' },
  gerado: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Gerado' },
  enviado_contencioso: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Enviado Contencioso' },
  assinado: { bg: 'bg-green-100', text: 'text-green-700', label: 'Assinado' },
}

const TIPO_CESSAO_LABELS: Record<string, string> = {
  sucumbencia: 'Sucumbencia',
  honorarios: 'Honorarios',
  integral: 'Integral',
  personalizado: 'Personalizado',
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export default function ContratosListClient() {
  const [fechamentos, setFechamentos] = useState<FechamentoWithContratos[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const fetchContratos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)

      const res = await fetch(`/api/contratos?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setFechamentos(data)
      }
    } catch (err) {
      console.error('Erro ao buscar contratos:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, dataInicio, dataFim])

  useEffect(() => {
    fetchContratos()
  }, [fetchContratos])

  async function handleDownload(id: string) {
    try {
      const res = await fetch(`/api/contratos/${id}/gerar`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao gerar')
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?(.+?)"?$/)
      const filename = match?.[1] || `contrato_${id}.docx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      fetchContratos()
    } catch (err) {
      console.error('Erro ao baixar contrato:', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-verde-escuro">Contratos</h1>
        <Link
          href="/contratos/novo"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-verde text-white rounded-lg text-sm font-medium hover:bg-verde-escuro transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Contrato
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data inicio</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde"
            />
          </div>
          <button
            onClick={() => {
              setStatusFilter('')
              setDataInicio('')
              setDataFim('')
            }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-verde" />
          </div>
        ) : fechamentos.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-sm">Nenhum contrato encontrado</p>
            <Link
              href="/contratos/novo"
              className="inline-block mt-4 text-sm font-medium text-verde hover:text-verde-escuro transition-colors"
            >
              Criar primeiro contrato
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-verde-escuro text-white">
                  <th className="text-left px-4 py-3 font-medium">N Contrato</th>
                  <th className="text-left px-4 py-3 font-medium">N Processo</th>
                  <th className="text-left px-4 py-3 font-medium">Cedente</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo Cessao</th>
                  <th className="text-right px-4 py-3 font-medium">Valor Fechado</th>
                  <th className="text-right px-4 py-3 font-medium">Desagio</th>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fechamentos.map((f) => {
                  const badge = STATUS_BADGE[f.status] || STATUS_BADGE.rascunho
                  return (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-800">
                        {f.numero_contrato || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-mono text-xs">
                        {f.numero_processo}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {f.c1_nome || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {TIPO_CESSAO_LABELS[f.tipo_cessao] || f.tipo_cessao}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 font-medium">
                        {formatBRL(f.valor_fechado)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {f.desagio != null ? `${f.desagio}%` : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(f.data_fechamento)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            badge.bg,
                            badge.text
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/contratos/${f.id}`}
                            className="text-verde hover:text-verde-escuro text-xs font-medium transition-colors"
                          >
                            Visualizar
                          </Link>
                          <button
                            onClick={() => handleDownload(f.id)}
                            className="text-dourado hover:text-dourado-escuro text-xs font-medium transition-colors"
                          >
                            Baixar .docx
                          </button>
                          <Link
                            href={`/contratos/${f.id}`}
                            className="text-gray-400 hover:text-gray-600 text-xs font-medium transition-colors"
                          >
                            Editar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

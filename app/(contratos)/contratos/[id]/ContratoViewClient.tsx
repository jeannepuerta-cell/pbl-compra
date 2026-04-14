'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Fechamento, ContratoDoc } from '@/lib/contratos/types'

type FechamentoFull = Fechamento & {
  ct_contratos: ContratoDoc[]
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  rascunho: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Rascunho' },
  gerado: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Gerado' },
  enviado_contencioso: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Enviado Contencioso' },
  assinado: { bg: 'bg-green-100', text: 'text-green-700', label: 'Assinado' },
}

const STATUS_FLOW: Fechamento['status'][] = ['rascunho', 'gerado', 'enviado_contencioso', 'assinado']

const TIPO_CESSAO_LABELS: Record<string, string> = {
  sucumbencia: 'Sucumbencia',
  honorarios: 'Honorarios',
  integral: 'Integral',
  personalizado: 'Personalizado',
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function FieldDisplay({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800">{value || '-'}</dd>
    </div>
  )
}

export default function ContratoViewClient({ id }: { id: string }) {
  const [fechamento, setFechamento] = useState<FechamentoFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [processingObs, setProcessingObs] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Fechamento>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/contratos/${id}`)
      if (!res.ok) throw new Error('Nao encontrado')
      const data = await res.json()
      setFechamento(data)
    } catch (err) {
      console.error('Erro ao buscar contrato:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleGenerate() {
    setGenerating(true)
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
      await fetchData()
    } catch (err) {
      console.error('Erro ao gerar contrato:', err)
      alert('Erro ao gerar contrato')
    } finally {
      setGenerating(false)
    }
  }

  async function handleProcessObs() {
    setProcessingObs(true)
    try {
      const res = await fetch(`/api/contratos/${id}/processar-obs`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao processar')
      }
      await fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar observacoes'
      alert(message)
    } finally {
      setProcessingObs(false)
    }
  }

  async function handleStatusChange(newStatus: Fechamento['status']) {
    try {
      const res = await fetch(`/api/contratos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar status')
      await fetchData()
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      alert('Erro ao atualizar status')
    }
  }

  function startEditing() {
    if (!fechamento) return
    setEditData({
      numero_processo: fechamento.numero_processo,
      numero_contrato: fechamento.numero_contrato,
      comercial_responsavel: fechamento.comercial_responsavel,
      analista_juridico: fechamento.analista_juridico,
      valor_condenacao: fechamento.valor_condenacao,
      valor_fechado: fechamento.valor_fechado,
      vara: fechamento.vara,
      comarca: fechamento.comarca,
      autor_nome: fechamento.autor_nome,
      reu_nome: fechamento.reu_nome,
      c1_nome: fechamento.c1_nome,
      c1_cpf: fechamento.c1_cpf,
      c1_endereco: fechamento.c1_endereco,
      c1_cidade: fechamento.c1_cidade,
      c1_uf: fechamento.c1_uf,
      c1_cep: fechamento.c1_cep,
      observacoes_raw: fechamento.observacoes_raw,
    })
    setEditing(true)
  }

  async function handleSaveEdit() {
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/contratos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setEditing(false)
      await fetchData()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert('Erro ao salvar alteracoes')
    } finally {
      setSavingEdit(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-verde" />
      </div>
    )
  }

  if (!fechamento) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Contrato nao encontrado</p>
          <Link href="/contratos" className="text-verde hover:text-verde-escuro font-medium text-sm">
            Voltar para lista
          </Link>
        </div>
      </div>
    )
  }

  const f = fechamento
  const badge = STATUS_BADGE[f.status] || STATUS_BADGE.rascunho
  const isAdvogado = f.tipo_cessao === 'sucumbencia' || f.tipo_cessao === 'honorarios'

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link
              href="/contratos"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2 inline-block"
            >
              &larr; Voltar para lista
            </Link>
            <h1 className="text-2xl font-bold text-verde-escuro">
              {f.numero_contrato || `Processo ${f.numero_processo}`}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-sm font-medium', badge.bg, badge.text)}>
                {badge.label}
              </span>
              <span className="text-sm text-gray-500">
                {TIPO_CESSAO_LABELS[f.tipo_cessao]} | {formatDate(f.data_fechamento)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={startEditing}
                className="px-4 py-2 text-sm font-medium border border-verde text-verde rounded-lg hover:bg-verde-claro transition-colors"
              >
                Editar
              </button>
            ) : (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className={cn(
                    'px-4 py-2 text-sm font-medium bg-verde text-white rounded-lg hover:bg-verde-escuro transition-colors',
                    savingEdit && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {savingEdit ? 'Salvando...' : 'Salvar'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status change + actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Status:</label>
              <select
                value={f.status}
                onChange={(e) => handleStatusChange(e.target.value as Fechamento['status'])}
                className="border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde"
              >
                {STATUS_FLOW.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_BADGE[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={cn(
                'px-4 py-2 text-sm font-medium bg-dourado text-white rounded-lg hover:bg-dourado-escuro transition-colors',
                generating && 'opacity-50 cursor-not-allowed'
              )}
            >
              {generating ? 'Gerando...' : 'Gerar Contrato'}
            </button>
            {f.observacoes_raw && (
              <button
                onClick={handleProcessObs}
                disabled={processingObs}
                className={cn(
                  'px-4 py-2 text-sm font-medium border border-dourado text-dourado rounded-lg hover:bg-dourado-claro transition-colors',
                  processingObs && 'opacity-50 cursor-not-allowed'
                )}
              >
                {processingObs ? 'Processando...' : 'Processar Observacoes com IA'}
              </button>
            )}
          </div>
        </div>

        {/* Editing mode */}
        {editing && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-verde-escuro">Editar Campos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  ['numero_processo', 'Numero do processo'],
                  ['numero_contrato', 'Numero do contrato'],
                  ['comercial_responsavel', 'Comercial responsavel'],
                  ['analista_juridico', 'Analista juridico'],
                  ['vara', 'Vara'],
                  ['comarca', 'Comarca'],
                  ['autor_nome', 'Nome do autor'],
                  ['reu_nome', 'Nome do reu'],
                  ['c1_nome', 'Nome cedente 1'],
                  ['c1_cpf', 'CPF cedente 1'],
                  ['c1_endereco', 'Endereco cedente 1'],
                  ['c1_cidade', 'Cidade cedente 1'],
                  ['c1_uf', 'UF cedente 1'],
                  ['c1_cep', 'CEP cedente 1'],
                ] as [keyof Fechamento, string][]
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={(editData[key] as string) ?? ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value || null }))}
                    className="w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor condenacao</label>
                <input
                  type="number"
                  value={editData.valor_condenacao ?? ''}
                  onChange={(e) => setEditData((prev) => ({ ...prev, valor_condenacao: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor fechado</label>
                <input
                  type="number"
                  value={editData.valor_fechado ?? ''}
                  onChange={(e) => setEditData((prev) => ({ ...prev, valor_fechado: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
              <textarea
                value={(editData.observacoes_raw as string) ?? ''}
                onChange={(e) => setEditData((prev) => ({ ...prev, observacoes_raw: e.target.value || null }))}
                rows={3}
                className="w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde resize-y"
              />
            </div>
          </div>
        )}

        {/* Observacoes side-by-side */}
        {f.observacoes_raw && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-verde-escuro mb-4">Observacoes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Original</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-4">
                  {f.observacoes_raw}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Processado (IA)</h3>
                {f.observacoes_processadas ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap bg-verde-claro rounded-lg p-4">
                    {f.observacoes_processadas}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-4">
                    Ainda nao processado. Clique em &quot;Processar Observacoes com IA&quot; acima.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fechamento Comercial */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-verde-escuro mb-4">Fechamento Comercial</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldDisplay label="Numero do processo" value={f.numero_processo} />
            <FieldDisplay label="Comercial responsavel" value={f.comercial_responsavel} />
            <FieldDisplay label="Analista juridico" value={f.analista_juridico} />
            <FieldDisplay label="Data fechamento" value={formatDate(f.data_fechamento)} />
            <FieldDisplay label="Tipo de cessao" value={TIPO_CESSAO_LABELS[f.tipo_cessao]} />
            {f.tipo_cessao === 'personalizado' && (
              <FieldDisplay label="Creditos" value={f.creditos_personalizados?.join(', ')} />
            )}
            <FieldDisplay label="Valor condenacao" value={f.valor_condenacao != null ? formatBRL(f.valor_condenacao) : null} />
            <FieldDisplay label="Valor fechado" value={formatBRL(f.valor_fechado)} />
            <FieldDisplay label="Desagio" value={f.desagio != null ? `${f.desagio}%` : null} />
          </dl>
          {f.incluir_dados_bancarios && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Dados Bancarios</h3>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FieldDisplay label="Banco" value={f.banco} />
                <FieldDisplay label="Agencia" value={f.agencia} />
                <FieldDisplay label="Conta" value={f.conta} />
                <FieldDisplay label="Tipo conta" value={f.tipo_conta} />
                <FieldDisplay label="CPF titular" value={f.banco_cpf} />
              </dl>
            </div>
          )}
        </div>

        {/* Dados do Processo */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-verde-escuro mb-4">Dados do Processo</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldDisplay label="Numero do contrato" value={f.numero_contrato} />
            <FieldDisplay label="Vara" value={f.vara} />
            <FieldDisplay label="Comarca" value={f.comarca} />
            <FieldDisplay label="Nome do autor" value={f.autor_nome} />
            <FieldDisplay label="Nome do reu" value={f.reu_nome} />
          </dl>
        </div>

        {/* Cedente 1 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-verde-escuro mb-4">
            {isAdvogado ? 'Cedente — Advogado' : 'Cedente 1 — Autor/Credor'}
          </h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldDisplay label="Nome" value={f.c1_nome} />
            <FieldDisplay label="Profissao" value={f.c1_profissao} />
            <FieldDisplay label="Nacionalidade" value={f.c1_nacionalidade} />
            <FieldDisplay label="Estado civil" value={f.c1_estado_civil} />
            <FieldDisplay label="Nascimento" value={formatDate(f.c1_nascimento)} />
            <FieldDisplay label="CPF" value={f.c1_cpf} />
            {!isAdvogado && <FieldDisplay label="RG" value={f.c1_rg} />}
            {isAdvogado && <FieldDisplay label="OAB" value={f.c1_oab_uf && f.c1_oab_numero ? `${f.c1_oab_uf} ${f.c1_oab_numero}` : null} />}
            <FieldDisplay label="Endereco" value={f.c1_endereco} />
            <FieldDisplay label="Bairro" value={f.c1_bairro} />
            <FieldDisplay label="Cidade" value={f.c1_cidade} />
            <FieldDisplay label="UF" value={f.c1_uf} />
            <FieldDisplay label="CEP" value={f.c1_cep} />
          </dl>
        </div>

        {/* Cedente 2 */}
        {f.tem_segundo_cedente && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-verde-escuro mb-4">Cedente 2 — Advogado</h2>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FieldDisplay label="Nome" value={f.c2_nome} />
              <FieldDisplay label="Profissao" value={f.c2_profissao} />
              <FieldDisplay label="Nacionalidade" value={f.c2_nacionalidade} />
              <FieldDisplay label="Estado civil" value={f.c2_estado_civil} />
              <FieldDisplay label="Nascimento" value={formatDate(f.c2_nascimento)} />
              <FieldDisplay label="CPF" value={f.c2_cpf} />
              <FieldDisplay label="OAB" value={f.c2_oab_uf && f.c2_oab_numero ? `${f.c2_oab_uf} ${f.c2_oab_numero}` : null} />
              <FieldDisplay label="Endereco" value={f.c2_endereco} />
              <FieldDisplay label="Bairro" value={f.c2_bairro} />
              <FieldDisplay label="Cidade" value={f.c2_cidade} />
              <FieldDisplay label="UF" value={f.c2_uf} />
              <FieldDisplay label="CEP" value={f.c2_cep} />
            </dl>
          </div>
        )}

        {/* Assinatura */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-verde-escuro mb-4">Assinatura</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldDisplay label="Cidade" value={f.cidade_assinatura} />
            <FieldDisplay label="UF" value={f.uf_assinatura} />
            <FieldDisplay label="Data" value={formatDate(f.data_assinatura)} />
          </dl>
        </div>

        {/* Generated contracts */}
        {f.ct_contratos && f.ct_contratos.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-verde-escuro mb-4">Contratos Gerados</h2>
            <div className="space-y-2">
              {f.ct_contratos.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{doc.nome_arquivo}</p>
                    <p className="text-xs text-gray-500">{formatDate(doc.created_at)}</p>
                  </div>
                  {doc.url_arquivo && (
                    <a
                      href={doc.url_arquivo}
                      download
                      className="text-sm font-medium text-dourado hover:text-dourado-escuro transition-colors"
                    >
                      Baixar
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-gray-400 pb-8">
          Criado em {formatDate(f.created_at)} | Atualizado em {formatDate(f.updated_at)}
        </div>
      </div>
    </div>
  )
}

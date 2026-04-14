'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type TipoCessao = 'sucumbencia' | 'honorarios' | 'integral' | 'personalizado'

interface FormData {
  // Tab 1 - Fechamento Comercial
  numero_processo: string
  comercial_responsavel: string
  analista_juridico: string
  data_fechamento: string
  tipo_cessao: TipoCessao
  creditos_personalizados: string[]
  observacoes_raw: string
  valor_condenacao: string
  valor_fechado: string
  incluir_dados_bancarios: boolean
  banco: string
  agencia: string
  conta: string
  tipo_conta: string
  banco_cpf: string

  // Tab 2 - Contrato
  numero_contrato: string
  vara: string
  comarca: string
  autor_nome: string
  reu_nome: string

  // Cedente 1
  c1_nome: string
  c1_profissao: string
  c1_profissao_outro: string
  c1_nacionalidade: string
  c1_nacionalidade_outro: string
  c1_estado_civil: string
  c1_nascimento: string
  c1_cpf: string
  c1_rg: string
  c1_oab_uf: string
  c1_oab_numero: string
  c1_endereco: string
  c1_bairro: string
  c1_cidade: string
  c1_uf: string
  c1_cep: string

  // Cedente 2
  tem_segundo_cedente: boolean
  c2_nome: string
  c2_profissao: string
  c2_profissao_outro: string
  c2_nacionalidade: string
  c2_nacionalidade_outro: string
  c2_estado_civil: string
  c2_nascimento: string
  c2_cpf: string
  c2_oab_uf: string
  c2_oab_numero: string
  c2_endereco: string
  c2_bairro: string
  c2_cidade: string
  c2_uf: string
  c2_cep: string

  // Assinatura
  cidade_assinatura: string
  uf_assinatura: string
  data_assinatura: string
}

const INITIAL_FORM: FormData = {
  numero_processo: '',
  comercial_responsavel: '',
  analista_juridico: '',
  data_fechamento: new Date().toISOString().split('T')[0],
  tipo_cessao: 'sucumbencia',
  creditos_personalizados: [],
  observacoes_raw: '',
  valor_condenacao: '',
  valor_fechado: '',
  incluir_dados_bancarios: false,
  banco: '',
  agencia: '',
  conta: '',
  tipo_conta: 'corrente',
  banco_cpf: '',
  numero_contrato: '',
  vara: '',
  comarca: '',
  autor_nome: '',
  reu_nome: '',
  c1_nome: '',
  c1_profissao: '',
  c1_profissao_outro: '',
  c1_nacionalidade: '',
  c1_nacionalidade_outro: '',
  c1_estado_civil: '',
  c1_nascimento: '',
  c1_cpf: '',
  c1_rg: '',
  c1_oab_uf: '',
  c1_oab_numero: '',
  c1_endereco: '',
  c1_bairro: '',
  c1_cidade: '',
  c1_uf: '',
  c1_cep: '',
  tem_segundo_cedente: false,
  c2_nome: '',
  c2_profissao: '',
  c2_profissao_outro: '',
  c2_nacionalidade: '',
  c2_nacionalidade_outro: '',
  c2_estado_civil: '',
  c2_nascimento: '',
  c2_cpf: '',
  c2_oab_uf: '',
  c2_oab_numero: '',
  c2_endereco: '',
  c2_bairro: '',
  c2_cidade: '',
  c2_uf: '',
  c2_cep: '',
  cidade_assinatura: '',
  uf_assinatura: '',
  data_assinatura: new Date().toISOString().split('T')[0],
}

const PROFISSOES = ['Advogado', 'Aposentado', 'Empresario', 'Servidor Publico']
const NACIONALIDADES = ['Brasileiro', 'Brasileira']
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viuvo(a)']
const CREDITOS_OPTIONS = ['Principal', 'Honorarios', 'Sucumbencia']

function PillGroup({
  options,
  value,
  onChange,
  allowCustom = false,
  customValue = '',
  onCustomChange,
  customPlaceholder = 'Outro',
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  allowCustom?: boolean
  customValue?: string
  onCustomChange?: (v: string) => void
  customPlaceholder?: string
}) {
  const isCustom = value !== '' && !options.includes(value)

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
            value === opt
              ? 'bg-verde text-white border-verde'
              : 'bg-white text-gray-600 border-gray-300 hover:border-verde hover:text-verde'
          )}
        >
          {opt}
        </button>
      ))}
      {allowCustom && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange('__custom__')}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              isCustom || value === '__custom__'
                ? 'bg-verde text-white border-verde'
                : 'bg-white text-gray-600 border-gray-300 hover:border-verde hover:text-verde'
            )}
          >
            Outro
          </button>
          {(isCustom || value === '__custom__') && (
            <input
              type="text"
              value={customValue}
              onChange={(e) => {
                onCustomChange?.(e.target.value)
                onChange('__custom__')
              }}
              placeholder={customPlaceholder}
              className="border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde w-40"
            />
          )}
        </div>
      )}
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
  hint,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde',
          disabled && 'bg-gray-100 cursor-not-allowed'
        )}
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function NovoContratoClient() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'fechamento' | 'contrato'>('fechamento')
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const update = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // Auto-open Cedente 2 when tipo = integral
  useEffect(() => {
    if (form.tipo_cessao === 'integral') {
      update('tem_segundo_cedente', true)
    }
  }, [form.tipo_cessao, update])

  const desagio = (() => {
    const cond = parseFloat(form.valor_condenacao)
    const fech = parseFloat(form.valor_fechado)
    if (!cond || !fech || cond <= 0) return null
    return Math.round(((cond - fech) / cond) * 10000) / 100
  })()

  function resolveProfissao(profissao: string, outro: string): string | null {
    if (profissao === '__custom__') return outro || null
    return profissao || null
  }

  function resolveNacionalidade(nac: string, outro: string): string | null {
    if (nac === '__custom__') return outro || null
    return nac || null
  }

  function buildPayload() {
    const isAdvogado = form.tipo_cessao === 'sucumbencia' || form.tipo_cessao === 'honorarios'

    return {
      numero_processo: form.numero_processo,
      comercial_responsavel: form.comercial_responsavel,
      analista_juridico: form.analista_juridico || null,
      data_fechamento: form.data_fechamento,
      tipo_cessao: form.tipo_cessao,
      creditos_personalizados: form.tipo_cessao === 'personalizado' ? form.creditos_personalizados : [],
      observacoes_raw: form.observacoes_raw || null,
      valor_condenacao: form.valor_condenacao ? parseFloat(form.valor_condenacao) : null,
      valor_fechado: parseFloat(form.valor_fechado),
      incluir_dados_bancarios: form.incluir_dados_bancarios,
      banco: form.incluir_dados_bancarios ? form.banco || null : null,
      agencia: form.incluir_dados_bancarios ? form.agencia || null : null,
      conta: form.incluir_dados_bancarios ? form.conta || null : null,
      tipo_conta: form.incluir_dados_bancarios ? form.tipo_conta || null : null,
      banco_cpf: form.incluir_dados_bancarios ? form.banco_cpf || null : null,
      numero_contrato: form.numero_contrato || null,
      vara: form.vara || null,
      comarca: form.comarca || null,
      autor_nome: form.autor_nome || null,
      reu_nome: form.reu_nome || null,
      c1_nome: form.c1_nome || null,
      c1_profissao: resolveProfissao(form.c1_profissao, form.c1_profissao_outro),
      c1_nacionalidade: resolveNacionalidade(form.c1_nacionalidade, form.c1_nacionalidade_outro),
      c1_estado_civil: form.c1_estado_civil || null,
      c1_nascimento: form.c1_nascimento || null,
      c1_cpf: form.c1_cpf || null,
      c1_rg: !isAdvogado ? (form.c1_rg || null) : null,
      c1_oab_uf: isAdvogado ? (form.c1_oab_uf || null) : null,
      c1_oab_numero: isAdvogado ? (form.c1_oab_numero || null) : null,
      c1_endereco: form.c1_endereco || null,
      c1_bairro: form.c1_bairro || null,
      c1_cidade: form.c1_cidade || null,
      c1_uf: form.c1_uf || null,
      c1_cep: form.c1_cep || null,
      tem_segundo_cedente: form.tem_segundo_cedente,
      c2_nome: form.tem_segundo_cedente ? (form.c2_nome || null) : null,
      c2_profissao: form.tem_segundo_cedente ? resolveProfissao(form.c2_profissao, form.c2_profissao_outro) : null,
      c2_nacionalidade: form.tem_segundo_cedente ? resolveNacionalidade(form.c2_nacionalidade, form.c2_nacionalidade_outro) : null,
      c2_estado_civil: form.tem_segundo_cedente ? (form.c2_estado_civil || null) : null,
      c2_nascimento: form.tem_segundo_cedente ? (form.c2_nascimento || null) : null,
      c2_cpf: form.tem_segundo_cedente ? (form.c2_cpf || null) : null,
      c2_oab_uf: form.tem_segundo_cedente ? (form.c2_oab_uf || null) : null,
      c2_oab_numero: form.tem_segundo_cedente ? (form.c2_oab_numero || null) : null,
      c2_endereco: form.tem_segundo_cedente ? (form.c2_endereco || null) : null,
      c2_bairro: form.tem_segundo_cedente ? (form.c2_bairro || null) : null,
      c2_cidade: form.tem_segundo_cedente ? (form.c2_cidade || null) : null,
      c2_uf: form.tem_segundo_cedente ? (form.c2_uf || null) : null,
      c2_cep: form.tem_segundo_cedente ? (form.c2_cep || null) : null,
      cidade_assinatura: form.cidade_assinatura || null,
      uf_assinatura: form.uf_assinatura || null,
      data_assinatura: form.data_assinatura || null,
      status: 'rascunho' as const,
    }
  }

  async function handleSave() {
    if (!form.numero_processo || !form.comercial_responsavel || !form.valor_fechado) {
      alert('Preencha os campos obrigatorios: Numero do processo, Comercial responsavel e Valor fechado.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar')
      }
      const data = await res.json()
      router.push(`/contratos/${data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar contrato'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndGenerate() {
    if (!form.numero_processo || !form.comercial_responsavel || !form.valor_fechado) {
      alert('Preencha os campos obrigatorios: Numero do processo, Comercial responsavel e Valor fechado.')
      return
    }

    setGenerating(true)
    try {
      // 1. Save
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar')
      }
      const data = await res.json()

      // 2. Generate .docx
      const genRes = await fetch(`/api/contratos/${data.id}/gerar`, { method: 'POST' })
      if (!genRes.ok) throw new Error('Erro ao gerar contrato')

      const blob = await genRes.blob()
      const disposition = genRes.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?(.+?)"?$/)
      const filename = match?.[1] || `contrato_${data.id}.docx`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      router.push(`/contratos/${data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar contrato'
      alert(message)
    } finally {
      setGenerating(false)
    }
  }

  const isAdvogado = form.tipo_cessao === 'sucumbencia' || form.tipo_cessao === 'honorarios'
  const showRG = !isAdvogado
  const showOAB = isAdvogado

  const cedente1Label = isAdvogado
    ? 'Cedente — Advogado'
    : 'Cedente 1 — Autor/Credor'

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-verde-escuro mb-6">Novo Contrato</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('fechamento')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'fechamento'
                ? 'bg-white text-verde shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Fechamento Comercial
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contrato')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'contrato'
                ? 'bg-white text-verde shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Contrato (dados do cedente)
          </button>
        </div>

        {/* Tab 1: Fechamento Comercial */}
        {activeTab === 'fechamento' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Numero do processo"
                value={form.numero_processo}
                onChange={(v) => update('numero_processo', v)}
                required
                placeholder="0000000-00.0000.0.00.0000"
                hint="Formato: NNNNNNN-NN.NNNN.N.NN.NNNN"
              />
              <InputField
                label="Comercial responsavel"
                value={form.comercial_responsavel}
                onChange={(v) => update('comercial_responsavel', v)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Analista juridico"
                value={form.analista_juridico}
                onChange={(v) => update('analista_juridico', v)}
              />
              <InputField
                label="Data do fechamento"
                value={form.data_fechamento}
                onChange={(v) => update('data_fechamento', v)}
                type="date"
              />
            </div>

            {/* Tipo de cessao */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de cessao <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(['sucumbencia', 'honorarios', 'integral', 'personalizado'] as TipoCessao[]).map((tipo) => {
                  const labels: Record<TipoCessao, string> = {
                    sucumbencia: 'Sucumbencia',
                    honorarios: 'Honorarios',
                    integral: 'Integral',
                    personalizado: 'Personalizado',
                  }
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => update('tipo_cessao', tipo)}
                      className={cn(
                        'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                        form.tipo_cessao === tipo
                          ? 'bg-verde text-white border-verde'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-verde hover:text-verde'
                      )}
                    >
                      {labels[tipo]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Creditos personalizados */}
            {form.tipo_cessao === 'personalizado' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Creditos personalizados
                </label>
                <div className="flex flex-wrap gap-3">
                  {CREDITOS_OPTIONS.map((cred) => (
                    <label key={cred} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.creditos_personalizados.includes(cred)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            update('creditos_personalizados', [...form.creditos_personalizados, cred])
                          } else {
                            update(
                              'creditos_personalizados',
                              form.creditos_personalizados.filter((c) => c !== cred)
                            )
                          }
                        }}
                        className="rounded border-gray-300 text-verde focus:ring-verde"
                      />
                      <span className="text-sm text-gray-700">{cred}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Observacoes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observacoes da negociacao
              </label>
              <textarea
                value={form.observacoes_raw}
                onChange={(e) => update('observacoes_raw', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30 focus:border-verde resize-y"
                placeholder="Observacoes sobre a negociacao..."
              />
            </div>

            {/* Valores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField
                label="Valor da condenacao"
                value={form.valor_condenacao}
                onChange={(v) => update('valor_condenacao', v)}
                type="number"
                placeholder="0.00"
              />
              <InputField
                label="Valor fechado"
                value={form.valor_fechado}
                onChange={(v) => update('valor_fechado', v)}
                type="number"
                required
                placeholder="0.00"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desagio</label>
                <div className="w-full border border-gray-200 bg-gray-50 text-gray-600 rounded-lg px-3 py-2 text-sm">
                  {desagio != null ? `${desagio}%` : '-'}
                </div>
              </div>
            </div>

            {/* Dados bancarios */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Incluir dados bancarios
              </label>
              <div className="flex gap-2">
                {[
                  { value: true, label: 'Sim' },
                  { value: false, label: 'Nao' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => update('incluir_dados_bancarios', opt.value)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      form.incluir_dados_bancarios === opt.value
                        ? 'bg-verde text-white border-verde'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-verde hover:text-verde'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.incluir_dados_bancarios && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-verde-claro">
                <InputField
                  label="Banco"
                  value={form.banco}
                  onChange={(v) => update('banco', v)}
                />
                <InputField
                  label="Agencia"
                  value={form.agencia}
                  onChange={(v) => update('agencia', v)}
                />
                <InputField
                  label="Conta"
                  value={form.conta}
                  onChange={(v) => update('conta', v)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de conta
                  </label>
                  <div className="flex gap-2">
                    {['corrente', 'poupanca'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => update('tipo_conta', t)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                          form.tipo_conta === t
                            ? 'bg-verde text-white border-verde'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-verde hover:text-verde'
                        )}
                      >
                        {t === 'corrente' ? 'Corrente' : 'Poupanca'}
                      </button>
                    ))}
                  </div>
                </div>
                <InputField
                  label="CPF do titular"
                  value={form.banco_cpf}
                  onChange={(v) => update('banco_cpf', v)}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Contrato */}
        {activeTab === 'contrato' && (
          <div className="space-y-6">
            {/* Dados do processo */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-verde-escuro">Dados do Processo</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField
                  label="Numero do contrato"
                  value={form.numero_contrato}
                  onChange={(v) => update('numero_contrato', v)}
                />
                <InputField
                  label="Vara"
                  value={form.vara}
                  onChange={(v) => update('vara', v)}
                />
                <InputField
                  label="Comarca"
                  value={form.comarca}
                  onChange={(v) => update('comarca', v)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Nome do autor"
                  value={form.autor_nome}
                  onChange={(v) => update('autor_nome', v)}
                />
                <InputField
                  label="Nome do reu"
                  value={form.reu_nome}
                  onChange={(v) => update('reu_nome', v)}
                />
              </div>
            </div>

            {/* Cedente 1 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-verde-escuro">{cedente1Label}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Nome"
                  value={form.c1_nome}
                  onChange={(v) => update('c1_nome', v)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Profissao</label>
                  <PillGroup
                    options={PROFISSOES}
                    value={form.c1_profissao}
                    onChange={(v) => update('c1_profissao', v)}
                    allowCustom
                    customValue={form.c1_profissao_outro}
                    onCustomChange={(v) => update('c1_profissao_outro', v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nacionalidade</label>
                  <PillGroup
                    options={NACIONALIDADES}
                    value={form.c1_nacionalidade}
                    onChange={(v) => update('c1_nacionalidade', v)}
                    allowCustom
                    customValue={form.c1_nacionalidade_outro}
                    onCustomChange={(v) => update('c1_nacionalidade_outro', v)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estado civil</label>
                  <PillGroup
                    options={ESTADOS_CIVIS}
                    value={form.c1_estado_civil}
                    onChange={(v) => update('c1_estado_civil', v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField
                  label="Nascimento"
                  value={form.c1_nascimento}
                  onChange={(v) => update('c1_nascimento', v)}
                  type="date"
                />
                <InputField
                  label="CPF"
                  value={form.c1_cpf}
                  onChange={(v) => update('c1_cpf', v)}
                  placeholder="000.000.000-00"
                />
                {showRG && (
                  <InputField
                    label="RG"
                    value={form.c1_rg}
                    onChange={(v) => update('c1_rg', v)}
                  />
                )}
              </div>

              {showOAB && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="OAB UF"
                    value={form.c1_oab_uf}
                    onChange={(v) => update('c1_oab_uf', v)}
                    placeholder="SP"
                  />
                  <InputField
                    label="OAB Numero"
                    value={form.c1_oab_numero}
                    onChange={(v) => update('c1_oab_numero', v)}
                  />
                </div>
              )}

              <InputField
                label="Endereco"
                value={form.c1_endereco}
                onChange={(v) => update('c1_endereco', v)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Bairro"
                  value={form.c1_bairro}
                  onChange={(v) => update('c1_bairro', v)}
                />
                <InputField
                  label="Cidade"
                  value={form.c1_cidade}
                  onChange={(v) => update('c1_cidade', v)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="UF"
                  value={form.c1_uf}
                  onChange={(v) => update('c1_uf', v)}
                  placeholder="SP"
                />
                <InputField
                  label="CEP"
                  value={form.c1_cep}
                  onChange={(v) => update('c1_cep', v)}
                  placeholder="00000-000"
                />
              </div>
            </div>

            {/* Toggle Cedente 2 */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => update('tem_segundo_cedente', !form.tem_segundo_cedente)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  form.tem_segundo_cedente ? 'bg-verde' : 'bg-gray-300'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow',
                    form.tem_segundo_cedente && 'translate-x-5'
                  )}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">Segundo cedente</span>
            </div>

            {/* Cedente 2 */}
            {form.tem_segundo_cedente && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-verde-escuro">Cedente 2 — Advogado</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Nome"
                    value={form.c2_nome}
                    onChange={(v) => update('c2_nome', v)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profissao</label>
                    <PillGroup
                      options={PROFISSOES}
                      value={form.c2_profissao}
                      onChange={(v) => update('c2_profissao', v)}
                      allowCustom
                      customValue={form.c2_profissao_outro}
                      onCustomChange={(v) => update('c2_profissao_outro', v)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nacionalidade</label>
                    <PillGroup
                      options={NACIONALIDADES}
                      value={form.c2_nacionalidade}
                      onChange={(v) => update('c2_nacionalidade', v)}
                      allowCustom
                      customValue={form.c2_nacionalidade_outro}
                      onCustomChange={(v) => update('c2_nacionalidade_outro', v)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estado civil</label>
                    <PillGroup
                      options={ESTADOS_CIVIS}
                      value={form.c2_estado_civil}
                      onChange={(v) => update('c2_estado_civil', v)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Nascimento"
                    value={form.c2_nascimento}
                    onChange={(v) => update('c2_nascimento', v)}
                    type="date"
                  />
                  <InputField
                    label="CPF"
                    value={form.c2_cpf}
                    onChange={(v) => update('c2_cpf', v)}
                    placeholder="000.000.000-00"
                  />
                </div>

                {/* Cedente 2 always shows OAB (advogado) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="OAB UF"
                    value={form.c2_oab_uf}
                    onChange={(v) => update('c2_oab_uf', v)}
                    placeholder="SP"
                  />
                  <InputField
                    label="OAB Numero"
                    value={form.c2_oab_numero}
                    onChange={(v) => update('c2_oab_numero', v)}
                  />
                </div>

                <InputField
                  label="Endereco"
                  value={form.c2_endereco}
                  onChange={(v) => update('c2_endereco', v)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Bairro"
                    value={form.c2_bairro}
                    onChange={(v) => update('c2_bairro', v)}
                  />
                  <InputField
                    label="Cidade"
                    value={form.c2_cidade}
                    onChange={(v) => update('c2_cidade', v)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="UF"
                    value={form.c2_uf}
                    onChange={(v) => update('c2_uf', v)}
                    placeholder="SP"
                  />
                  <InputField
                    label="CEP"
                    value={form.c2_cep}
                    onChange={(v) => update('c2_cep', v)}
                    placeholder="00000-000"
                  />
                </div>
              </div>
            )}

            {/* Assinatura */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-verde-escuro">Assinatura</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputField
                  label="Cidade"
                  value={form.cidade_assinatura}
                  onChange={(v) => update('cidade_assinatura', v)}
                />
                <InputField
                  label="UF"
                  value={form.uf_assinatura}
                  onChange={(v) => update('uf_assinatura', v)}
                  placeholder="SP"
                />
                <InputField
                  label="Data da assinatura"
                  value={form.data_assinatura}
                  onChange={(v) => update('data_assinatura', v)}
                  type="date"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pb-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || generating}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium border border-verde text-verde hover:bg-verde-claro transition-colors',
              (saving || generating) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </button>
          <button
            type="button"
            onClick={handleSaveAndGenerate}
            disabled={saving || generating}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium bg-verde text-white hover:bg-verde-escuro transition-colors',
              (saving || generating) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {generating ? 'Gerando...' : 'Salvar e Gerar Contrato'}
          </button>
        </div>
      </div>
    </div>
  )
}

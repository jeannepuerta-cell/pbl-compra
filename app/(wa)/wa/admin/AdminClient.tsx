'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WaPrompt, WaBotConfig } from '@/lib/wa-types'

// --------------- Types ---------------

interface BotWithPrompts extends WaBotConfig {
  prompt_atendimento: { id: string; nome: string } | null
  prompt_refinamento: { id: string; nome: string } | null
}

type Tab = 'bots' | 'prompts'

type PromptTipo = WaPrompt['tipo']

const TIPO_COLORS: Record<PromptTipo, string> = {
  atendimento: 'bg-blue-100 text-blue-800',
  refinamento: 'bg-purple-100 text-purple-800',
  analise_divergencia: 'bg-orange-100 text-orange-800',
  reescrita_prompt: 'bg-teal-100 text-teal-800',
}

const TIPO_LABELS: Record<PromptTipo, string> = {
  atendimento: 'Atendimento',
  refinamento: 'Refinamento',
  analise_divergencia: 'Analise Diverg.',
  reescrita_prompt: 'Reescrita Prompt',
}

// --------------- Toast ---------------

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
        type === 'success' ? 'bg-[#01423e]' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  )
}

// --------------- Main ---------------

export default function AdminClient() {
  const [tab, setTab] = useState<Tab>('bots')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-6xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <h1 className="text-2xl font-bold text-[#01423e] mb-6">Admin WhatsApp Bot</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['bots', 'prompts'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t
                ? 'bg-white text-[#01423e] border border-b-white border-gray-200 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'bots' ? 'Bots' : 'Prompts'}
          </button>
        ))}
      </div>

      {tab === 'bots' ? <BotsTab showToast={showToast} /> : <PromptsTab showToast={showToast} />}
    </div>
  )
}

// =====================================================================
// BOTS TAB
// =====================================================================

function BotsTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const [bots, setBots] = useState<BotWithPrompts[]>([])
  const [prompts, setPrompts] = useState<WaPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBot, setEditingBot] = useState<BotWithPrompts | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [botsRes, promptsRes] = await Promise.all([
        fetch('/api/wa/bots-config'),
        fetch('/api/wa/prompts'),
      ])
      if (botsRes.ok) setBots(await botsRes.json())
      if (promptsRes.ok) setPrompts(await promptsRes.json())
    } catch {
      showToast('Erro ao carregar dados.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleAtivo = async (bot: BotWithPrompts) => {
    try {
      const res = await fetch('/api/wa/bots-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bot.id, ativo: !bot.ativo }),
      })
      if (res.ok) {
        showToast(`Bot ${!bot.ativo ? 'ativado' : 'desativado'}.`, 'success')
        fetchData()
      } else {
        showToast('Erro ao atualizar bot.', 'error')
      }
    } catch {
      showToast('Erro ao atualizar bot.', 'error')
    }
  }

  const openEdit = (bot: BotWithPrompts) => {
    setEditingBot(bot)
    setModalOpen(true)
  }

  const openNew = () => {
    setEditingBot(null)
    setModalOpen(true)
  }

  if (loading) {
    return <div className="text-gray-500 text-center py-12">Carregando...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Bots Configurados</h2>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-[#01423e] text-white text-sm font-medium rounded-lg hover:bg-[#01322f] transition-colors"
        >
          + Novo Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-lg border">Nenhum bot configurado.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{bot.nome}</h3>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                      bot.modo === 'producao' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {bot.modo === 'producao' ? 'Producao' : 'Treinamento'}
                  </span>
                </div>
                <button
                  onClick={() => toggleAtivo(bot)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    bot.ativo ? 'bg-[#01423e]' : 'bg-gray-300'
                  }`}
                  title={bot.ativo ? 'Ativo' : 'Inativo'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      bot.ativo ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="text-xs text-gray-500 space-y-1 mb-4">
                <p>
                  <span className="font-medium">Atendimento:</span>{' '}
                  {bot.prompt_atendimento?.nome || <span className="text-gray-300">--</span>}
                </p>
                <p>
                  <span className="font-medium">Refinamento:</span>{' '}
                  {bot.prompt_refinamento?.nome || <span className="text-gray-300">--</span>}
                </p>
              </div>

              <button
                onClick={() => openEdit(bot)}
                className="text-sm text-[#01423e] hover:underline font-medium"
              >
                Editar
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <BotModal
          bot={editingBot}
          prompts={prompts}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            fetchData()
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// --------------- Bot Modal ---------------

function BotModal({
  bot,
  prompts,
  onClose,
  onSaved,
  showToast,
}: {
  bot: BotWithPrompts | null
  prompts: WaPrompt[]
  onClose: () => void
  onSaved: () => void
  showToast: (m: string, t: 'success' | 'error') => void
}) {
  const [nome, setNome] = useState(bot?.nome || '')
  const [promptAtendimentoId, setPromptAtendimentoId] = useState(bot?.prompt_atendimento_id || '')
  const [promptRefinamentoId, setPromptRefinamentoId] = useState(bot?.prompt_refinamento_id || '')
  const [modo, setModo] = useState<'treinamento' | 'producao'>(bot?.modo || 'treinamento')
  const [mensagemBoasVindas, setMensagemBoasVindas] = useState(bot?.mensagem_boas_vindas || '')
  const [palavrasEscalacao, setPalavrasEscalacao] = useState(bot?.palavras_escalacao?.join(', ') || '')
  const [saving, setSaving] = useState(false)

  const atendimentoPrompts = prompts.filter((p) => p.tipo === 'atendimento' && p.ativo)
  const refinamentoPrompts = prompts.filter((p) => p.tipo === 'refinamento' && p.ativo)

  const handleSave = async () => {
    if (!nome.trim()) {
      showToast('Nome e obrigatorio.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...(bot ? { id: bot.id } : {}),
        nome: nome.trim(),
        prompt_atendimento_id: promptAtendimentoId || null,
        prompt_refinamento_id: promptRefinamentoId || null,
        modo,
        mensagem_boas_vindas: mensagemBoasVindas,
        palavras_escalacao: palavrasEscalacao
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean),
      }

      const res = await fetch('/api/wa/bots-config', {
        method: bot ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        showToast(bot ? 'Bot atualizado!' : 'Bot criado!', 'success')
        onSaved()
      } else {
        const err = await res.json()
        showToast(err.error || 'Erro ao salvar.', 'error')
      }
    } catch {
      showToast('Erro ao salvar bot.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[#01423e] mb-5">{bot ? 'Editar Bot' : 'Novo Bot'}</h3>

        <div className="space-y-4">
          <Field label="Nome">
            <input
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do bot"
            />
          </Field>

          <Field label="Prompt Atendimento">
            <select
              className="input-field"
              value={promptAtendimentoId}
              onChange={(e) => setPromptAtendimentoId(e.target.value)}
            >
              <option value="">-- Nenhum --</option>
              {atendimentoPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} (v{p.versao})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prompt Refinamento">
            <select
              className="input-field"
              value={promptRefinamentoId}
              onChange={(e) => setPromptRefinamentoId(e.target.value)}
            >
              <option value="">-- Nenhum --</option>
              {refinamentoPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} (v{p.versao})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Modo">
            <select
              className="input-field"
              value={modo}
              onChange={(e) => setModo(e.target.value as 'treinamento' | 'producao')}
            >
              <option value="treinamento">Treinamento</option>
              <option value="producao">Producao</option>
            </select>
          </Field>

          <Field label="Mensagem de Boas-Vindas">
            <textarea
              className="input-field min-h-[80px] resize-y"
              value={mensagemBoasVindas}
              onChange={(e) => setMensagemBoasVindas(e.target.value)}
              placeholder="Ola! Como posso ajudar?"
            />
          </Field>

          <Field label="Palavras de Escalacao (separadas por virgula)">
            <input
              className="input-field"
              value={palavrasEscalacao}
              onChange={(e) => setPalavrasEscalacao(e.target.value)}
              placeholder="humano, atendente, gerente"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#01423e] text-white text-sm font-medium rounded-lg hover:bg-[#01322f] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// PROMPTS TAB
// =====================================================================

function PromptsTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const [prompts, setPrompts] = useState<WaPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch('/api/wa/prompts')
      if (res.ok) setPrompts(await res.json())
    } catch {
      showToast('Erro ao carregar prompts.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  // Group prompts by nome
  const grouped = prompts.reduce<Record<string, WaPrompt[]>>((acc, p) => {
    if (!acc[p.nome]) acc[p.nome] = []
    acc[p.nome].push(p)
    return acc
  }, {})

  // Sort groups by tipo then nome
  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const tipoA = a[0].tipo
    const tipoB = b[0].tipo
    if (tipoA !== tipoB) return tipoA.localeCompare(tipoB)
    return a[0].nome.localeCompare(b[0].nome)
  })

  if (loading) {
    return <div className="text-gray-500 text-center py-12">Carregando...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Prompts</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-[#01423e] text-white text-sm font-medium rounded-lg hover:bg-[#01322f] transition-colors"
        >
          + Novo Prompt
        </button>
      </div>

      {sortedGroups.length === 0 ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-lg border">Nenhum prompt cadastrado.</div>
      ) : (
        <div className="space-y-3">
          {sortedGroups.map(([nome, versions]) => {
            const tipo = versions[0].tipo
            return (
              <div key={nome} className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-5 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{nome}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[tipo]}`}>
                      {TIPO_LABELS[tipo]}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">{versions.length} versao(oes)</span>
                  </div>
                </div>

                <div className="divide-y divide-gray-50">
                  {versions.map((p) => {
                    const isExpanded = expandedId === p.id
                    return (
                      <div key={p.id}>
                        <button
                          className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${p.ativo ? 'bg-green-500' : 'bg-gray-300'}`}
                            title={p.ativo ? 'Ativo' : 'Inativo'}
                          />
                          <span className="text-sm text-gray-700">v{p.versao}</span>
                          <span className="text-xs text-gray-400">{p.modelo}</span>
                          <svg
                            className={`ml-auto h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <PromptEditor
                            prompt={p}
                            onSaved={fetchPrompts}
                            showToast={showToast}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <NewPromptModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            fetchPrompts()
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// --------------- Prompt Editor (inline) ---------------

function PromptEditor({
  prompt: initial,
  onSaved,
  showToast,
}: {
  prompt: WaPrompt
  onSaved: () => void
  showToast: (m: string, t: 'success' | 'error') => void
}) {
  const [nome, setNome] = useState(initial.nome)
  const [tipo, setTipo] = useState<PromptTipo>(initial.tipo)
  const [systemPrompt, setSystemPrompt] = useState(initial.system_prompt)
  const [modelo, setModelo] = useState(initial.modelo)
  const [temperatura, setTemperatura] = useState(initial.temperatura)
  const [ativo, setAtivo] = useState(initial.ativo)
  const [guardRails, setGuardRails] = useState(JSON.stringify(initial.guard_rails, null, 2))
  const [guardRailsError, setGuardRailsError] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleGuardRailsChange = (val: string) => {
    setGuardRails(val)
    try {
      JSON.parse(val)
      setGuardRailsError(false)
    } catch {
      setGuardRailsError(true)
    }
  }

  const handleSave = async () => {
    if (guardRailsError) {
      showToast('guard_rails contem JSON invalido.', 'error')
      return
    }
    setSaving(true)
    try {
      let parsedGuardRails = {}
      try {
        parsedGuardRails = JSON.parse(guardRails)
      } catch {
        /* keep empty */
      }

      const res = await fetch('/api/wa/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initial.id,
          nome,
          tipo,
          system_prompt: systemPrompt,
          modelo,
          temperatura,
          ativo,
          guard_rails: parsedGuardRails,
        }),
      })

      if (res.ok) {
        showToast('Prompt atualizado!', 'success')
        onSaved()
      } else {
        const err = await res.json()
        showToast(err.error || 'Erro ao salvar.', 'error')
      }
    } catch {
      showToast('Erro ao salvar prompt.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 py-4 bg-gray-50 space-y-4 border-t border-gray-100">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome">
          <input className="input-field" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Tipo">
          <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value as PromptTipo)}>
            <option value="atendimento">Atendimento</option>
            <option value="refinamento">Refinamento</option>
            <option value="analise_divergencia">Analise Divergencia</option>
            <option value="reescrita_prompt">Reescrita Prompt</option>
          </select>
        </Field>
      </div>

      <Field label="System Prompt">
        <textarea
          className="input-field min-h-[200px] resize-y font-mono text-sm"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Modelo">
          <input className="input-field" value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </Field>
        <Field label="Temperatura (0-1)">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="input-field"
            value={temperatura}
            onChange={(e) => setTemperatura(parseFloat(e.target.value) || 0)}
          />
        </Field>
      </div>

      <Field label={`Guard Rails (JSON)${guardRailsError ? ' -- JSON invalido!' : ''}`}>
        <textarea
          className={`input-field min-h-[100px] resize-y font-mono text-sm ${
            guardRailsError ? 'border-red-400 focus:ring-red-400' : ''
          }`}
          value={guardRails}
          onChange={(e) => handleGuardRailsChange(e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <button
            type="button"
            onClick={() => setAtivo(!ativo)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              ativo ? 'bg-[#01423e]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                ativo ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          Ativo
        </label>

        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#01423e] text-white text-sm font-medium rounded-lg hover:bg-[#01322f] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --------------- New Prompt Modal ---------------

function NewPromptModal({
  onClose,
  onSaved,
  showToast,
}: {
  onClose: () => void
  onSaved: () => void
  showToast: (m: string, t: 'success' | 'error') => void
}) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<PromptTipo>('atendimento')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [modelo, setModelo] = useState('gpt-4o-mini')
  const [temperatura, setTemperatura] = useState(0.7)
  const [guardRails, setGuardRails] = useState('{}')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!nome.trim() || !systemPrompt.trim()) {
      showToast('Nome e system_prompt sao obrigatorios.', 'error')
      return
    }

    let parsedGuardRails = {}
    try {
      parsedGuardRails = JSON.parse(guardRails)
    } catch {
      showToast('guard_rails contem JSON invalido.', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/wa/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          tipo,
          system_prompt: systemPrompt,
          modelo,
          temperatura,
          guard_rails: parsedGuardRails,
        }),
      })

      if (res.ok) {
        showToast('Prompt criado!', 'success')
        onSaved()
      } else {
        const err = await res.json()
        showToast(err.error || 'Erro ao criar prompt.', 'error')
      }
    } catch {
      showToast('Erro ao criar prompt.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[#01423e] mb-5">Novo Prompt</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome">
              <input className="input-field" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do prompt" />
            </Field>
            <Field label="Tipo">
              <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value as PromptTipo)}>
                <option value="atendimento">Atendimento</option>
                <option value="refinamento">Refinamento</option>
                <option value="analise_divergencia">Analise Divergencia</option>
                <option value="reescrita_prompt">Reescrita Prompt</option>
              </select>
            </Field>
          </div>

          <Field label="System Prompt">
            <textarea
              className="input-field min-h-[200px] resize-y font-mono text-sm"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Voce e um assistente..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Modelo">
              <input className="input-field" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </Field>
            <Field label="Temperatura (0-1)">
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className="input-field"
                value={temperatura}
                onChange={(e) => setTemperatura(parseFloat(e.target.value) || 0)}
              />
            </Field>
          </div>

          <Field label="Guard Rails (JSON)">
            <textarea
              className="input-field min-h-[80px] resize-y font-mono text-sm"
              value={guardRails}
              onChange={(e) => setGuardRails(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#01423e] text-white text-sm font-medium rounded-lg hover:bg-[#01322f] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Criar Prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// SHARED
// =====================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
      <style jsx global>{`
        .input-field {
          display: block;
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #374151;
          background: white;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-field:focus {
          border-color: #01423e;
          box-shadow: 0 0 0 2px rgba(1, 66, 62, 0.15);
        }
      `}</style>
    </label>
  )
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { WaConversa, WaMensagem } from '@/lib/wa-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(conversa: WaConversa): string {
  const name = conversa.cliente?.nome
  if (name) return name.charAt(0).toUpperCase()
  const phone = conversa.cliente?.telefone ?? ''
  return phone.charAt(phone.length - 1) || '?'
}

function displayName(conversa: WaConversa): string {
  return conversa.cliente?.nome || conversa.cliente?.telefone || 'Desconhecido'
}

function displayPhone(conversa: WaConversa): string {
  return conversa.cliente?.telefone ?? ''
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) return 'ontem'

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusIndicator(status: WaConversa['status']): string {
  if (status === 'escalada') return '\u{1F534}'
  if (status === 'arquivada') return '\u{1F7E1}'
  return '\u{1F7E2}'
}

// ---------------------------------------------------------------------------
// Avatar colors per initial
// ---------------------------------------------------------------------------
const avatarColors = [
  'bg-emerald-600',
  'bg-sky-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-teal-600',
  'bg-indigo-600',
  'bg-pink-600',
]

function avatarColor(name: string): string {
  let code = 0
  for (let i = 0; i < name.length; i++) code += name.charCodeAt(i)
  return avatarColors[code % avatarColors.length]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InboxClientProps {
  initialConversas: WaConversa[]
}

export default function InboxClient({ initialConversas }: InboxClientProps) {
  // --- state ---------------------------------------------------------------
  const [conversas, setConversas] = useState<WaConversa[]>(initialConversas)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<WaMensagem[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileShowChat, setMobileShowChat] = useState(false)

  // Per-message inline action state (keyed by message ID)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editedText, setEditedText] = useState('')
  const [refiningMsgId, setRefiningMsgId] = useState<string | null>(null)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refining, setRefining] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const selectedConversa = conversas.find((c) => c.id === selectedId) ?? null

  // Check if a message is a pending AI suggestion
  const isPendingSuggestion = (msg: WaMensagem) =>
    msg.direcao === 'out' &&
    msg.autor === 'ia' &&
    msg.resposta_sugerida_ia &&
    msg.modo_no_momento === 'treinamento' &&
    !msg.aprovada_por

  const hasPendingSuggestions = mensagens.some(isPendingSuggestion)

  // --- effects -------------------------------------------------------------

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Fetch messages when conversation is selected
  const fetchMessages = useCallback(async (conversaId: string) => {
    setLoadingMsgs(true)
    try {
      const res = await fetch(`/api/wa/conversas/${conversaId}/mensagens`)
      if (res.ok) {
        const data: WaMensagem[] = await res.json()
        setMensagens(data)
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setLoadingMsgs(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
      setEditingMsgId(null)
      setRefiningMsgId(null)
    } else {
      setMensagens([])
    }
  }, [selectedId, fetchMessages])

  // Supabase realtime subscriptions
  useEffect(() => {
    const supabase = createClient()

    // Subscribe to new messages for the selected conversation
    const msgChannel = selectedId
      ? supabase
          .channel(`wa_msgs_${selectedId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'wa_mensagens',
              filter: `conversa_id=eq.${selectedId}`,
            },
            (payload) => {
              const newMsg = payload.new as WaMensagem
              setMensagens((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.id === newMsg.id)) return prev
                return [...prev, newMsg]
              })
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'wa_mensagens',
              filter: `conversa_id=eq.${selectedId}`,
            },
            (payload) => {
              const updated = payload.new as WaMensagem
              setMensagens((prev) =>
                prev.map((m) => (m.id === updated.id ? updated : m))
              )
            }
          )
          .subscribe()
      : null

    // Subscribe to conversation changes (for sidebar updates)
    const convChannel = supabase
      .channel('wa_conversas_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wa_conversas',
        },
        () => {
          // Re-fetch conversations list
          fetchConversas()
        }
      )
      .subscribe()

    return () => {
      if (msgChannel) supabase.removeChannel(msgChannel)
      supabase.removeChannel(convChannel)
    }
  }, [selectedId])

  const fetchConversas = async () => {
    try {
      const res = await fetch('/api/wa/conversas')
      if (res.ok) {
        const data: WaConversa[] = await res.json()
        setConversas(data)
      }
    } catch (err) {
      console.error('Error fetching conversas:', err)
    }
  }

  // --- handlers ------------------------------------------------------------

  const selectConversa = (id: string) => {
    setSelectedId(id)
    setInputText('')
    setMobileShowChat(true)
  }

  const handleSend = async () => {
    if (!inputText.trim() || !selectedId || sending) return
    const texto = inputText.trim()
    setSending(true)
    setInputText('')
    try {
      const res = await fetch('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: selectedId,
          conteudo: texto,
          autor: 'humano',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('Send error:', err)
        setInputText(texto)
      } else {
        await fetchMessages(selectedId)
        fetchConversas()
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setInputText(texto)
    } finally {
      setSending(false)
    }
  }

  // Approve a suggestion as-is
  const handleApprove = async (msg: WaMensagem) => {
    if (!selectedId) return
    setActionLoading(msg.id)
    try {
      await fetch('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: selectedId,
          conteudo: msg.resposta_sugerida_ia,
          autor: 'ia',
        }),
      })
      // Delete the suggestion message (it was sent as a new one by /api/wa/send)
      await handleDeleteSuggestion(msg.id)
      await fetchMessages(selectedId)
    } catch (err) {
      console.error('Error approving:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Start editing a suggestion inline
  const handleStartEdit = (msg: WaMensagem) => {
    setEditingMsgId(msg.id)
    setEditedText(msg.resposta_sugerida_ia || msg.conteudo)
    setRefiningMsgId(null)
  }

  // Send the edited version
  const handleSendEdited = async (msg: WaMensagem) => {
    if (!editedText.trim() || !selectedId) return
    setActionLoading(msg.id)
    try {
      await fetch('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: selectedId,
          conteudo: editedText.trim(),
          autor: 'humano',
        }),
      })
      await handleDeleteSuggestion(msg.id)
      setEditingMsgId(null)
      setEditedText('')
      await fetchMessages(selectedId)
    } catch (err) {
      console.error('Error sending edited:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Start refine mode for a specific message
  const handleStartRefine = (msgId: string) => {
    setRefiningMsgId(msgId)
    setRefineInstruction('')
    setEditingMsgId(null)
  }

  // Submit refinement
  const handleRefine = async (msg: WaMensagem) => {
    if (!refineInstruction.trim() || !selectedId) return
    setRefining(true)
    try {
      const res = await fetch('/api/wa/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: selectedId,
          mensagem_id: msg.id,
          instrucao: refineInstruction.trim(),
        }),
      })
      if (res.ok) {
        setRefineInstruction('')
        setRefiningMsgId(null)
        await fetchMessages(selectedId)
      }
    } catch (err) {
      console.error('Error refining:', err)
    } finally {
      setRefining(false)
    }
  }

  // Delete/cancel a suggestion (remove from chat)
  const handleDeleteSuggestion = async (msgId: string) => {
    if (!selectedId) return
    try {
      const supabase = createClient()
      await supabase.from('wa_mensagens').delete().eq('id', msgId)
      setMensagens((prev) => prev.filter((m) => m.id !== msgId))
    } catch (err) {
      console.error('Error deleting suggestion:', err)
    }
  }

  const handleToggleIA = async () => {
    if (!selectedConversa || !selectedId) return
    const novoValor = !selectedConversa.ia_desabilitada
    try {
      const supabase = createClient()
      await supabase
        .from('wa_conversas')
        .update({ ia_desabilitada: novoValor })
        .eq('id', selectedId)

      setConversas((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, ia_desabilitada: novoValor } : c
        )
      )
    } catch (err) {
      console.error('Error toggling IA:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // --- filtered conversas --------------------------------------------------
  const filteredConversas = conversas
    .filter((c) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const name = (c.cliente?.nome || '').toLowerCase()
      const phone = (c.cliente?.telefone || '').toLowerCase()
      return name.includes(q) || phone.includes(q)
    })
    .sort((a, b) => {
      // IA desabilitada sempre no topo
      if (a.ia_desabilitada && !b.ia_desabilitada) return -1
      if (!a.ia_desabilitada && b.ia_desabilitada) return 1
      // Depois por última mensagem
      return new Date(b.ultima_mensagem_at).getTime() - new Date(a.ultima_mensagem_at).getTime()
    })

  // --- last message preview ------------------------------------------------
  function lastMessagePreview(conversa: WaConversa): string {
    // We don't have ultima_mensagem in the API response yet,
    // so show status indicator instead
    if (conversa.status === 'escalada') return 'Conversa escalada'
    if (conversa.status === 'arquivada') return 'Conversa arquivada'
    return 'Conversa ativa'
  }

  // --- render --------------------------------------------------------------
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ================================================================= */}
      {/* LEFT PANEL - Conversation List                                    */}
      {/* ================================================================= */}
      <div
        className={cn(
          'flex flex-col border-r border-[#d1d7db] bg-white',
          'w-full md:w-[380px] md:min-w-[380px]',
          mobileShowChat && 'hidden md:flex'
        )}
      >
        {/* Sidebar Header */}
        <div className="bg-verde-escuro px-4 py-3 flex items-center gap-3 shrink-0">
          <div className="flex-1">
            <h2 className="text-white font-semibold text-lg leading-tight">
              Conversas
            </h2>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-white border-b border-[#e9edef] shrink-0">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#54656f]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Pesquisar ou comecar uma nova conversa"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-sm text-[#111b21] placeholder:text-[#667781] focus:outline-none focus:ring-1 focus:ring-verde/30"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversas.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[#667781] text-sm">
              Nenhuma conversa encontrada
            </div>
          ) : (
            filteredConversas.map((conversa) => (
              <button
                key={conversa.id}
                onClick={() => selectConversa(conversa.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 border-b border-[#e9edef] text-left transition-colors hover:bg-[#f5f6f6]',
                  selectedId === conversa.id && 'bg-[#f0f2f5]'
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg shrink-0',
                    avatarColor(displayName(conversa))
                  )}
                >
                  {getInitials(conversa)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#111b21] text-[15px] truncate">
                      {displayName(conversa)}
                    </span>
                    <span className="text-xs text-[#667781] whitespace-nowrap ml-2">
                      {formatRelativeTime(conversa.ultima_mensagem_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-sm text-[#667781] truncate">
                      {conversa.ia_desabilitada ? '🤖 IA desabilitada' : lastMessagePreview(conversa)}
                    </span>
                    <span className="text-xs ml-2 shrink-0 flex items-center gap-1">
                      {conversa.ia_desabilitada && (
                        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">SEM IA</span>
                      )}
                      {statusIndicator(conversa.status)}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* RIGHT PANEL - Chat / Empty State                                  */}
      {/* ================================================================= */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0',
          !mobileShowChat && 'hidden md:flex'
        )}
      >
        {!selectedConversa ? (
          /* ----- Empty state ----- */
          <div className="flex-1 flex items-center justify-center bg-[#efeae2]">
            <div className="text-center max-w-md px-8">
              <div className="w-[220px] h-[220px] mx-auto mb-6 rounded-full bg-[#dfe5e7]/50 flex items-center justify-center">
                <svg
                  className="w-24 h-24 text-[#a0aeb3]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-[#41525d] text-3xl font-light mb-3">
                PBL Compra WhatsApp
              </h2>
              <p className="text-[#667781] text-sm leading-relaxed">
                Selecione uma conversa ao lado para visualizar as mensagens e interagir com o cliente.
              </p>
            </div>
          </div>
        ) : (
          /* ----- Chat view ----- */
          <>
            {/* Chat Header */}
            <div className="bg-verde-escuro px-4 py-2.5 flex items-center gap-3 shrink-0 shadow-sm">
              {/* Mobile back button */}
              <button
                onClick={() => setMobileShowChat(false)}
                className="md:hidden flex items-center gap-1 text-white bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1.5 mr-1 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-xs font-medium">Voltar</span>
              </button>

              {/* Avatar */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0',
                  avatarColor(displayName(selectedConversa))
                )}
              >
                {getInitials(selectedConversa)}
              </div>

              {/* Name and phone */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-base truncate">
                    {displayName(selectedConversa)}
                  </span>
                  {selectedConversa.status === 'escalada' && (
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                      ESCALADA
                    </span>
                  )}
                  {hasPendingSuggestions && (
                    <span className="text-xs bg-dourado text-white px-2 py-0.5 rounded-full font-medium">
                      MODO TREINAMENTO
                    </span>
                  )}
                </div>
                <span className="text-verde-claro/70 text-xs">
                  {displayPhone(selectedConversa)}
                </span>
              </div>

              {/* Toggle IA button */}
              <button
                onClick={handleToggleIA}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0',
                  selectedConversa.ia_desabilitada
                    ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                )}
                title={selectedConversa.ia_desabilitada ? 'Ativar IA' : 'Desativar IA'}
              >
                <span className="text-sm">{selectedConversa.ia_desabilitada ? '🤖' : '🤖'}</span>
                {selectedConversa.ia_desabilitada ? 'IA OFF' : 'IA ON'}
              </button>
            </div>

            {/* Messages Area */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto bg-[#efeae2] px-4 md:px-12 lg:px-16 py-4"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-8 h-8 border-4 border-verde/20 border-t-verde rounded-full" />
                </div>
              ) : mensagens.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-white/80 rounded-lg px-4 py-2 text-[#667781] text-sm shadow-sm">
                    Nenhuma mensagem nesta conversa ainda.
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {mensagens.map((msg) => {
                    // System message
                    if (msg.autor === 'sistema') {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <div className="bg-[#ffecd2] rounded-lg px-3 py-1.5 text-xs text-[#54656f] shadow-sm max-w-[85%] text-center">
                            {msg.conteudo}
                            <span className="ml-2 text-[10px] text-[#667781]">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    const isOutgoing = msg.direcao === 'out'
                    const isPending = isPendingSuggestion(msg)
                    const isEditing = editingMsgId === msg.id
                    const isRefiningThis = refiningMsgId === msg.id
                    const isLoadingThis = actionLoading === msg.id

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex mb-1',
                          isOutgoing ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'relative rounded-lg shadow-sm',
                            (isEditing || isRefiningThis) ? 'max-w-[90%] min-w-[60%]' : isPending ? 'max-w-[75%]' : 'max-w-[65%]',
                            isPending
                              ? 'bg-amber-50 border border-amber-300 rounded-tr-none'
                              : isOutgoing
                              ? 'bg-[#d9fdd3] rounded-tr-none'
                              : 'bg-white rounded-tl-none'
                          )}
                        >
                          <div className="px-3 py-1.5">
                            {/* Author label */}
                            <div className={cn(
                              'text-[11px] font-semibold mb-0.5',
                              isPending ? 'text-amber-700' : isOutgoing ? 'text-[#1fa855]' : 'text-[#6b7c85]'
                            )}>
                              {isPending ? '🤖 Sugestão da IA' : msg.autor === 'cliente' ? 'Cliente' : msg.autor === 'ia' ? 'IA' : msg.autor === 'humano' ? 'Humano' : msg.autor}
                            </div>

                            {/* Content or edit area */}
                            {isEditing ? (
                              <div className="space-y-2 mt-1">
                                <textarea
                                  value={editedText}
                                  onChange={(e) => setEditedText(e.target.value)}
                                  rows={6}
                                  className="w-full border border-amber-300 rounded px-3 py-2 text-sm text-[#111b21] focus:outline-none focus:ring-1 focus:ring-verde/30 resize-y bg-white min-h-[120px]"
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleSendEdited(msg)}
                                    disabled={isLoadingThis || !editedText.trim()}
                                    className="px-3 py-1 bg-verde text-white text-xs rounded font-medium hover:bg-verde-escuro disabled:opacity-50"
                                  >
                                    {isLoadingThis ? '...' : 'Enviar'}
                                  </button>
                                  <button
                                    onClick={() => setEditingMsgId(null)}
                                    className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded font-medium hover:bg-gray-300"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : isRefiningThis ? (
                              <div className="space-y-2 mt-1">
                                <p className="text-sm text-[#111b21] whitespace-pre-wrap break-words leading-relaxed">
                                  {msg.resposta_sugerida_ia}
                                </p>
                                <input
                                  type="text"
                                  placeholder="Ex: mais formal, adicione X..."
                                  value={refineInstruction}
                                  onChange={(e) => setRefineInstruction(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRefine(msg) } }}
                                  className="w-full border border-amber-300 rounded px-2 py-1.5 text-sm text-[#111b21] focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white placeholder:text-gray-400"
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleRefine(msg)}
                                    disabled={refining || !refineInstruction.trim()}
                                    className="px-3 py-1 bg-orange-500 text-white text-xs rounded font-medium hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    {refining ? '...' : 'Refinar'}
                                  </button>
                                  <button
                                    onClick={() => setRefiningMsgId(null)}
                                    className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded font-medium hover:bg-gray-300"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[#111b21] text-sm whitespace-pre-wrap break-words leading-relaxed">
                                {msg.conteudo}
                              </p>
                            )}

                            {/* Timestamp */}
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              {msg.modo_no_momento === 'treinamento' && !isPending && (
                                <span className="text-[10px] text-dourado font-medium">treino</span>
                              )}
                              <span className="text-[10px] text-[#667781]">{formatTime(msg.created_at)}</span>
                            </div>
                          </div>

                          {/* Action buttons for pending suggestions */}
                          {isPending && !isEditing && !isRefiningThis && (
                            <div className="flex border-t border-amber-200">
                              <button
                                onClick={() => handleApprove(msg)}
                                disabled={isLoadingThis}
                                className="flex-1 py-2 text-xs font-semibold text-verde hover:bg-verde/5 border-r border-amber-200 transition-colors disabled:opacity-50"
                              >
                                {isLoadingThis ? '...' : '✓ Aprovar'}
                              </button>
                              <button
                                onClick={() => handleStartEdit(msg)}
                                className="flex-1 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 border-r border-amber-200 transition-colors"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleStartRefine(msg.id)}
                                className="flex-1 py-2 text-xs font-semibold text-orange-600 hover:bg-orange-50 border-r border-amber-200 transition-colors"
                              >
                                🔄 Refinar
                              </button>
                              <button
                                onClick={() => handleDeleteSuggestion(msg.id)}
                                className="flex-1 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                              >
                                ✕ Descartar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f2f5] px-4 md:px-12 lg:px-16 py-3 flex items-end gap-3 shrink-0 border-t border-[#d1d7db]">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem"
                rows={1}
                className="flex-1 bg-white rounded-lg px-4 py-2.5 text-sm text-[#111b21] placeholder:text-[#667781] focus:outline-none resize-none max-h-[120px] shadow-sm border border-[#e0e0e0]"
                style={{ height: 'auto', minHeight: '42px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !inputText.trim()}
                className="w-10 h-10 bg-verde rounded-full flex items-center justify-center text-white hover:bg-verde-escuro transition-colors disabled:opacity-40 shrink-0 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

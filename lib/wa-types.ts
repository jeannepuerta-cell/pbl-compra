export interface WaPrompt {
  id: string
  nome: string
  tipo: 'atendimento' | 'refinamento' | 'analise_divergencia' | 'reescrita_prompt'
  system_prompt: string
  modelo: string
  temperatura: number
  versao: number
  ativo: boolean
  guard_rails: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WaBotConfig {
  id: string
  nome: string
  prompt_atendimento_id: string | null
  prompt_refinamento_id: string | null
  ativo: boolean
  modo: 'treinamento' | 'producao'
  grupo_whatsapp_id: string | null
  mensagem_boas_vindas: string
  palavras_escalacao: string[]
  created_at: string
  updated_at: string
}

export interface WaCliente {
  id: string
  telefone: string
  nome: string | null
  metadata: Record<string, unknown>
  mensagem_agregada: string
  conversa_iniciada: boolean
  created_at: string
  updated_at: string
}

export interface WaConversa {
  id: string
  cliente_id: string
  bot_id: string | null
  canal: string
  openai_conversation_id: string | null
  status: 'ativa' | 'arquivada' | 'escalada'
  boas_vindas_enviada: boolean
  ultima_mensagem_at: string
  created_at: string
  updated_at: string
  // Joined
  cliente?: WaCliente
  ultima_mensagem?: WaMensagem
}

export interface WaMensagem {
  id: string
  conversa_id: string
  direcao: 'in' | 'out'
  autor: 'cliente' | 'ia' | 'humano' | 'sistema'
  conteudo: string
  resposta_sugerida_ia: string | null
  instrucao_refinamento: string | null
  aprovada_por: string | null
  modo_no_momento: 'treinamento' | 'producao' | null
  prompt_id_usado: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface WaPromptRelatorio {
  id: string
  prompt_analisado_id: string
  periodo_inicio: string
  periodo_fim: string
  divergencias_analisadas: number
  analise_texto: string | null
  prompt_sugerido: string | null
  aprovado: boolean
  criado_por: string
  created_at: string
}

export interface UserRole {
  user_id: string
  role: string
  created_at: string
}

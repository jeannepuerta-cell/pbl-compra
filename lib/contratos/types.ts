export interface Fechamento {
  id: string
  created_at: string
  updated_at: string
  numero_processo: string
  numero_contrato: string | null
  comercial_responsavel: string
  analista_juridico: string | null
  data_fechamento: string
  tipo_cessao: 'sucumbencia' | 'honorarios' | 'integral' | 'personalizado'
  creditos_personalizados: string[]
  observacoes_raw: string | null
  observacoes_processadas: string | null
  valor_condenacao: number | null
  valor_fechado: number
  desagio: number | null
  incluir_dados_bancarios: boolean
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo_conta: string | null
  banco_cpf: string | null
  vara: string | null
  comarca: string | null
  autor_nome: string | null
  reu_nome: string | null
  c1_nome: string | null
  c1_profissao: string | null
  c1_nacionalidade: string | null
  c1_estado_civil: string | null
  c1_nascimento: string | null
  c1_cpf: string | null
  c1_rg: string | null
  c1_oab_uf: string | null
  c1_oab_numero: string | null
  c1_endereco: string | null
  c1_bairro: string | null
  c1_cidade: string | null
  c1_uf: string | null
  c1_cep: string | null
  tem_segundo_cedente: boolean
  c2_nome: string | null
  c2_profissao: string | null
  c2_nacionalidade: string | null
  c2_estado_civil: string | null
  c2_nascimento: string | null
  c2_cpf: string | null
  c2_oab_uf: string | null
  c2_oab_numero: string | null
  c2_endereco: string | null
  c2_bairro: string | null
  c2_cidade: string | null
  c2_uf: string | null
  c2_cep: string | null
  cidade_assinatura: string | null
  uf_assinatura: string | null
  data_assinatura: string | null
  status: 'rascunho' | 'gerado' | 'enviado_contencioso' | 'assinado'
  user_id: string
}

export interface ContratoDoc {
  id: string
  created_at: string
  fechamento_id: string
  nome_arquivo: string
  url_arquivo: string | null
  gerado_por: string
}

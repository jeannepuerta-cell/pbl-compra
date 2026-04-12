export interface Profile {
  id: string
  login: string
  name: string
  cargo: string | null
  setor: 'juridico' | 'comercial' | 'gestor'
  role: 'admin' | 'user'
  initials: string | null
  salario: number
  created_at: string
}

export interface Operacao {
  id: number
  tipo: 'processo' | 'precatorio' | 'comercial'
  responsavel: string
  numero: string | null
  creditos: number
  valor: number
  comissao: number
  data: string
  created_at: string
}

export interface Liquidacao {
  id: number
  mes: string
  total_proc: number
  pool: number
  vpp: number
  por_pessoa: Record<string, number>
  created_at: string
}

export interface Campanha {
  id: number
  nome: string
  objetivo: string | null
  premio: number
  equipe: 'todos' | 'juridico' | 'comercial'
  atingido: boolean
  created_at: string
}

export interface Configuracao {
  chave: string
  valor: Record<string, unknown> | unknown[] | string | number | boolean
}

export interface PessoaStats {
  login: string
  name: string
  setor: string
  volumeTotal: number
  comBase: number
  bonus: number
  liq: number
  salario: number
  totalComissao: number
  totalBruto: number
  operacoes: number
}

export interface MetaConfig {
  meta: number
  supermeta: number
}

export interface CampanhaSemana {
  id: number
  nome: string
  atingido: boolean
}

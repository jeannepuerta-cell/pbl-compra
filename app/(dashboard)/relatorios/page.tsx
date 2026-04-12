import { createClient } from '@/lib/supabase/server'
import { Profile, Operacao, Liquidacao, Producao } from '@/lib/types'
import RelatoriosClient from './RelatoriosClient'

export const metadata = {
  title: 'Relatórios',
}

export default async function RelatoriosPage() {
  const supabase = await createClient()

  const [profilesRes, operacoesRes, liquidacaoRes, producaoRes] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('operacoes').select('*').order('data', { ascending: false }),
    supabase
      .from('liquidacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('producao').select('*').order('data', { ascending: true }),
  ])

  const profiles: Profile[] = profilesRes.data ?? []
  const operacoes: Operacao[] = operacoesRes.data ?? []
  const liquidacao: Liquidacao | null = liquidacaoRes.data ?? null
  const producaoData: Producao[] = producaoRes.data ?? []

  return (
    <RelatoriosClient
      profiles={profiles}
      operacoes={operacoes}
      liquidacao={liquidacao}
      producaoData={producaoData}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { Profile, Operacao, Liquidacao } from '@/lib/types'
import RelatoriosClient from './RelatoriosClient'

export const metadata = {
  title: 'Relatorios',
}

export default async function RelatoriosPage() {
  const supabase = await createClient()

  const [profilesRes, operacoesRes, liquidacaoRes] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('operacoes').select('*').order('data', { ascending: false }),
    supabase
      .from('liquidacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const profiles: Profile[] = profilesRes.data ?? []
  const operacoes: Operacao[] = operacoesRes.data ?? []
  const liquidacao: Liquidacao | null = liquidacaoRes.data ?? null

  return (
    <RelatoriosClient
      profiles={profiles}
      operacoes={operacoes}
      liquidacao={liquidacao}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { Profile, Operacao, Liquidacao } from '@/lib/types'
import DashboardClient from './DashboardClient'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
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
    <DashboardClient
      profiles={profiles}
      operacoes={operacoes}
      liquidacao={liquidacao}
    />
  )
}

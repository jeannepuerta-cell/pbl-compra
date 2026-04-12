import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Profile, Operacao, Liquidacao } from '@/lib/types'
import DashboardClient from './DashboardClient'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const currentProfile = profile as Profile

  const [profilesRes, operacoesRes, liquidacoesRes, metaRes] =
    await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('operacoes').select('*').order('data', { ascending: false }),
      supabase
        .from('liquidacoes')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('configuracoes')
        .select('*')
        .eq('chave', 'metas')
        .maybeSingle(),
    ])

  const profiles: Profile[] = profilesRes.data ?? []
  const operacoes: Operacao[] = operacoesRes.data ?? []
  const liquidacoes: Liquidacao[] = liquidacoesRes.data ?? []
  const metaConfig: Record<string, { meta: number; supermeta: number }> =
    (metaRes.data?.valor as Record<string, { meta: number; supermeta: number }>) ?? {}

  return (
    <DashboardClient
      profiles={profiles}
      operacoes={operacoes}
      liquidacoes={liquidacoes}
      currentProfile={currentProfile}
      metaConfig={metaConfig}
    />
  )
}

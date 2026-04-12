import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Profile, Operacao, Liquidacao, Producao } from '@/lib/types'
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

  const [profilesRes, operacoesRes, liquidacoesRes, metaRes, producaoRes] =
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
      supabase.from('producao').select('*').order('data', { ascending: true }),
    ])

  const profiles: Profile[] = profilesRes.data ?? []
  const operacoes: Operacao[] = operacoesRes.data ?? []
  const liquidacoes: Liquidacao[] = liquidacoesRes.data ?? []
  const metaConfig: Record<string, { meta: number; supermeta: number }> =
    (metaRes.data?.valor as Record<string, { meta: number; supermeta: number }>) ?? {}
  const producaoData: Producao[] = producaoRes.data ?? []

  return (
    <DashboardClient
      profiles={profiles}
      operacoes={operacoes}
      liquidacoes={liquidacoes}
      currentProfile={currentProfile}
      metaConfig={metaConfig}
      producaoData={producaoData}
    />
  )
}

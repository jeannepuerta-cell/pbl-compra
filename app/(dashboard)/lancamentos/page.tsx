import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/lib/types'
import LancamentosClient from './LancamentosClient'

export default async function LancamentosPage() {
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

  if (!profile || (profile as Profile).role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch team members for dropdowns
  const { data: profiles } = await supabase
    .from('profiles')
    .select('login, name, setor')
    .order('name')

  return (
    <LancamentosClient
      profiles={(profiles as Pick<Profile, 'login' | 'name' | 'setor'>[]) || []}
    />
  )
}

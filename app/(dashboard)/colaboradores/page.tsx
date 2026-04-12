import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/lib/types'
import ColaboradoresClient from './ColaboradoresClient'

export const metadata = {
  title: 'Colaboradores',
}

export default async function ColaboradoresPage() {
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

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('setor')
    .order('name')

  return <ColaboradoresClient profiles={(profiles as Profile[]) ?? []} />
}

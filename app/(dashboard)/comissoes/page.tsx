import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/lib/types'
import ComissoesClient from './ComissoesClient'

export default async function ComissoesPage() {
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

  const typedProfile = profile as Profile

  // Fetch all profiles for admin view
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('name')

  return (
    <ComissoesClient
      currentProfile={typedProfile}
      allProfiles={(allProfiles as Profile[]) || []}
    />
  )
}

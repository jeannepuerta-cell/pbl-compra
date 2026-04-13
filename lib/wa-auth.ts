import { createClient } from '@/lib/supabase/server'

export async function checkWaAccess(): Promise<{ userId: string; isAdmin: boolean } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') return { userId: user.id, isAdmin: true }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  const hasAccess = roles?.some(r => r.role === 'atendente_whatsapp' || r.role === 'admin')
  if (!hasAccess) return null

  return { userId: user.id, isAdmin: profile?.role === 'admin' || false }
}

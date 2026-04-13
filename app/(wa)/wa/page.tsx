import { redirect } from 'next/navigation'
import { checkWaAccess } from '@/lib/wa-auth'
import { createClient } from '@/lib/supabase/server'
import type { WaConversa } from '@/lib/wa-types'
import InboxClient from './InboxClient'

export default async function WaInboxPage() {
  const access = await checkWaAccess()
  if (!access) {
    redirect('/modulos')
  }

  // Fetch initial conversations server-side for fast first paint
  let conversas: WaConversa[] = []
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('wa_conversas')
      .select('*, cliente:wa_clientes(*)')
      .order('ultima_mensagem_at', { ascending: false })

    conversas = (data as WaConversa[]) ?? []
  } catch (err) {
    console.error('Error fetching initial conversas:', err)
  }

  return <InboxClient initialConversas={conversas} />
}

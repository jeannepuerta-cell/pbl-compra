import { redirect } from 'next/navigation'
import { checkWaAccess } from '@/lib/wa-auth'
import RelatoriosWaClient from './RelatoriosWaClient'

export default async function RelatoriosPage() {
  const access = await checkWaAccess()

  if (!access) {
    redirect('/login')
  }

  if (!access.isAdmin) {
    redirect('/wa')
  }

  return <RelatoriosWaClient />
}

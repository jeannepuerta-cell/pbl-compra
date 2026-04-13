import { redirect } from 'next/navigation'
import { checkWaAccess } from '@/lib/wa-auth'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const access = await checkWaAccess()

  if (!access) {
    redirect('/login')
  }

  if (!access.isAdmin) {
    redirect('/wa')
  }

  return <AdminClient />
}

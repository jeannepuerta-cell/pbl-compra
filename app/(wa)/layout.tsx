import { redirect } from 'next/navigation'
import { checkWaAccess } from '@/lib/wa-auth'
import { WaSidebar } from '@/components/wa/WaSidebar'

export default async function WaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await checkWaAccess()

  if (!access) {
    redirect('/modulos')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <WaSidebar isAdmin={access.isAdmin} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}

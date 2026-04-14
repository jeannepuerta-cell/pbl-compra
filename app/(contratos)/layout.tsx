import { redirect } from 'next/navigation'
import { checkContratosAccess } from '@/lib/contratos/auth'
import { ContratosSidebar } from './ContratosSidebar'

export default async function ContratosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await checkContratosAccess()

  if (!access) {
    redirect('/modulos')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <ContratosSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}

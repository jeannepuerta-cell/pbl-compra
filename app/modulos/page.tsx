import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ModulosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  const isAdmin = profile.role === 'admin'
  const hasWaAccess = isAdmin || userRoles?.some(r => r.role === 'atendente_whatsapp')

  // Build available modules
  const modules: Array<{
    title: string
    description: string
    href: string
    icon: 'chart' | 'chat' | 'contract'
  }> = [
    {
      title: 'Comissões',
      description: 'Gestão de comissões, lançamentos, relatórios e campanhas',
      href: '/dashboard',
      icon: 'chart',
    },
  ]

  if (hasWaAccess) {
    modules.push({
      title: 'Atendimento WhatsApp',
      description: 'Inbox de conversas, bots e automações de atendimento',
      href: '/wa',
      icon: 'chat',
    })
  }

  if (isAdmin) {
    modules.push({
      title: 'Contratos',
      description: 'Geração de contratos de cessão de crédito judicial',
      href: '/contratos',
      icon: 'contract',
    })
  }

  // If user only has access to 1 module, redirect directly
  if (modules.length === 1) {
    redirect(modules[0].href)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Branding */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-dourado">PBL Compra</h1>
        <p className="text-verde-claro mt-2 text-sm">
          Ola, {profile.name}. Selecione um modulo para continuar.
        </p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 p-6 hover:-translate-y-1 border border-transparent hover:border-dourado"
          >
            {/* Icon */}
            <div className="w-12 h-12 rounded-lg bg-verde-claro flex items-center justify-center mb-4 group-hover:bg-verde transition-colors">
              {mod.icon === 'chart' ? (
                <svg className="w-6 h-6 text-verde group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ) : mod.icon === 'contract' ? (
                <svg className="w-6 h-6 text-verde group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-verde group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
            </div>

            {/* Text */}
            <h2 className="text-lg font-semibold text-verde-escuro mb-1">
              {mod.title}
            </h2>
            <p className="text-sm text-gray-500">{mod.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

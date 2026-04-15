'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ModuleNav } from '@/components/layout/ModuleNav'

const links = [
  {
    href: '/contratos',
    label: 'Contratos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    href: '/contratos/novo',
    label: 'Novo Contrato',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
    ),
  },
]

export function ContratosSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-200">
      {/* Header */}
      <div className="h-16 flex items-center px-6 bg-verde-escuro">
        <div>
          <span className="text-xl font-bold text-dourado">PBL Compra</span>
          <span className="block text-xs text-verde-claro -mt-0.5">Contratos</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive =
            link.href === '/contratos'
              ? pathname === '/contratos'
              : pathname.startsWith(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-verde text-white'
                  : 'text-verde-escuro hover:bg-verde-claro'
              )}
            >
              {link.icon}
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* Module Navigator */}
      <div className="px-3 py-3 bg-verde-escuro">
        <ModuleNav />
      </div>
    </aside>
  )
}

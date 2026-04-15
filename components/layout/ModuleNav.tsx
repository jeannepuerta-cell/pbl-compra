'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const modules = [
  {
    href: '/dashboard',
    label: 'Comissões',
    prefix: '/dashboard',
    altPrefixes: ['/lancamentos', '/comissoes', '/colaboradores', '/usuarios', '/relatorios', '/campanhas', '/producao'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/wa',
    label: 'WhatsApp',
    prefix: '/wa',
    altPrefixes: [],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: '/contratos',
    label: 'Contratos',
    prefix: '/contratos',
    altPrefixes: [],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export function ModuleNav() {
  const pathname = usePathname()

  const isActive = (mod: typeof modules[0]) => {
    if (pathname.startsWith(mod.prefix)) return true
    return mod.altPrefixes.some(p => pathname.startsWith(p))
  }

  return (
    <div className="border-t border-white/10 pt-2 mt-2">
      <p className="text-[10px] uppercase tracking-wider text-white/40 px-3 mb-1.5">Módulos</p>
      <div className="flex flex-col gap-0.5">
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              isActive(mod)
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            )}
          >
            {mod.icon}
            {mod.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

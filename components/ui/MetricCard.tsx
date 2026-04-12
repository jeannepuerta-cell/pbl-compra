import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  color?: 'verde' | 'dourado'
}

export function MetricCard({
  title,
  value,
  subtitle,
  color = 'verde',
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-sm p-5 border-t-4',
        color === 'verde' ? 'border-t-verde' : 'border-t-dourado'
      )}
    >
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subtitle && (
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  )
}

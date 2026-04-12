import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/comissoes'

interface ProgressBarProps {
  label: string
  current: number
  target: number
  color?: string
}

export function ProgressBar({
  label,
  current,
  target,
  color,
}: ProgressBarProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-medium text-gray-500">
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            !color && 'bg-verde'
          )}
          style={{
            width: `${percentage}%`,
            ...(color ? { backgroundColor: color } : {}),
          }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {formatBRL(current)} / {formatBRL(target)}
      </p>
    </div>
  )
}

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface ChartDataItem {
  name: string
  value: number
  color?: string
}

interface SimpleBarChartProps {
  data: ChartDataItem[]
  title?: string
  formatValue?: (v: number) => string
}

const DEFAULT_COLOR = '#01423e'

function CustomTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  formatValue?: (v: number) => string
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-sm text-verde font-semibold">
        {formatValue ? formatValue(payload[0].value) : payload[0].value}
      </p>
    </div>
  )
}

export function SimpleBarChart({
  data,
  title,
  formatValue,
}: SimpleBarChartProps) {
  return (
    <div>
      {title && (
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
          />
          <Tooltip
            content={<CustomTooltip formatValue={formatValue} />}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color || DEFAULT_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

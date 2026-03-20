import { CHECKPOINTS } from '../data/instruments'
import type { ScenarioPoint } from '../types'

function buildChartPath(
  points: ScenarioPoint[],
  valueSelector: (point: ScenarioPoint) => number,
  width: number,
  height: number,
  padding: number,
): string {
  if (!points.length) {
    return ''
  }

  const values = points.map(valueSelector)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return points
    .map((point, index) => {
      const x =
        padding +
        (index / Math.max(points.length - 1, 1)) * (width - padding * 2)
      const normalized = (valueSelector(point) - min) / range
      const y = height - padding - normalized * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

interface LineChartProps {
  title: string
  subtitle: string
  points: ScenarioPoint[]
  color: string
  metric: (point: ScenarioPoint) => number
  formatter: (point: ScenarioPoint) => string
}

function LineChart({
  title,
  subtitle,
  points,
  color,
  metric,
  formatter,
}: LineChartProps) {
  const width = 680
  const height = 220
  const padding = 24
  const path = buildChartPath(points, metric, width, height, padding)
  const checkpoints = points.filter((point) => CHECKPOINTS.includes(point.adverseMovePct))
  const values = points.map(metric)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return (
    <section className="chart-card">
      <div className="chart-card__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="chart-card__legend">
          <span className="chart-card__swatch" style={{ background: color }}></span>
          <span>Worst-case stress curve</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-card__svg" role="img">
        <defs>
          <linearGradient id={`${title}-gradient`} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path
          d={path}
          fill="none"
          stroke={`url(#${title}-gradient)`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        {checkpoints.map((point, index) => {
          const x =
            padding +
            ((point.adverseMovePct - 1) / Math.max(points.length - 1, 1)) *
              (width - padding * 2)
          const y =
            height -
            padding -
            ((metric(point) - min) / range) * (height - padding * 2)

          return (
            <g key={`${title}-${point.adverseMovePct}-${index}`}>
              <circle cx={x} cy={y} r="4.5" fill={color} />
              <text x={x} y={y - 12} textAnchor="middle" className="chart-card__label">
                {formatter(point)}
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}

export default LineChart

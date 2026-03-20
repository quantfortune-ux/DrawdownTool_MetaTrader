interface MetricCardProps {
  label: string
  value: string
  hint: string
  tone?: 'neutral' | 'safe' | 'caution' | 'danger'
}

function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      <p className="metric-card__hint">{hint}</p>
    </article>
  )
}

export default MetricCard

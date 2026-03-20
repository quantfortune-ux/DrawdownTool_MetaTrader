import type { CSSProperties } from 'react'

import type {
  RecommendationResult,
  ScenarioPoint,
  SimulationCaseResult,
} from '../types'
import { toCompactCurrency, toPercent } from '../lib/formatters'
import MetricCard from './MetricCard'
import StatusBadge from './StatusBadge'

function RecommendationCard({
  item,
  preferred,
}: {
  item: RecommendationResult
  preferred: boolean
}) {
  const cardStyle = {
    '--band-accent': item.band.accent,
  } as CSSProperties

  return (
    <article
      className={`recommendation-card ${
        preferred ? 'recommendation-card--preferred' : ''
      }`}
      style={cardStyle}
    >
      <div className="recommendation-card__header">
        <div>
          <span>{item.band.label}</span>
          <strong>{item.startLot?.toFixed(2) ?? 'Do Not Trade'}</strong>
        </div>
        <StatusBadge status={item.qualified ? 'Safe' : 'Danger'} />
      </div>
      <p>{item.summary}</p>
      {item.pointAtBand ? (
        <dl className="recommendation-card__facts">
          <div>
            <dt>Stress DD</dt>
            <dd>{toPercent(item.pointAtBand.drawdownPct)}</dd>
          </div>
          <div>
            <dt>Margin</dt>
            <dd>{toPercent(item.pointAtBand.marginLevel)}</dd>
          </div>
          <div>
            <dt>Grid depth</dt>
            <dd>{item.pointAtBand.gridDepth}</dd>
          </div>
        </dl>
      ) : null}
    </article>
  )
}

interface RecommendationSectionProps {
  report: {
    normal: SimulationCaseResult
    stressed: SimulationCaseResult
    recommendations: RecommendationResult[]
  } | null
  preferredBand: RecommendationResult['band']['key']
  strategyInitialLot: number
  selectedRecommendationQualified: boolean
  stressedStopoutPoint: ScenarioPoint | null
  normalDangerPoint: ScenarioPoint | null
  onExportPdf: () => void
}

function RecommendationSection({
  report,
  preferredBand,
  strategyInitialLot,
  selectedRecommendationQualified,
  stressedStopoutPoint,
  normalDangerPoint,
  onExportPdf,
}: RecommendationSectionProps) {
  return (
    <section className="panel results-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Recommendations</span>
          <h2>Decision Panel</h2>
        </div>
        {selectedRecommendationQualified ? (
          <div className="decision-pill decision-pill--ok">
            Preferred band qualifies
          </div>
        ) : (
          <div className="decision-pill decision-pill--warn">
            Review the stress limits
          </div>
        )}
      </div>

      {!report ? (
        <div className="empty-state empty-state--center">
          <strong>Enter account size, leverage, and price.</strong>
          <p>The simulation will start once the required values are valid.</p>
        </div>
      ) : (
        <>
          <div className="recommendation-grid">
            {report.recommendations.map((item) => (
              <RecommendationCard
                key={item.band.key}
                item={item}
                preferred={preferredBand === item.band.key}
              />
            ))}
          </div>

          <div className="summary-callout">
            <div>
              <span className="eyebrow">Current lot analysis</span>
              <h3>{strategyInitialLot.toFixed(2)} lots stress profile</h3>
              <p>
                Worst drawdown {toPercent(report.stressed.worstDrawdownPct)}.
                {` `}
                {stressedStopoutPoint
                  ? `Likely stop-out begins near a ${stressedStopoutPoint.adverseMovePct}% move.`
                  : 'No stop-out event appears inside the 50% stress path.'}
              </p>
            </div>
            <button className="button button--primary" onClick={onExportPdf}>
              Export Client PDF
            </button>
          </div>

          <div className="metrics-grid">
            <MetricCard
              label="Stress worst DD"
              value={toPercent(report.stressed.worstDrawdownPct)}
              hint="Maximum floating drawdown in the 1% to 50% one-way move."
              tone="danger"
            />
            <MetricCard
              label="Stress max margin use"
              value={toCompactCurrency(report.stressed.maxUsedMargin)}
              hint={`Effective leverage 1:${report.stressed.effectiveLeverage.toFixed(0)}`}
              tone="caution"
            />
            <MetricCard
              label="First danger point"
              value={
                normalDangerPoint
                  ? `${normalDangerPoint.adverseMovePct}%`
                  : 'Not triggered'
              }
              hint="Normal-case threshold where the basket turns unstable."
            />
            <MetricCard
              label="Stress max depth"
              value={String(report.stressed.maxGridDepth)}
              hint={
                report.stressed.firstHaltMovePct
                  ? `Lot cap hit at ${report.stressed.firstHaltMovePct}% move.`
                  : 'No lot-cap halt inside the tested range.'
              }
              tone="safe"
            />
          </div>
        </>
      )}
    </section>
  )
}

export default RecommendationSection

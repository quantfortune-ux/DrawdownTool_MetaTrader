import { toCompactCurrency, toCurrency, toPercent } from '../lib/formatters'
import { Fragment, useState } from 'react'
import type { ScenarioPoint } from '../types'
import StatusBadge from './StatusBadge'

interface CheckpointRow {
  checkpoint: number
  normal: ScenarioPoint | null
  stressed: ScenarioPoint | null
}

function CheckpointTable({ rows }: { rows: CheckpointRow[] }) {
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<number[]>([])

  function toggleCheckpoint(checkpoint: number) {
    setExpandedCheckpoints((current) =>
      current.includes(checkpoint)
        ? current.filter((value) => value !== checkpoint)
        : [...current, checkpoint],
    )
  }

  return (
    <section className="panel table-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Checkpoints</span>
          <h2>Scenario Table</h2>
        </div>
      </div>

      <div className="table-scroll">
        <table className="scenario-table">
          <thead>
            <tr>
              <th>Move</th>
              <th>Drawdown</th>
              <th>Float P/L</th>
              <th>Margin</th>
              <th>Depth</th>
              <th>Exposure</th>
              <th>Status</th>
              <th>Recovery Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = expandedCheckpoints.includes(row.checkpoint)

              return (
                <Fragment key={row.checkpoint}>
                  <tr className="checkpoint-summary-row">
                    <td>
                      <div className="scenario-move-cell">
                        <button
                          type="button"
                          className="scenario-expand-button"
                          aria-expanded={expanded}
                          aria-label={
                            expanded
                              ? `Collapse ${row.checkpoint}% scenario`
                              : `Expand ${row.checkpoint}% scenario`
                          }
                          onClick={() => toggleCheckpoint(row.checkpoint)}
                        >
                          {expanded ? '^' : 'v'}
                        </button>
                        <span className="scenario-move-pill">{row.checkpoint}%</span>
                      </div>
                    </td>
                    <td className="table-number">
                      {row.stressed ? toPercent(row.stressed.drawdownPct) : '-'}
                    </td>
                    <td
                      className={`table-number ${
                        row.stressed ? pnlClassName(row.stressed.floatingPnL) : ''
                      }`}
                    >
                      {row.stressed ? toCurrency(row.stressed.floatingPnL) : '-'}
                    </td>
                    <td className="table-number">
                      {row.stressed ? toPercent(row.stressed.marginLevel) : '-'}
                    </td>
                    <td className="table-number">{row.stressed?.gridDepth ?? '-'}</td>
                    <td className="table-number">
                      {row.stressed
                        ? toCompactCurrency(row.stressed.totalExposureNotional)
                        : '-'}
                    </td>
                    <td>{row.stressed ? <StatusBadge status={row.stressed.status} /> : '-'}</td>
                    <td className="table-number">
                      {row.stressed ? row.stressed.recoveryPrice.toFixed(2) : '-'}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="scenario-detail-row">
                      <td colSpan={8}>{renderScenarioDetails(row.stressed)}</td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function renderScenarioDetails(point: ScenarioPoint | null) {
  if (!point) {
    return (
      <section className="scenario-detail-card">
        <h3>Scenario Details</h3>
        <p>No scenario details available.</p>
      </section>
    )
  }

  const maxOrderImpact = Math.max(
    ...point.orderBreakdown.map((order) => Math.abs(order.floatingPnL)),
    1,
  )

  return (
    <section className="scenario-detail-card">
      <div className="scenario-detail-topline">
        <h3>{point.adverseMovePct}% Stress Path</h3>
        <span className="scenario-detail-recovery">
          Recovery {point.recoveryPrice.toFixed(2)}
        </span>
      </div>
      <p>
        The basket has {point.gridDepth} open orders with{' '}
        {Math.max(point.gridDepth - 1, 0)} added swings. Current bid is{' '}
        {point.scenarioBidPrice.toFixed(2)} and total floating P/L is{' '}
        <span className={pnlClassName(point.floatingPnL)}>
          {toCurrency(point.floatingPnL)}
        </span>
        .
      </p>
      <div className="scenario-visual-strip">
        {renderVisualMetric(
          'Market move',
          `${point.adverseMovePct}% down`,
          point.adverseMovePct / 50,
          'move',
        )}
        {renderVisualMetric(
          'Drawdown',
          toPercent(point.drawdownPct),
          point.drawdownPct / 100,
          'loss',
        )}
        {renderVisualMetric(
          'Margin level',
          toPercent(point.marginLevel),
          point.marginLevel / 300,
          point.marginLevel < 150 ? 'loss' : 'safe',
        )}
        {renderVisualMetric(
          'Bounce needed',
          toPercent(point.bounceNeededPct),
          point.bounceNeededPct / 25,
          'accent',
        )}
      </div>
      <div className="scenario-detail-stats">
        <div>
          <span>Bid Price</span>
          <strong>{point.scenarioBidPrice.toFixed(2)}</strong>
        </div>
        <div>
          <span>Open Orders</span>
          <strong>{point.gridDepth}</strong>
        </div>
        <div>
          <span>Added Swings</span>
          <strong>{Math.max(point.gridDepth - 1, 0)}</strong>
        </div>
        <div>
          <span>Floating P/L</span>
          <strong className={pnlClassName(point.floatingPnL)}>
            {toCurrency(point.floatingPnL)}
          </strong>
        </div>
      </div>
      <h4 className="scenario-detail-orders-title">Order Impact Ladder</h4>
      <div className="scenario-detail-orders">
        {point.orderBreakdown.map((order) => (
          <article
            key={`${point.adverseMovePct}-${order.sequence}`}
            className="scenario-order-row"
          >
            <div className="scenario-order-row__meta">
              <strong>Order {order.sequence}</strong>
              <span>
                {order.lot.toFixed(2)} lot @ {order.openPrice.toFixed(2)}
              </span>
            </div>
            <div className="scenario-order-row__bar">
              <div
                className={`scenario-order-row__fill ${
                  order.floatingPnL >= 0
                    ? 'scenario-order-row__fill--profit'
                    : 'scenario-order-row__fill--loss'
                }`}
                style={{
                  width: `${Math.max(
                    8,
                    (Math.abs(order.floatingPnL) / maxOrderImpact) * 100,
                  ).toFixed(2)}%`,
                }}
              ></div>
            </div>
            <div className={`scenario-order-row__value ${pnlClassName(order.floatingPnL)}`}>
              {toCurrency(order.floatingPnL)}
            </div>
          </article>
        ))}
      </div>
      {point.haltReason ? (
        <p className="scenario-detail-note">Halt reason: {point.haltReason}</p>
      ) : null}
    </section>
  )
}

function pnlClassName(value: number): string {
  if (value > 0) {
    return 'pnl-cell pnl-cell--profit'
  }

  if (value < 0) {
    return 'pnl-cell pnl-cell--loss'
  }

  return 'pnl-cell'
}

function renderVisualMetric(
  label: string,
  value: string,
  ratio: number,
  tone: 'move' | 'loss' | 'safe' | 'accent',
) {
  const width = `${Math.max(0, Math.min(ratio, 1)) * 100}%`

  return (
    <article className="scenario-visual-card">
      <div className="scenario-visual-card__topline">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="scenario-visual-bar">
        <div
          className={`scenario-visual-bar__fill scenario-visual-bar__fill--${tone}`}
          style={{ width }}
        ></div>
      </div>
    </article>
  )
}

export default CheckpointTable

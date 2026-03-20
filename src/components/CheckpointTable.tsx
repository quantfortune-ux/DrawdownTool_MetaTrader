import { toCompactCurrency, toPercent } from '../lib/formatters'
import type { ScenarioPoint } from '../types'
import StatusBadge from './StatusBadge'

interface CheckpointRow {
  checkpoint: number
  normal: ScenarioPoint | null
  stressed: ScenarioPoint | null
}

function CheckpointTable({ rows }: { rows: CheckpointRow[] }) {
  return (
    <section className="panel table-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Checkpoints</span>
          <h2>Scenario Table</h2>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Move</th>
              <th>Normal DD</th>
              <th>Stress DD</th>
              <th>Normal Margin</th>
              <th>Stress Margin</th>
              <th>Stress Depth</th>
              <th>Stress Exposure</th>
              <th>Stress Status</th>
              <th>Recovery Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.checkpoint}>
                <td>{row.checkpoint}%</td>
                <td>{row.normal ? toPercent(row.normal.drawdownPct) : '-'}</td>
                <td>{row.stressed ? toPercent(row.stressed.drawdownPct) : '-'}</td>
                <td>{row.normal ? toPercent(row.normal.marginLevel) : '-'}</td>
                <td>{row.stressed ? toPercent(row.stressed.marginLevel) : '-'}</td>
                <td>{row.stressed?.gridDepth ?? '-'}</td>
                <td>
                  {row.stressed
                    ? toCompactCurrency(row.stressed.totalExposureNotional)
                    : '-'}
                </td>
                <td>{row.stressed ? <StatusBadge status={row.stressed.status} /> : '-'}</td>
                <td>{row.stressed ? row.stressed.recoveryPrice.toFixed(2) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default CheckpointTable

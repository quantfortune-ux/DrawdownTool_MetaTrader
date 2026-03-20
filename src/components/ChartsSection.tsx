import LineChart from './LineChart'
import type { SimulationCaseResult } from '../types'

function ChartsSection({ stressed }: { stressed: SimulationCaseResult }) {
  return (
    <section className="panel charts-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Stress curves</span>
          <h2>Drawdown and Margin</h2>
        </div>
      </div>
      <div className="charts-grid">
        <LineChart
          title="Drawdown Curve"
          subtitle="Floating drawdown as the market keeps moving lower without retracing."
          points={stressed.points}
          color="#ff8f5a"
          metric={(point) => point.drawdownPct}
          formatter={(point) => `${point.adverseMovePct}%`}
        />
        <LineChart
          title="Margin Level"
          subtitle="Margin level under stressed leverage and doubled spread."
          points={stressed.points}
          color="#32a87d"
          metric={(point) => point.marginLevel}
          formatter={(point) => `${point.marginLevel.toFixed(0)}%`}
        />
      </div>
    </section>
  )
}

export default ChartsSection

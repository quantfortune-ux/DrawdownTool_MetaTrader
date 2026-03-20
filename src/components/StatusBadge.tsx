import type { RiskStatus } from '../types'

function statusTone(status: RiskStatus): 'safe' | 'caution' | 'danger' | 'stopout' {
  if (status === 'Safe') {
    return 'safe'
  }

  if (status === 'Caution') {
    return 'caution'
  }

  if (status === 'Danger') {
    return 'danger'
  }

  return 'stopout'
}

function StatusBadge({ status }: { status: RiskStatus }) {
  return <span className={`status-badge status-badge--${statusTone(status)}`}>{status}</span>
}

export default StatusBadge

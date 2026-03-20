import { formatDate, toCurrency } from '../lib/formatters'
import type { ClientRecord, RecommendationBandKey } from '../types'
import StatusBadge from './StatusBadge'

interface ClientSidebarProps {
  clientDraft: ClientRecord
  clients: ClientRecord[]
  selectedClientQualified: boolean
  onFieldChange: <K extends keyof ClientRecord>(
    field: K,
    value: ClientRecord[K],
  ) => void
  onSave: () => void
  onNew: () => void
  onLoad: (clientId: string) => void
  onDelete: (clientId: string) => void
}

function ClientSidebar({
  clientDraft,
  clients,
  selectedClientQualified,
  onFieldChange,
  onSave,
  onNew,
  onLoad,
  onDelete,
}: ClientSidebarProps) {
  return (
    <aside className="panel sidebar-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Clients</span>
          <h2>Client Desk</h2>
        </div>
        <button className="button button--ghost" onClick={onNew}>
          New Client
        </button>
      </div>

      <div className="sidebar-panel__form">
        <label>
          <span>Name</span>
          <input
            type="text"
            value={clientDraft.name}
            onChange={(event) => onFieldChange('name', event.target.value)}
            placeholder="Client name"
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={clientDraft.email}
            onChange={(event) => onFieldChange('email', event.target.value)}
            placeholder="name@example.com"
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            type="text"
            value={clientDraft.phone}
            onChange={(event) => onFieldChange('phone', event.target.value)}
            placeholder="+1..."
          />
        </label>
        <label>
          <span>Preferred band</span>
          <select
            value={clientDraft.preferredBand}
            onChange={(event) =>
              onFieldChange(
                'preferredBand',
                event.target.value as RecommendationBandKey,
              )
            }
          >
            <option value="conservative">Conservative</option>
            <option value="moderate">Moderate</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
        <label>
          <span>Notes</span>
          <textarea
            rows={5}
            value={clientDraft.notes}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            placeholder="Meeting notes, constraints, red flags..."
          />
        </label>
        <button className="button button--primary" onClick={onSave}>
          Save Client Snapshot
        </button>
      </div>

      <div className="saved-clients">
        {clients.length === 0 ? (
          <div className="empty-state">
            <strong>No saved clients yet.</strong>
            <p>Save the current setup to build a reusable risk history.</p>
          </div>
        ) : (
          clients.map((client) => (
            <article
              key={client.id}
              className={`client-card ${
                client.id === clientDraft.id ? 'client-card--active' : ''
              }`}
            >
              <div className="client-card__top">
                <div>
                  <strong>{client.name || 'Unnamed client'}</strong>
                  <p>
                    {client.instrumentKey.toUpperCase()} ·{' '}
                    {toCurrency(client.accountSize)}
                  </p>
                </div>
                <StatusBadge
                  status={
                    client.id === clientDraft.id
                      ? selectedClientQualified
                        ? 'Safe'
                        : 'Danger'
                      : 'Caution'
                  }
                />
              </div>
              <p className="client-card__stamp">{formatDate(client.lastSavedAt)}</p>
              <div className="client-card__actions">
                <button className="button button--ghost" onClick={() => onLoad(client.id)}>
                  Load
                </button>
                <button
                  className="button button--ghost button--danger"
                  onClick={() => onDelete(client.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  )
}

export default ClientSidebar

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'

import './App.css'
import ChartsSection from './components/ChartsSection'
import ClientSidebar from './components/ClientSidebar'
import CheckpointTable from './components/CheckpointTable'
import MetricCard from './components/MetricCard'
import RecommendationSection from './components/RecommendationSection'
import ScenarioBuilder from './components/ScenarioBuilder'
import { CHECKPOINTS, DEFAULT_STRATEGY_INPUTS } from './data/instruments'
import { fetchLivePrice } from './lib/priceProviders'
import { generateRecommendations, simulateRiskCase } from './lib/riskEngine'
import { formatDate } from './lib/formatters'
import {
  loadClients,
  loadInstrumentProfiles,
  saveClients,
  saveInstrumentProfiles,
} from './lib/storage'
import type {
  ClientRecord,
  InstrumentKey,
  InstrumentProfile,
  PriceQuote,
  RiskStatus,
  ScenarioPoint,
  SimulationCaseResult,
  StrategyInputs,
} from './types'

type PriceState =
  | { status: 'idle'; message: string; quote: null }
  | { status: 'loading'; message: string; quote: null }
  | { status: 'ready'; message: string; quote: PriceQuote }
  | { status: 'error'; message: string; quote: null }

function createEmptyClient(): ClientRecord {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
    name: '',
    email: '',
    phone: '',
    notes: '',
    accountSize: 10000,
    leverage: 100,
    instrumentKey: 'us500',
    preferredBand: 'moderate',
    priceOverride: null,
    lastSavedAt: new Date().toISOString(),
  }
}

function firstPointByStatus(
  result: SimulationCaseResult,
  status: RiskStatus,
): ScenarioPoint | null {
  return result.points.find((point) => point.status === status) ?? null
}

function App() {
  const initialClients = useMemo(() => loadClients(), [])
  const [clients, setClients] = useState<ClientRecord[]>(initialClients)
  const [clientDraft, setClientDraft] = useState<ClientRecord>(
    initialClients[0] ?? createEmptyClient(),
  )
  const [instrumentProfiles, setInstrumentProfiles] = useState<
    Record<InstrumentKey, InstrumentProfile>
  >(() => loadInstrumentProfiles())
  const [strategyInputs, setStrategyInputs] =
    useState<StrategyInputs>(DEFAULT_STRATEGY_INPUTS)
  const [currentPrice, setCurrentPrice] = useState<number>(
    initialClients[0]?.priceOverride ?? 0,
  )
  const [priceState, setPriceState] = useState<PriceState>({
    status: 'idle',
    message: 'Use live fetch or enter a manual reference price.',
    quote: null,
  })

  useEffect(() => {
    saveClients(clients)
  }, [clients])

  useEffect(() => {
    saveInstrumentProfiles(instrumentProfiles)
  }, [instrumentProfiles])

  const activeInstrument = instrumentProfiles[clientDraft.instrumentKey]

  const simulationSeed = useMemo(
    () => ({
      accountSize: clientDraft.accountSize,
      leverage: clientDraft.leverage,
      startPrice: currentPrice,
      instrument: activeInstrument,
      strategy: strategyInputs,
    }),
    [activeInstrument, clientDraft.accountSize, clientDraft.leverage, currentPrice, strategyInputs],
  )
  const deferredSimulationSeed = useDeferredValue(simulationSeed)

  const report = useMemo(() => {
    if (
      deferredSimulationSeed.accountSize <= 0 ||
      deferredSimulationSeed.leverage <= 0 ||
      deferredSimulationSeed.startPrice <= 0
    ) {
      return null
    }

    return {
      normal: simulateRiskCase(deferredSimulationSeed, 'Normal'),
      stressed: simulateRiskCase(deferredSimulationSeed, 'Stressed'),
      recommendations: generateRecommendations(deferredSimulationSeed),
    }
  }, [deferredSimulationSeed])

  const checkpointRows = useMemo(() => {
    if (!report) {
      return []
    }

    return CHECKPOINTS.map((checkpoint) => ({
      checkpoint,
      normal:
        report.normal.points.find((point) => point.adverseMovePct === checkpoint) ??
        null,
      stressed:
        report.stressed.points.find((point) => point.adverseMovePct === checkpoint) ??
        null,
    }))
  }, [report])

  const selectedRecommendation = useMemo(() => {
    if (!report) {
      return null
    }

    return (
      report.recommendations.find(
        (item) =>
          item.band.key === clientDraft.preferredBand && item.qualified,
      ) ??
      report.recommendations.find((item) => item.qualified) ??
      report.recommendations[0] ??
      null
    )
  }, [clientDraft.preferredBand, report])

  const normalDangerPoint = report ? firstPointByStatus(report.normal, 'Danger') : null
  const stressedStopoutPoint = report
    ? firstPointByStatus(report.stressed, 'Likely Stop-Out')
    : null

  function updateClientDraft<K extends keyof ClientRecord>(
    field: K,
    value: ClientRecord[K],
  ) {
    setClientDraft((current) => ({ ...current, [field]: value }))
  }

  function updateStrategy<K extends keyof StrategyInputs>(
    field: K,
    value: StrategyInputs[K],
  ) {
    setStrategyInputs((current) => ({ ...current, [field]: value }))
  }

  function updateInstrument<K extends keyof InstrumentProfile>(
    field: K,
    value: InstrumentProfile[K],
  ) {
    setInstrumentProfiles((current) => ({
      ...current,
      [activeInstrument.key]: {
        ...current[activeInstrument.key],
        [field]: value,
      },
    }))
  }

  function handleSaveClient() {
    const nextClient: ClientRecord = {
      ...clientDraft,
      priceOverride: currentPrice > 0 ? currentPrice : null,
      lastSavedAt: new Date().toISOString(),
    }

    setClients((current) => {
      const index = current.findIndex((item) => item.id === nextClient.id)

      if (index === -1) {
        return [nextClient, ...current]
      }

      const copy = [...current]
      copy[index] = nextClient
      return copy
    })

    setClientDraft(nextClient)
  }

  function handleNewClient() {
    startTransition(() => {
      setClientDraft(createEmptyClient())
      setCurrentPrice(0)
      setPriceState({
        status: 'idle',
        message: 'Use live fetch or enter a manual reference price.',
        quote: null,
      })
    })
  }

  function handleLoadClient(clientId: string) {
    const target = clients.find((item) => item.id === clientId)

    if (!target) {
      return
    }

    startTransition(() => {
      setClientDraft(target)
      setCurrentPrice(target.priceOverride ?? 0)
      setPriceState({
        status: 'idle',
        message: target.priceOverride
          ? 'Loaded the saved reference price.'
          : 'Use live fetch or enter a manual reference price.',
        quote: null,
      })
    })
  }

  function handleDeleteClient(clientId: string) {
    setClients((current) => current.filter((item) => item.id !== clientId))

    if (clientDraft.id === clientId) {
      handleNewClient()
    }
  }

  async function handleFetchPrice() {
    setPriceState({
      status: 'loading',
      message: `Fetching ${activeInstrument.name} reference price...`,
      quote: null,
    })

    try {
      const quote = await fetchLivePrice(activeInstrument)

      startTransition(() => {
        setCurrentPrice(Number(quote.value.toFixed(2)))
        setPriceState({
          status: 'ready',
          message: `Live price loaded from ${quote.provider} (${quote.symbol}).`,
          quote,
        })
      })
    } catch (error) {
      setPriceState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Live fetch failed. Enter the price manually.',
        quote: null,
      })
    }
  }

  async function handleExportPdf() {
    if (!report) {
      return
    }

    const { exportRiskReportPdf } = await import('./lib/pdf')

    exportRiskReportPdf({
      client: {
        ...clientDraft,
        priceOverride: currentPrice > 0 ? currentPrice : null,
      },
      instrument: activeInstrument,
      currentPrice,
      strategy: strategyInputs,
      normal: report.normal,
      stressed: report.stressed,
      recommendations: report.recommendations,
    })
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-panel__content">
          <span className="eyebrow">RiskDesk for MT5 Grid Strategies</span>
          <h1>Stress-test the basket before the client funds it.</h1>
          <p className="hero-panel__lede">
            This simulator follows the current EA logic as a worst-case path:
            the market moves one way, no retracement arrives, spreads widen,
            leverage tightens, and the basket keeps building until it cannot.
          </p>
          <div className="hero-panel__actions">
            <button className="button button--primary" onClick={handleFetchPrice}>
              Fetch Live Price
            </button>
            <button className="button button--ghost" onClick={handleExportPdf} disabled={!report}>
              Export PDF
            </button>
            <div className={`live-indicator live-indicator--${priceState.status}`}>
              <span className="live-indicator__dot"></span>
              <span>{priceState.message}</span>
            </div>
          </div>
        </div>
        <div className="hero-panel__stats">
          <MetricCard
            label="Current instrument"
            value={activeInstrument.name}
            hint={activeInstrument.marketProxy}
          />
          <MetricCard
            label="Reference price"
            value={currentPrice > 0 ? currentPrice.toFixed(2) : 'Pending'}
            hint={priceState.quote ? formatDate(priceState.quote.fetchedAt) : 'Manual entry allowed'}
          />
          <MetricCard
            label="Preferred band"
            value={clientDraft.preferredBand}
            hint="Final recommendations are stress-case based."
          />
        </div>
      </header>

      <main className="workspace-grid">
        <ClientSidebar
          clientDraft={clientDraft}
          clients={clients}
          selectedClientQualified={Boolean(selectedRecommendation?.qualified)}
          onFieldChange={updateClientDraft}
          onSave={handleSaveClient}
          onNew={handleNewClient}
          onLoad={handleLoadClient}
          onDelete={handleDeleteClient}
        />

        <ScenarioBuilder
          activeInstrument={activeInstrument}
          instrumentProfiles={instrumentProfiles}
          selectedInstrumentKey={clientDraft.instrumentKey}
          accountSize={clientDraft.accountSize}
          leverage={clientDraft.leverage}
          currentPrice={currentPrice}
          strategyInputs={strategyInputs}
          isCalculating={deferredSimulationSeed !== simulationSeed}
          onInstrumentSelect={(key) => updateClientDraft('instrumentKey', key)}
          onAccountSizeChange={(value) => updateClientDraft('accountSize', value)}
          onLeverageChange={(value) => updateClientDraft('leverage', value)}
          onPriceChange={setCurrentPrice}
          onStrategyChange={updateStrategy}
          onInstrumentChange={updateInstrument}
        />

        <RecommendationSection
          report={report}
          preferredBand={clientDraft.preferredBand}
          strategyInitialLot={strategyInputs.initialLot}
          selectedRecommendationQualified={Boolean(selectedRecommendation?.qualified)}
          stressedStopoutPoint={stressedStopoutPoint}
          normalDangerPoint={normalDangerPoint}
          onExportPdf={handleExportPdf}
        />

        {report ? (
          <>
            <ChartsSection stressed={report.stressed} />
            <CheckpointTable rows={checkpointRows} />
          </>
        ) : null}
      </main>
    </div>
  )
}

export default App

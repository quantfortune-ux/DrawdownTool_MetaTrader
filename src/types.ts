export type InstrumentKey = 'us500' | 'xauusd' | 'usoil'

export type RiskStatus = 'Safe' | 'Caution' | 'Danger' | 'Likely Stop-Out'

export type RecommendationBandKey =
  | 'conservative'
  | 'moderate'
  | 'aggressive'

export interface InstrumentProfile {
  key: InstrumentKey
  name: string
  marketProxy: string
  description: string
  contractSize: number
  pointSize: number
  tickValuePerLot: number
  minLot: number
  lotStep: number
  maxLot: number
  baseSpreadPoints: number
  priceFeedSymbol: string
}

export interface StrategyInputs {
  initialLot: number
  rrRatio: number
  gapPercent: number
  enableDynamicGap: boolean
  dynamicGapSwingCount: number
  dynamicGapPercentToIncrease: number
  targetRetracement: number
  enableDynamicRetracement: boolean
  dynamicRetracementSwingCount: number
  dynamicRetracementPercentToReduce: number
  minRetracementPercent: number
  enableFirstOrderTarget: boolean
  firstOrderTargetPercent: number
  maxStrategyLot: number
  maxSimulationMove: number
  stressLeverageMultiplier: number
  stressSpreadMultiplier: number
}

export interface ClientRecord {
  id: string
  name: string
  email: string
  phone: string
  notes: string
  accountSize: number
  leverage: number
  instrumentKey: InstrumentKey
  preferredBand: RecommendationBandKey
  priceOverride: number | null
  lastSavedAt: string
}

export interface PriceQuote {
  value: number
  provider: string
  symbol: string
  fetchedAt: string
}

export interface GridOrder {
  id: string
  sequence: number
  openPrice: number
  lot: number
  triggerGapPercent: number
  retracementPercent: number
}

export interface ScenarioOrderBreakdown {
  sequence: number
  openPrice: number
  lot: number
  floatingPnL: number
}

export interface ScenarioPoint {
  adverseMovePct: number
  scenarioAskPrice: number
  scenarioBidPrice: number
  totalLots: number
  gridDepth: number
  averageEntry: number
  equity: number
  floatingPnL: number
  drawdownDollar: number
  drawdownPct: number
  usedMargin: number
  freeMargin: number
  marginLevel: number
  recoveryPrice: number
  bounceNeededPct: number
  totalExposureNotional: number
  nextTriggerPrice: number | null
  haltedByLotCap: boolean
  haltReason: string | null
  status: RiskStatus
  orderBreakdown: ScenarioOrderBreakdown[]
}

export interface SimulationCaseResult {
  label: 'Normal' | 'Stressed'
  effectiveLeverage: number
  spreadPoints: number
  points: ScenarioPoint[]
  orders: GridOrder[]
  worstDrawdownPct: number
  maxGridDepth: number
  maxExposureNotional: number
  maxUsedMargin: number
  firstDangerMovePct: number | null
  firstStopOutMovePct: number | null
  firstHaltMovePct: number | null
}

export interface RecommendationBand {
  key: RecommendationBandKey
  label: string
  surviveMovePct: number
  maxDrawdownPct: number
  minMarginLevel: number
  maxGridLevels: number
  accent: string
}

export interface RecommendationResult {
  band: RecommendationBand
  startLot: number | null
  qualified: boolean
  summary: string
  pointAtBand: ScenarioPoint | null
}

export interface SimulationInputs {
  accountSize: number
  leverage: number
  startPrice: number
  instrument: InstrumentProfile
  strategy: StrategyInputs
}

import { RECOMMENDATION_BANDS } from '../data/instruments'
import type {
  GridOrder,
  InstrumentProfile,
  RecommendationBand,
  RecommendationResult,
  RiskStatus,
  ScenarioPoint,
  SimulationCaseResult,
  SimulationInputs,
  StrategyInputs,
} from '../types'

const LOT_EPSILON = 1e-9

function decimalPlaces(value: number): number {
  const normalized = value.toString()

  if (!normalized.includes('.')) {
    return 0
  }

  return normalized.split('.')[1]?.length ?? 0
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function normalizeLot(rawLot: number, instrument: InstrumentProfile): number {
  const stepDecimals = decimalPlaces(instrument.lotStep)
  const sanitized = Number.isFinite(rawLot) ? rawLot : 0
  const bounded = clamp(sanitized, instrument.minLot, instrument.maxLot)
  const units = Math.round(bounded / instrument.lotStep)
  const aligned = units * instrument.lotStep

  return Number(Math.max(aligned, instrument.minLot).toFixed(stepDecimals))
}

function weightedAverageEntry(orders: GridOrder[]): number {
  const totalLots = orders.reduce((sum, order) => sum + order.lot, 0)

  if (totalLots <= 0) {
    return 0
  }

  const weighted = orders.reduce(
    (sum, order) => sum + order.openPrice * order.lot,
    0,
  )

  return weighted / totalLots
}

function getGapPercent(strategy: StrategyInputs, buySwingCount: number): number {
  if (
    strategy.enableDynamicGap &&
    buySwingCount >= strategy.dynamicGapSwingCount
  ) {
    return (
      strategy.gapPercent +
      (buySwingCount - strategy.dynamicGapSwingCount + 1) *
        strategy.dynamicGapPercentToIncrease
    )
  }

  return strategy.gapPercent
}

function getRetracementPercent(
  strategy: StrategyInputs,
  buySwingCount: number,
): number {
  if (
    strategy.enableDynamicRetracement &&
    buySwingCount >= strategy.dynamicRetracementSwingCount
  ) {
    return Math.max(
      strategy.minRetracementPercent,
      strategy.targetRetracement -
        (buySwingCount + 1 - strategy.dynamicRetracementSwingCount) *
          strategy.dynamicRetracementPercentToReduce,
    )
  }

  return strategy.targetRetracement
}

function computeRecoveryLot(params: {
  currentAsk: number
  lastOrderOpenPrice: number
  orders: GridOrder[]
  instrument: InstrumentProfile
  strategy: StrategyInputs
  retracementPercent: number
}): number {
  const {
    currentAsk,
    lastOrderOpenPrice,
    orders,
    instrument,
    strategy,
    retracementPercent,
  } = params

  const targetPrice =
    currentAsk +
    (lastOrderOpenPrice - currentAsk) * (retracementPercent / 100)
  const targetPoints = Math.abs(targetPrice - currentAsk) / instrument.pointSize

  if (targetPoints <= 0 || instrument.tickValuePerLot <= 0) {
    return instrument.minLot
  }

  let totalOrdersLoss = 0
  let totalOrdersProfit = 0

  for (const order of orders) {
    const priceDelta = targetPrice - order.openPrice
    const points = priceDelta / instrument.pointSize
    const value = points * instrument.tickValuePerLot * order.lot

    if (value >= 0) {
      totalOrdersProfit += value
    } else {
      totalOrdersLoss += Math.abs(value)
    }
  }

  const numerator =
    totalOrdersLoss +
    totalOrdersLoss / Math.max(strategy.rrRatio, 0.0001) -
    totalOrdersProfit

  if (!Number.isFinite(numerator) || numerator <= 0) {
    return instrument.minLot
  }

  return numerator / (targetPoints * instrument.tickValuePerLot)
}

function classifyRiskStatus(point: ScenarioPoint): RiskStatus {
  if (
    point.usedMargin > 0 &&
    (point.equity <= 0 || point.freeMargin <= 0 || point.marginLevel <= 100)
  ) {
    return 'Likely Stop-Out'
  }

  if (
    point.haltedByLotCap ||
    point.marginLevel < 150 ||
    point.drawdownPct >= 35
  ) {
    return 'Danger'
  }

  if (point.marginLevel < 250 || point.drawdownPct >= 20) {
    return 'Caution'
  }

  return 'Safe'
}

function buildScenarioPoint(params: {
  accountSize: number
  scenarioAskPrice: number
  spreadPrice: number
  effectiveLeverage: number
  instrument: InstrumentProfile
  strategy: StrategyInputs
  orders: GridOrder[]
  adverseMovePct: number
  currentRetracementPercent: number
  haltedByLotCap: boolean
  haltReason: string | null
}): ScenarioPoint {
  const {
    accountSize,
    scenarioAskPrice,
    spreadPrice,
    effectiveLeverage,
    instrument,
    strategy,
    orders,
    adverseMovePct,
    currentRetracementPercent,
    haltedByLotCap,
    haltReason,
  } = params

  const scenarioBidPrice = Math.max(
    scenarioAskPrice - spreadPrice,
    scenarioAskPrice * 0.0001,
  )
  const totalLots = orders.reduce((sum, order) => sum + order.lot, 0)
  const averageEntry = weightedAverageEntry(orders)

  const floatingPnL = orders.reduce((sum, order) => {
    const directionalPoints =
      (scenarioBidPrice - order.openPrice) / instrument.pointSize
    return sum + directionalPoints * instrument.tickValuePerLot * order.lot
  }, 0)

  const usedMargin = orders.reduce((sum, order) => {
    return (
      sum + (order.openPrice * instrument.contractSize * order.lot) / effectiveLeverage
    )
  }, 0)

  const totalExposureNotional = orders.reduce((sum, order) => {
    return sum + order.openPrice * instrument.contractSize * order.lot
  }, 0)

  const equity = accountSize + floatingPnL
  const freeMargin = equity - usedMargin
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 9999
  const drawdownDollar = Math.max(0, -floatingPnL)
  const drawdownPct = accountSize > 0 ? (drawdownDollar / accountSize) * 100 : 0
  const firstOrder = orders[0]
  const lastOrder = orders[orders.length - 1]
  const recoveryPrice =
    orders.length <= 1
      ? firstOrder.openPrice *
        (1 +
          (strategy.enableFirstOrderTarget
            ? strategy.firstOrderTargetPercent
            : strategy.targetRetracement / 10) /
            100)
      : lastOrder.openPrice +
        (firstOrder.openPrice - lastOrder.openPrice) *
          (currentRetracementPercent / 100)
  const bounceNeededPct =
    scenarioBidPrice > 0
      ? Math.max(0, ((recoveryPrice - scenarioBidPrice) / scenarioBidPrice) * 100)
      : 0

  const nextGapPercent = getGapPercent(strategy, Math.max(orders.length - 1, 0))
  const nextTriggerPrice =
    haltedByLotCap || !lastOrder
      ? null
      : round(lastOrder.openPrice * (1 - nextGapPercent / 100), 4)

  const basePoint: ScenarioPoint = {
    adverseMovePct,
    scenarioAskPrice: round(scenarioAskPrice, 4),
    scenarioBidPrice: round(scenarioBidPrice, 4),
    totalLots: round(totalLots, 2),
    gridDepth: orders.length,
    averageEntry: round(averageEntry, 4),
    equity: round(equity, 2),
    floatingPnL: round(floatingPnL, 2),
    drawdownDollar: round(drawdownDollar, 2),
    drawdownPct: round(drawdownPct, 2),
    usedMargin: round(usedMargin, 2),
    freeMargin: round(freeMargin, 2),
    marginLevel: round(marginLevel, 2),
    recoveryPrice: round(recoveryPrice, 4),
    bounceNeededPct: round(bounceNeededPct, 2),
    totalExposureNotional: round(totalExposureNotional, 2),
    nextTriggerPrice,
    haltedByLotCap,
    haltReason,
    status: 'Safe',
  }

  return {
    ...basePoint,
    status: classifyRiskStatus(basePoint),
  }
}

function summarizeCase(result: SimulationCaseResult): SimulationCaseResult {
  return {
    ...result,
    worstDrawdownPct: round(
      Math.max(...result.points.map((point) => point.drawdownPct)),
      2,
    ),
    maxGridDepth: Math.max(...result.points.map((point) => point.gridDepth)),
    maxExposureNotional: round(
      Math.max(...result.points.map((point) => point.totalExposureNotional)),
      2,
    ),
    maxUsedMargin: round(
      Math.max(...result.points.map((point) => point.usedMargin)),
      2,
    ),
    firstDangerMovePct:
      result.points.find((point) => point.status === 'Danger')?.adverseMovePct ??
      null,
    firstStopOutMovePct:
      result.points.find((point) => point.status === 'Likely Stop-Out')
        ?.adverseMovePct ?? null,
    firstHaltMovePct:
      result.points.find((point) => point.haltedByLotCap)?.adverseMovePct ?? null,
  }
}

export function simulateRiskCase(
  inputs: SimulationInputs,
  label: 'Normal' | 'Stressed',
): SimulationCaseResult {
  const leverageMultiplier =
    label === 'Stressed' ? inputs.strategy.stressLeverageMultiplier : 1
  const spreadMultiplier =
    label === 'Stressed' ? inputs.strategy.stressSpreadMultiplier : 1
  const effectiveLeverage = Math.max(1, inputs.leverage * leverageMultiplier)
  const spreadPrice =
    inputs.instrument.baseSpreadPoints *
    inputs.instrument.pointSize *
    spreadMultiplier
  const startingLot = normalizeLot(inputs.strategy.initialLot, inputs.instrument)
  const orders: GridOrder[] = [
    {
      id: 'grid-1',
      sequence: 1,
      openPrice: round(inputs.startPrice, 4),
      lot: startingLot,
      triggerGapPercent: inputs.strategy.gapPercent,
      retracementPercent: inputs.strategy.targetRetracement,
    },
  ]

  const points: ScenarioPoint[] = []
  const workingOrders = [...orders]
  let buySwingCount = 0
  let currentRetracementPercent = inputs.strategy.targetRetracement
  let haltedByLotCap = false
  let haltReason: string | null = null

  for (
    let adverseMovePct = 1;
    adverseMovePct <= inputs.strategy.maxSimulationMove;
    adverseMovePct += 1
  ) {
    const scenarioAskPrice = inputs.startPrice * (1 - adverseMovePct / 100)

    while (!haltedByLotCap) {
      const lastOrder = workingOrders[workingOrders.length - 1]
      const gapPercent = getGapPercent(inputs.strategy, buySwingCount)
      const triggerPrice = lastOrder.openPrice * (1 - gapPercent / 100)

      if (scenarioAskPrice > triggerPrice + LOT_EPSILON) {
        break
      }

      currentRetracementPercent = getRetracementPercent(
        inputs.strategy,
        buySwingCount,
      )

      const rawRecoveryLot = computeRecoveryLot({
        currentAsk: triggerPrice,
        lastOrderOpenPrice: lastOrder.openPrice,
        orders: workingOrders,
        instrument: inputs.instrument,
        strategy: inputs.strategy,
        retracementPercent: currentRetracementPercent,
      })
      const requiredLot = round(rawRecoveryLot, 4)
      const allowedLot = Math.min(
        inputs.instrument.maxLot,
        inputs.strategy.maxStrategyLot,
      )

      if (requiredLot > allowedLot) {
        haltedByLotCap = true
        haltReason = `Required lot ${requiredLot.toFixed(2)} exceeds cap ${allowedLot.toFixed(
          2,
        )}`
        break
      }

      buySwingCount += 1
      workingOrders.push({
        id: `grid-${workingOrders.length + 1}`,
        sequence: workingOrders.length + 1,
        openPrice: round(triggerPrice, 4),
        lot: normalizeLot(requiredLot, inputs.instrument),
        triggerGapPercent: round(gapPercent, 2),
        retracementPercent: round(currentRetracementPercent, 2),
      })
    }

    points.push(
      buildScenarioPoint({
        accountSize: inputs.accountSize,
        scenarioAskPrice,
        spreadPrice,
        effectiveLeverage,
        instrument: inputs.instrument,
        strategy: inputs.strategy,
        orders: workingOrders,
        adverseMovePct,
        currentRetracementPercent,
        haltedByLotCap,
        haltReason,
      }),
    )
  }

  return summarizeCase({
    label,
    effectiveLeverage: round(effectiveLeverage, 2),
    spreadPoints: round(inputs.instrument.baseSpreadPoints * spreadMultiplier, 2),
    points,
    orders: workingOrders,
    worstDrawdownPct: 0,
    maxGridDepth: 0,
    maxExposureNotional: 0,
    maxUsedMargin: 0,
    firstDangerMovePct: null,
    firstStopOutMovePct: null,
    firstHaltMovePct: null,
  })
}

function qualifiesBand(
  result: SimulationCaseResult,
  band: RecommendationBand,
): ScenarioPoint | null {
  const point = result.points.find(
    (candidate) => candidate.adverseMovePct === band.surviveMovePct,
  )

  if (!point) {
    return null
  }

  if (point.haltedByLotCap || point.status === 'Likely Stop-Out') {
    return null
  }

  if (point.drawdownPct > band.maxDrawdownPct) {
    return null
  }

  if (point.marginLevel < band.minMarginLevel) {
    return null
  }

  if (point.gridDepth > band.maxGridLevels) {
    return null
  }

  return point
}

export function generateRecommendations(
  inputs: SimulationInputs,
): RecommendationResult[] {
  const maxAllowedLot = Math.min(
    inputs.instrument.maxLot,
    inputs.strategy.maxStrategyLot,
  )
  const step = inputs.instrument.lotStep
  const minUnits = Math.max(1, Math.round(inputs.instrument.minLot / step))
  const maxUnits = Math.max(minUnits, Math.floor(maxAllowedLot / step))

  return RECOMMENDATION_BANDS.map((band) => {
    let bestLot: number | null = null
    let bestPoint: ScenarioPoint | null = null
    let low = minUnits
    let high = maxUnits

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const lot = round(mid * step, decimalPlaces(step))
      const stressedResult = simulateRiskCase(
        {
          ...inputs,
          strategy: {
            ...inputs.strategy,
            initialLot: lot,
          },
        },
        'Stressed',
      )
      const point = qualifiesBand(stressedResult, band)

      if (point) {
        bestLot = lot
        bestPoint = point
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    if (!bestLot || !bestPoint) {
      return {
        band,
        startLot: null,
        qualified: false,
        pointAtBand: null,
        summary: `Do not trade under the ${band.label.toLowerCase()} limits.`,
      }
    }

    return {
      band,
      startLot: bestLot,
      qualified: true,
      pointAtBand: bestPoint,
      summary: `Start at ${bestLot.toFixed(2)} lots to stay inside the ${band.surviveMovePct}% stressed move guardrail.`,
    }
  })
}

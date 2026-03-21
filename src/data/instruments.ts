import type {
  InstrumentKey,
  InstrumentProfile,
  RecommendationBand,
  StrategyInputs,
} from '../types'

export const DEFAULT_STRATEGY_INPUTS: StrategyInputs = {
  initialLot: 0.01,
  rrRatio: 3,
  gapPercent: 2,
  enableDynamicGap: false,
  dynamicGapSwingCount: 1000,
  dynamicGapPercentToIncrease: 0.8,
  targetRetracement: 50,
  enableDynamicRetracement: false,
  dynamicRetracementSwingCount: 300,
  dynamicRetracementPercentToReduce: 20,
  minRetracementPercent: 10,
  enableFirstOrderTarget: true,
  firstOrderTargetPercent: 0.1,
  maxStrategyLot: 500,
  maxSimulationMove: 50,
  stressLeverageMultiplier: 0.5,
  stressSpreadMultiplier: 2,
}

export const DEFAULT_INSTRUMENT_PROFILES: Record<InstrumentKey, InstrumentProfile> =
  {
    us500: {
      key: 'us500',
      name: 'US500m',
      marketProxy: '^GSPC',
      description:
        'Calibrated from the provided MT5 US500m basket snapshot: 0.01 lot is about $1 per point, with margin matching a 100x contract multiplier at 1:400 leverage. Swap is still excluded from the move-only simulator.',
      contractSize: 100,
      pointSize: 1,
      tickValuePerLot: 100,
      minLot: 0.01,
      lotStep: 0.01,
      maxLot: 500,
      baseSpreadPoints: 0.8,
      priceFeedSymbol: '^GSPC',
    },
    xauusd: {
      key: 'xauusd',
      name: 'Gold',
      marketProxy: 'GC=F',
      description: 'Gold proxy using front-month futures when a spot API is unavailable.',
      contractSize: 100,
      pointSize: 0.1,
      tickValuePerLot: 10,
      minLot: 0.01,
      lotStep: 0.01,
      maxLot: 100,
      baseSpreadPoints: 3,
      priceFeedSymbol: 'GC=F',
    },
    usoil: {
      key: 'usoil',
      name: 'US Oil',
      marketProxy: 'CL=F',
      description: 'WTI crude proxy using futures when broker quotes are unavailable.',
      contractSize: 100,
      pointSize: 0.01,
      tickValuePerLot: 1,
      minLot: 0.01,
      lotStep: 0.01,
      maxLot: 100,
      baseSpreadPoints: 5,
      priceFeedSymbol: 'CL=F',
    },
  }

export const RECOMMENDATION_BANDS: RecommendationBand[] = [
  {
    key: 'conservative',
    label: 'Conservative',
    surviveMovePct: 20,
    maxDrawdownPct: 15,
    minMarginLevel: 300,
    maxGridLevels: 8,
    accent: '#2ca58d',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    surviveMovePct: 15,
    maxDrawdownPct: 25,
    minMarginLevel: 200,
    maxGridLevels: 10,
    accent: '#d18800',
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    surviveMovePct: 10,
    maxDrawdownPct: 35,
    minMarginLevel: 150,
    maxGridLevels: 12,
    accent: '#d1495b',
  },
]

export const CHECKPOINTS = [5, 10, 15, 20, 25, 30, 40, 50]

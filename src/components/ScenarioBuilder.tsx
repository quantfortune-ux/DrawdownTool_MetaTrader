import type {
  InstrumentKey,
  InstrumentProfile,
  StrategyInputs,
} from '../types'

interface ScenarioBuilderProps {
  activeInstrument: InstrumentProfile
  instrumentProfiles: Record<InstrumentKey, InstrumentProfile>
  selectedInstrumentKey: InstrumentKey
  accountSize: number
  leverage: number
  currentPrice: number
  strategyInputs: StrategyInputs
  isCalculating: boolean
  onInstrumentSelect: (key: InstrumentKey) => void
  onAccountSizeChange: (value: number) => void
  onLeverageChange: (value: number) => void
  onPriceChange: (value: number) => void
  onStrategyChange: <K extends keyof StrategyInputs>(
    field: K,
    value: StrategyInputs[K],
  ) => void
  onInstrumentChange: <K extends keyof InstrumentProfile>(
    field: K,
    value: InstrumentProfile[K],
  ) => void
}

function ScenarioBuilder({
  activeInstrument,
  instrumentProfiles,
  selectedInstrumentKey,
  accountSize,
  leverage,
  currentPrice,
  strategyInputs,
  isCalculating,
  onInstrumentSelect,
  onAccountSizeChange,
  onLeverageChange,
  onPriceChange,
  onStrategyChange,
  onInstrumentChange,
}: ScenarioBuilderProps) {
  return (
    <section className="panel form-panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Inputs</span>
          <h2>Scenario Builder</h2>
        </div>
        <div className="pill">{isCalculating ? 'Updating' : 'Ready'}</div>
      </div>

      <div className="instrument-picker">
        {(Object.keys(instrumentProfiles) as InstrumentKey[]).map((key) => {
          const profile = instrumentProfiles[key]
          const active = key === selectedInstrumentKey

          return (
            <button
              key={key}
              className={`instrument-tile ${active ? 'instrument-tile--active' : ''}`}
              onClick={() => onInstrumentSelect(key)}
            >
              <span>{profile.name}</span>
              <small>{profile.marketProxy}</small>
            </button>
          )
        })}
      </div>

      <div className="form-grid">
        <label>
          <span>Account size (USD)</span>
          <input
            type="number"
            min="0"
            step="100"
            value={accountSize}
            onChange={(event) => onAccountSizeChange(Number(event.target.value))}
          />
        </label>
        <label>
          <span>Leverage</span>
          <input
            type="number"
            min="1"
            step="1"
            value={leverage}
            onChange={(event) => onLeverageChange(Number(event.target.value))}
          />
        </label>
        <label>
          <span>Reference price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={currentPrice || ''}
            onChange={(event) => onPriceChange(Number(event.target.value))}
            placeholder="Manual price"
          />
        </label>
        <label>
          <span>Initial lot</span>
          <input
            type="number"
            min={activeInstrument.minLot}
            step={activeInstrument.lotStep}
            value={strategyInputs.initialLot}
            onChange={(event) =>
              onStrategyChange('initialLot', Number(event.target.value))
            }
          />
        </label>
        <label>
          <span>Gap %</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={strategyInputs.gapPercent}
            onChange={(event) =>
              onStrategyChange('gapPercent', Number(event.target.value))
            }
          />
        </label>
        <label>
          <span>Retracement target %</span>
          <input
            type="number"
            min="1"
            step="1"
            value={strategyInputs.targetRetracement}
            onChange={(event) =>
              onStrategyChange('targetRetracement', Number(event.target.value))
            }
          />
        </label>
        <label>
          <span>RR ratio</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={strategyInputs.rrRatio}
            onChange={(event) =>
              onStrategyChange('rrRatio', Number(event.target.value))
            }
          />
        </label>
        <label>
          <span>Max single order lot</span>
          <input
            type="number"
            min={activeInstrument.minLot}
            step={activeInstrument.lotStep}
            value={strategyInputs.maxStrategyLot}
            onChange={(event) =>
              onStrategyChange('maxStrategyLot', Number(event.target.value))
            }
          />
        </label>
      </div>

      <details className="details-block">
        <summary>Advanced strategy controls</summary>
        <div className="form-grid form-grid--tight">
          <label className="toggle">
            <input
              type="checkbox"
              checked={strategyInputs.enableDynamicGap}
              onChange={(event) =>
                onStrategyChange('enableDynamicGap', event.target.checked)
              }
            />
            <span>Enable dynamic gap</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={strategyInputs.enableDynamicRetracement}
              onChange={(event) =>
                onStrategyChange('enableDynamicRetracement', event.target.checked)
              }
            />
            <span>Enable dynamic retracement</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={strategyInputs.enableFirstOrderTarget}
              onChange={(event) =>
                onStrategyChange('enableFirstOrderTarget', event.target.checked)
              }
            />
            <span>Use first-order target</span>
          </label>
          <label>
            <span>Dynamic gap starts after</span>
            <input
              type="number"
              min="1"
              step="1"
              value={strategyInputs.dynamicGapSwingCount}
              onChange={(event) =>
                onStrategyChange(
                  'dynamicGapSwingCount',
                  Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            <span>Gap increase %</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={strategyInputs.dynamicGapPercentToIncrease}
              onChange={(event) =>
                onStrategyChange(
                  'dynamicGapPercentToIncrease',
                  Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            <span>Dynamic retracement starts after</span>
            <input
              type="number"
              min="1"
              step="1"
              value={strategyInputs.dynamicRetracementSwingCount}
              onChange={(event) =>
                onStrategyChange(
                  'dynamicRetracementSwingCount',
                  Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            <span>Retracement reduction %</span>
            <input
              type="number"
              min="0"
              step="1"
              value={strategyInputs.dynamicRetracementPercentToReduce}
              onChange={(event) =>
                onStrategyChange(
                  'dynamicRetracementPercentToReduce',
                  Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            <span>Minimum retracement %</span>
            <input
              type="number"
              min="1"
              step="1"
              value={strategyInputs.minRetracementPercent}
              onChange={(event) =>
                onStrategyChange(
                  'minRetracementPercent',
                  Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            <span>First order target %</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={strategyInputs.firstOrderTargetPercent}
              onChange={(event) =>
                onStrategyChange(
                  'firstOrderTargetPercent',
                  Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            <span>Stress leverage multiplier</span>
            <input
              type="number"
              min="0.1"
              max="1"
              step="0.1"
              value={strategyInputs.stressLeverageMultiplier}
              onChange={(event) =>
                onStrategyChange(
                  'stressLeverageMultiplier',
                  Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            <span>Stress spread multiplier</span>
            <input
              type="number"
              min="1"
              step="0.5"
              value={strategyInputs.stressSpreadMultiplier}
              onChange={(event) =>
                onStrategyChange(
                  'stressSpreadMultiplier',
                  Number(event.target.value),
                )
              }
            />
          </label>
        </div>
      </details>

      <details className="details-block">
        <summary>Instrument assumptions</summary>
        <div className="form-grid form-grid--tight">
          <label>
            <span>Contract multiplier</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={activeInstrument.contractSize}
              onChange={(event) =>
                onInstrumentChange('contractSize', Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Point size</span>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={activeInstrument.pointSize}
              onChange={(event) =>
                onInstrumentChange('pointSize', Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>USD per point @ 1.00 lot</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={activeInstrument.tickValuePerLot}
              onChange={(event) =>
                onInstrumentChange('tickValuePerLot', Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Base spread (points)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={activeInstrument.baseSpreadPoints}
              onChange={(event) =>
                onInstrumentChange('baseSpreadPoints', Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Min lot</span>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={activeInstrument.minLot}
              onChange={(event) =>
                onInstrumentChange('minLot', Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Lot step</span>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={activeInstrument.lotStep}
              onChange={(event) =>
                onInstrumentChange('lotStep', Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Instrument max lot</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={activeInstrument.maxLot}
              onChange={(event) =>
                onInstrumentChange('maxLot', Number(event.target.value))
              }
            />
          </label>
          <label>
            <span>Price feed symbol</span>
            <input
              type="text"
              value={activeInstrument.priceFeedSymbol}
              onChange={(event) =>
                onInstrumentChange('priceFeedSymbol', event.target.value)
              }
            />
          </label>
        </div>
        <p className="details-block__note">{activeInstrument.description}</p>
      </details>
    </section>
  )
}

export default ScenarioBuilder

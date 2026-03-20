import type { InstrumentProfile, PriceQuote } from '../types'

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string
        regularMarketPrice?: number
        previousClose?: number
      }
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>
        }>
      }
    }>
    error?: {
      code?: string
      description?: string
    } | null
  }
}

function latestNumber(values: Array<number | null> | undefined): number | null {
  if (!values) {
    return null
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return null
}

export async function fetchLivePrice(
  instrument: InstrumentProfile,
): Promise<PriceQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    instrument.priceFeedSymbol,
  )}?interval=1d&range=5d`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Price feed returned ${response.status}`)
  }

  const payload = (await response.json()) as YahooChartResponse
  const result = payload.chart?.result?.[0]

  if (!result) {
    const message = payload.chart?.error?.description ?? 'No quote returned'
    throw new Error(message)
  }

  const closePrice = latestNumber(result.indicators?.quote?.[0]?.close)
  const livePrice =
    result.meta?.regularMarketPrice ?? closePrice ?? result.meta?.previousClose

  if (!livePrice || !Number.isFinite(livePrice)) {
    throw new Error('Quote did not contain a usable price')
  }

  return {
    value: livePrice,
    provider: 'Yahoo Finance',
    symbol: result.meta?.symbol ?? instrument.priceFeedSymbol,
    fetchedAt: new Date().toISOString(),
  }
}

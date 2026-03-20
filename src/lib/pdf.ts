import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import { CHECKPOINTS } from '../data/instruments'
import type {
  ClientRecord,
  InstrumentProfile,
  RecommendationResult,
  SimulationCaseResult,
  StrategyInputs,
} from '../types'

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function exportRiskReportPdf(params: {
  client: ClientRecord
  instrument: InstrumentProfile
  currentPrice: number
  strategy: StrategyInputs
  normal: SimulationCaseResult
  stressed: SimulationCaseResult
  recommendations: RecommendationResult[]
}): void {
  const { client, instrument, currentPrice, strategy, normal, stressed, recommendations } =
    params

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  doc.setFillColor(13, 35, 52)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 100, 'F')
  doc.setTextColor(245, 247, 250)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text('RiskDesk Report', 40, 52)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 74)

  doc.setTextColor(25, 32, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Client Summary', 40, 132)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Client: ${client.name || 'Unnamed client'}`, 40, 156)
  doc.text(`Instrument: ${instrument.name}`, 40, 174)
  doc.text(`Current price: ${currentPrice.toFixed(2)}`, 40, 192)
  doc.text(`Account size: ${currency(client.accountSize)}`, 40, 210)
  doc.text(`Leverage: 1:${client.leverage}`, 40, 228)

  autoTable(doc, {
    startY: 260,
    head: [['Band', 'Recommended Lot', 'Summary']],
    body: recommendations.map((item) => [
      item.band.label,
      item.startLot?.toFixed(2) ?? 'Do Not Trade',
      item.summary,
    ]),
    styles: {
      fontSize: 10,
      cellPadding: 6,
    },
    headStyles: {
      fillColor: [16, 86, 82],
    },
  })

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
          ?.finalY ?? 0) + 28
      : 400,
    head: [
      [
        'Scenario',
        'Move',
        'Price',
        'Drawdown',
        'Margin Level',
        'Grid Depth',
        'Status',
      ],
    ],
    body: [normal, stressed].flatMap((scenario) =>
      CHECKPOINTS.map((checkpoint) => {
        const point = scenario.points.find(
          (candidate) => candidate.adverseMovePct === checkpoint,
        )

        return [
          scenario.label,
          `${checkpoint}%`,
          point?.scenarioBidPrice.toFixed(2) ?? '-',
          point ? `${point.drawdownPct.toFixed(2)}%` : '-',
          point ? `${point.marginLevel.toFixed(0)}%` : '-',
          point?.gridDepth ?? '-',
          point?.status ?? '-',
        ]
      }),
    ),
    styles: {
      fontSize: 9,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [209, 136, 0],
    },
    pageBreak: 'auto',
  })

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
          ?.finalY ?? 0) + 28
      : 640,
    head: [['Strategy Setting', 'Value']],
    body: [
      ['Initial lot', strategy.initialLot.toFixed(2)],
      ['Gap %', strategy.gapPercent.toFixed(2)],
      ['Dynamic gap start', `${strategy.dynamicGapSwingCount} swings`],
      ['Gap increase', strategy.dynamicGapPercentToIncrease.toFixed(2)],
      ['Retracement target', `${strategy.targetRetracement.toFixed(0)}%`],
      ['Dynamic retracement start', `${strategy.dynamicRetracementSwingCount} swings`],
      ['Retracement reduction', `${strategy.dynamicRetracementPercentToReduce.toFixed(0)}%`],
      ['Min retracement', `${strategy.minRetracementPercent.toFixed(0)}%`],
      ['Stress leverage multiplier', strategy.stressLeverageMultiplier.toFixed(2)],
      ['Stress spread multiplier', strategy.stressSpreadMultiplier.toFixed(2)],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [44, 76, 108],
    },
  })

  const filename = `${client.name || 'client'}-${instrument.name}-risk-report.pdf`
    .toLowerCase()
    .replace(/\s+/g, '-')

  doc.save(filename)
}

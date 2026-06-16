export type PredictionAlgorithm = 'linear' | 'movingAverage' | 'exponentialSmoothing'

interface RawDataPoint {
  date: string
  total: number
}

interface MonthlyDataPoint {
  date: string
  total: number
}

export interface ProcessedDataPoint {
  date: string
  timestamp: number
  total: number
  isOutlier: boolean
}

export interface PredictionPoint {
  date: string
  value: number
  lower: number
  upper: number
}

export interface PredictionResult {
  canPredict: boolean
  message?: string
  algorithm: PredictionAlgorithm
  processedData: ProcessedDataPoint[]
  predictions: PredictionPoint[]
  targetReachDate?: string
  targetReachMonths?: number
  monthlyGrowthRate?: number
  metrics: {
    slope: number
    intercept: number
    rSquared?: number
    confidenceLevel: number
  }
}

const CONFIDENCE_Z = 1.96

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + '-01')
  d.setMonth(d.getMonth() + months)
  return formatDate(d)
}

function monthsBetween(start: string, end: string): number {
  const s = new Date(start + '-01')
  const e = new Date(end + '-01')
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

export function preprocessData(rawRecords: RawDataPoint[]): {
  monthlyData: MonthlyDataPoint[]
  removedOutliers: MonthlyDataPoint[]
} {
  if (!rawRecords || rawRecords.length === 0) {
    return { monthlyData: [], removedOutliers: [] }
  }

  const monthlyMap = new Map<string, number[]>()
  for (const r of rawRecords) {
    const d = new Date(r.date)
    const key = formatDate(d)
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, [])
    }
    monthlyMap.get(key)!.push(Number(r.total))
  }

  const monthlyRaw: Array<{ date: string; total: number }> = []
  for (const [date, values] of monthlyMap.entries()) {
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    monthlyRaw.push({ date, total: Math.round(avg * 100) / 100 })
  }

  monthlyRaw.sort((a, b) => a.date.localeCompare(b.date))

  if (monthlyRaw.length <= 2) {
    return { monthlyData: monthlyRaw, removedOutliers: [] }
  }

  const values = monthlyRaw.map(m => m.total)
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const std = Math.sqrt(variance)

  const kept: Array<{ date: string; total: number }> = []
  const removed: Array<{ date: string; total: number }> = []
  for (const p of monthlyRaw) {
    const z = std === 0 ? 0 : Math.abs(p.total - mean) / std
    if (z <= 3) {
      kept.push(p)
    } else {
      removed.push(p)
    }
  }

  return { monthlyData: kept, removedOutliers: removed }
}

export function linearRegression(
  data: MonthlyDataPoint[],
  monthsAhead: number
): {
  predictions: PredictionPoint[]
  slope: number
  intercept: number
  rSquared: number
  stdError: number
} {
  const n = data.length
  const xs: number[] = []
  const ys: number[] = []
  const baseDate = data[0].date

  for (let i = 0; i < n; i++) {
    xs.push(monthsBetween(baseDate, data[i].date))
    ys.push(data[i].total)
  }

  const sumX = xs.reduce((s, v) => s + v, 0)
  const sumY = ys.reduce((s, v) => s + v, 0)
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0)
  const sumX2 = xs.reduce((s, v) => s + v * v, 0)
  const sumY2 = ys.reduce((s, v) => s + v * v, 0)

  const denominator = n * sumX2 - sumX * sumX
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  const ssTot = sumY2 - (sumY * sumY) / n
  const ssRes = ys.reduce((s, y, i) => {
    const pred = intercept + slope * xs[i]
    return s + (y - pred) ** 2
  }, 0)
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot
  const stdError = n <= 2 ? 0 : Math.sqrt(ssRes / (n - 2))

  const lastMonth = data[data.length - 1].date
  const predictions: PredictionPoint[] = []

  for (let i = 1; i <= monthsAhead; i++) {
    const futureX = monthsBetween(baseDate, lastMonth) + i
    const predVal = Math.max(0, intercept + slope * futureX)
    const se = stdError * Math.sqrt(1 + 1 / n + (futureX - sumX / n) ** 2 / (sumX2 - sumX * sumX / n))
    const margin = CONFIDENCE_Z * se
    predictions.push({
      date: addMonths(lastMonth, i),
      value: Math.round(predVal * 100) / 100,
      lower: Math.round(Math.max(0, predVal - margin) * 100) / 100,
      upper: Math.round((predVal + margin) * 100) / 100,
    })
  }

  return { predictions, slope, intercept, rSquared, stdError }
}

export function movingAverage(
  data: MonthlyDataPoint[],
  monthsAhead: number,
  windowSize: number = 3
): {
  predictions: PredictionPoint[]
  slope: number
  intercept: number
  stdError: number
} {
  const n = data.length
  const lastN = Math.min(windowSize, n)
  const window = data.slice(n - lastN)
  const values = window.map(w => w.total)

  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)

  const recentDiffs: number[] = []
  for (let i = 1; i < values.length; i++) {
    recentDiffs.push(values[i] - values[i - 1])
  }
  const avgDiff = recentDiffs.length === 0 ? 0 : recentDiffs.reduce((s, v) => s + v, 0) / recentDiffs.length

  const slope = avgDiff
  const xs = Array.from({ length: n }, (_, i) => i)
  const ys = data.map(d => d.total)
  const sumX = xs.reduce((s, v) => s + v, 0)
  const sumY = ys.reduce((s, v) => s + v, 0)
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0)
  const sumX2 = xs.reduce((s, v) => s + v * v, 0)
  const denom = n * sumX2 - sumX * sumX
  const intercept = denom === 0 ? data[0].total : (sumX2 * sumY - sumX * sumXY) / denom

  const lastDate = data[data.length - 1].date
  const predictions: PredictionPoint[] = []
  let currentVal = mean

  for (let i = 1; i <= monthsAhead; i++) {
    currentVal = currentVal + avgDiff
    const predVal = Math.max(0, currentVal)
    const margin = CONFIDENCE_Z * std * Math.sqrt(1 + i / lastN)
    predictions.push({
      date: addMonths(lastDate, i),
      value: Math.round(predVal * 100) / 100,
      lower: Math.round(Math.max(0, predVal - margin) * 100) / 100,
      upper: Math.round((predVal + margin) * 100) / 100,
    })
  }

  return { predictions, slope, intercept, stdError: std }
}

export function exponentialSmoothing(
  data: MonthlyDataPoint[],
  monthsAhead: number,
  alpha: number = 0.3,
  beta: number = 0.1
): {
  predictions: PredictionPoint[]
  slope: number
  intercept: number
  stdError: number
} {
  const n = data.length
  const ys = data.map(d => d.total)

  let level = ys[0]
  let trend = n >= 2 ? (ys[1] - ys[0]) : 0

  const residuals: number[] = []
  for (let i = 1; i < n; i++) {
    const prevLevel = level
    const prevTrend = trend
    const forecast = prevLevel + prevTrend
    residuals.push(ys[i] - forecast)
    level = alpha * ys[i] + (1 - alpha) * (prevLevel + prevTrend)
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend
  }

  const residualVar = residuals.length === 0
    ? 0
    : residuals.reduce((s, r) => s + r * r, 0) / residuals.length
  const std = Math.sqrt(residualVar)

  const slope = trend
  const intercept = level

  const lastDate = data[data.length - 1].date
  const predictions: PredictionPoint[] = []

  for (let i = 1; i <= monthsAhead; i++) {
    const predVal = Math.max(0, level + trend * i)
    const horizonFactor = Math.sqrt(1 + alpha * alpha * i + alpha * alpha * (i * (i - 1)) / 2)
    const margin = CONFIDENCE_Z * std * horizonFactor
    predictions.push({
      date: addMonths(lastDate, i),
      value: Math.round(predVal * 100) / 100,
      lower: Math.round(Math.max(0, predVal - margin) * 100) / 100,
      upper: Math.round((predVal + margin) * 100) / 100,
    })
  }

  return { predictions, slope, intercept, stdError: std }
}

export function computeTargetReach(
  predictions: PredictionPoint[],
  lastTotal: number,
  target: number,
  lastDate: string
): { date?: string; months?: number } {
  if (!target || target <= 0) return {}
  if (lastTotal >= target) return { date: lastDate, months: 0 }

  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i].value >= target) {
      return {
        date: predictions[i].date,
        months: i + 1,
      }
    }
  }

  const n = predictions.length
  if (n >= 2) {
    const lastPred = predictions[n - 1]
    const prevPred = predictions[n - 2]
    const monthlyGrowth = lastPred.value - prevPred.value
    if (monthlyGrowth > 0) {
      const remaining = target - lastPred.value
      const extraMonths = Math.ceil(remaining / monthlyGrowth)
      const totalExtra = n + extraMonths
      return {
        date: addMonths(lastDate, totalExtra),
        months: totalExtra,
      }
    }
  }

  return {}
}

export function runPrediction(
  rawRecords: RawDataPoint[],
  algorithm: PredictionAlgorithm,
  monthsAhead: number,
  targetAmount?: number
): PredictionResult {
  const { monthlyData, removedOutliers } = preprocessData(rawRecords)

  const minDataPoints = 3
  if (monthlyData.length < minDataPoints) {
    return {
      canPredict: false,
      message: `数据点不足，至少需要 ${minDataPoints} 个月的有效数据才能进行预测（当前 ${monthlyData.length} 个）`,
      algorithm,
      processedData: [],
      predictions: [],
      metrics: { slope: 0, intercept: 0, confidenceLevel: 95 },
    }
  }

  let algoResult: any
  if (algorithm === 'linear') {
    algoResult = linearRegression(monthlyData, monthsAhead)
  } else if (algorithm === 'movingAverage') {
    algoResult = movingAverage(monthlyData, monthsAhead)
  } else {
    algoResult = exponentialSmoothing(monthlyData, monthsAhead)
  }

  const { predictions, slope, intercept, stdError } = algoResult
  const rSquared: number | undefined = algoResult.rSquared
  const processedData: ProcessedDataPoint[] = monthlyData.map(m => ({
    date: m.date,
    timestamp: new Date(m.date + '-01').getTime(),
    total: m.total,
    isOutlier: false,
  }))
  removedOutliers.forEach(o => {
    processedData.push({
      date: o.date,
      timestamp: new Date(o.date + '-01').getTime(),
      total: o.total,
      isOutlier: true,
    })
  })
  processedData.sort((a, b) => a.timestamp - b.timestamp)

  const lastDate = monthlyData[monthlyData.length - 1].date
  const lastTotal = monthlyData[monthlyData.length - 1].total

  const targetReach = targetAmount && targetAmount > 0
    ? computeTargetReach(predictions, lastTotal, targetAmount, lastDate)
    : {}

  const monthlyGrowthRate = lastTotal > 0 ? (slope / lastTotal) * 100 : 0

  return {
    canPredict: true,
    algorithm,
    processedData,
    predictions,
    targetReachDate: targetReach.date,
    targetReachMonths: targetReach.months,
    monthlyGrowthRate: Math.round(monthlyGrowthRate * 100) / 100,
    metrics: {
      slope: Math.round(slope * 100) / 100,
      intercept: Math.round(intercept * 100) / 100,
      rSquared: rSquared !== undefined ? Math.round(rSquared * 10000) / 10000 : undefined,
      confidenceLevel: 95,
    },
  }
}

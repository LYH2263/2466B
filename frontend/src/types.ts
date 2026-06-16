export interface AssetRecord {
  id: string
  date: string
  cash: number
  longTermInvest: number
  stableBond: number
  total: number
  note: string
  createdAt: string
}

export interface AssetFormData {
  date: string
  cash: number | null
  longTermInvest: number | null
  stableBond: number | null
  note: string
}

export type TransactionDirection = 'INCOME' | 'EXPENSE' | 'TRANSFER'
export type AssetCategory = 'CASH' | 'LONG_TERM_INVEST' | 'STABLE_BOND'

export interface Transaction {
  id: string
  date: string
  amount: number
  direction: TransactionDirection
  category: AssetCategory
  counterparty: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface TransactionFormData {
  date: string
  amount: number | null
  direction: TransactionDirection
  category: AssetCategory
  counterparty: string
  note: string
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface TransactionQuery {
  page?: number
  pageSize?: number
  direction?: TransactionDirection
  category?: AssetCategory
  startDate?: string
  endDate?: string
  keyword?: string
}

export interface MonthlyStat {
  month: string
  income: number
  expense: number
  netFlow: number
  transfer: number
}

export interface OverviewStat {
  income: number
  expense: number
  netFlow: number
  transfer: number
  count: number
}

export interface OverviewStats {
  thisMonth: OverviewStat
  lastMonth: OverviewStat
  total: OverviewStat
}

export interface AssetComparison {
  month: string
  income: number
  expense: number
  netFlow: number
  assetStart: number | null
  assetEnd: number | null
  assetGrowth: number | null
}

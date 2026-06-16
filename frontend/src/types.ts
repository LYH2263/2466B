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

export type ReportPeriod = 'monthly' | 'yearly'

export interface AvailablePeriods {
  hasData: boolean
  years: number[]
  monthly: { year: number; month: number }[]
}

export interface CategoryChange {
  category: AssetCategory
  categoryName: string
  start: number
  end: number
  change: number
  changePercent: number
}

export interface AllocationItem {
  category: AssetCategory
  categoryName: string
  value: number
  percent: number
}

export interface ReportSummary {
  startAsset: number
  endAsset: number
  netGrowth: number
  returnRate: number
  text: string
}

export interface TxSummary {
  income: number
  expense: number
  netFlow: number
  transfer: number
  count: number
}

export interface ReportTx {
  id: string
  date: string
  amount: number
  direction: TransactionDirection
  category: AssetCategory
  counterparty: string
  note: string
}

export interface TimelinePoint {
  date: string
  cash: number
  longTermInvest: number
  stableBond: number
  total: number
}

export interface ReportData {
  period: ReportPeriod
  year: number
  month?: number
  periodLabel: string
  hasData: boolean
  message?: string
  summary: ReportSummary | null
  categoryChanges: CategoryChange[] | null
  allocation: AllocationItem[] | null
  transactions: {
    summary: TxSummary
    recent: ReportTx[]
  } | null
  timeline: TimelinePoint[]
}

export interface ReportQuery {
  period: ReportPeriod
  year: number
  month?: number
}

export interface CurrentUser {
  id: string
  email: string
  role: 'user' | 'admin'
  enabled?: boolean
  createdAt?: string
}

export interface AdminUser {
  id: string
  email: string
  role: 'user' | 'admin'
  enabled: boolean
  failedLoginCount: number
  lockedUntil: string | null
  isLocked: boolean
  createdAt: string
  assetRecordCount: number
  transactionCount: number
}

export interface AdminPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface UserListResponse {
  users: AdminUser[]
  pagination: AdminPagination
}

export type AuditAction = 'ENABLE_USER' | 'DISABLE_USER' | 'UNLOCK_USER' | 'CHANGE_ROLE' | 'FORCE_LOGOUT'

export interface AuditLog {
  id: string
  adminEmail: string
  targetUserEmail: string
  action: AuditAction
  detail: string | null
  createdAt: string
}

export interface AuditLogResponse {
  logs: AuditLog[]
  pagination: AdminPagination
}

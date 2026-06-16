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

export type NotificationType = 'ACCOUNT_LOCKED' | 'NEW_DEVICE_LOGIN' | 'ASSET_TARGET_REACHED' | 'INVENTORY_REMINDER' | 'SYSTEM_NOTICE' | 'ADMIN_ACTION'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  content: string
  data: Record<string, any> | null
  read: boolean
  readAt: string | null
  createdAt: string
  expiresAt: string | null
}

export interface NotificationPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface NotificationListResponse {
  notifications: Notification[]
  pagination: NotificationPagination
}

export type PredictionAlgorithm = 'linear' | 'movingAverage' | 'exponentialSmoothing'

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

export interface PredictionParams {
  algorithm: PredictionAlgorithm
  monthsAhead: number
  targetAmount?: number
}

export type AssetFieldKey = 'date' | 'cash' | 'longTermInvest' | 'stableBond' | 'note'

export interface ColumnMapping {
  [key: string]: AssetFieldKey | null
}

export interface MappedAssetRow {
  rowIndex: number
  rawData: Record<string, string>
  date: string
  cash: string
  longTermInvest: string
  stableBond: string
  note: string
}

export type DuplicateStrategy = 'error' | 'skip' | 'overwrite'

export interface ValidationError {
  rowIndex: number
  field: string
  message: string
  code: string
}

export interface ParsedAssetData {
  date: string
  cash: number
  longTermInvest: number
  stableBond: number
  note: string
}

export interface ValidatedRow {
  rowIndex: number
  isValid: boolean
  data: ParsedAssetData
  errors: ValidationError[]
  warnings: ValidationError[]
}

export interface ParseCsvResponse {
  fileName: string
  fileSize: number
  encoding: string
  delimiter: string
  headers: string[]
  previewRows: string[][]
  totalRows: number
  suggestedMapping: ColumnMapping
}

export interface BatchValidateResponse {
  totalCount: number
  validCount: number
  invalidCount: number
  warningCount: number
  rows: ValidatedRow[]
}

export interface ImportSuccessDetail {
  rowIndex: number
  date: string
  recordId: string
  created: boolean
  overwritten: boolean
}

export interface ImportFailDetail {
  rowIndex: number
  errors: { field: string; message: string; code: string }[]
}

export interface BatchImportResponse {
  importId: string
  totalCount: number
  successCount: number
  failCount: number
  skippedCount: number
  successDetails: ImportSuccessDetail[]
  failDetails: ImportFailDetail[]
  createdAt: string
}

export type ImportWizardStep = 'upload' | 'preview' | 'mapping' | 'validate' | 'result'

export const ASSET_FIELD_LABELS: Record<AssetFieldKey, string> = {
  date: '日期',
  cash: '活钱',
  longTermInvest: '长期投资',
  stableBond: '稳定债券',
  note: '备注',
}

export const ASSET_FIELD_REQUIRED: AssetFieldKey[] = ['date', 'cash', 'longTermInvest', 'stableBond']


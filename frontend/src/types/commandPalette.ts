export type CommandResultType = 'record' | 'page' | 'action'

export interface CommandResultBase {
  id: string
  type: CommandResultType
  title: string
  subtitle?: string
  keywords: string[]
  icon?: string
}

export interface AssetRecordResult extends CommandResultBase {
  type: 'record'
  recordType: 'asset'
  date: string
  total: number
  note?: string
  cash: number
  longTermInvest: number
  stableBond: number
  raw: any
}

export interface TransactionRecordResult extends CommandResultBase {
  type: 'record'
  recordType: 'transaction'
  date: string
  amount: number
  direction: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  category: 'CASH' | 'LONG_TERM_INVEST' | 'STABLE_BOND'
  counterparty: string
  note?: string
  raw: any
}

export type RecordResult = AssetRecordResult | TransactionRecordResult

export interface PageResult extends CommandResultBase {
  type: 'page'
  path: string
}

export interface ActionResult extends CommandResultBase {
  type: 'action'
  action: () => void | Promise<void>
}

export type CommandResult = RecordResult | PageResult | ActionResult

export interface GroupedResults {
  records: RecordResult[]
  pages: PageResult[]
  actions: ActionResult[]
}

export interface SearchQuery {
  keyword: string
  minAmount?: number
  maxAmount?: number
  type?: 'asset' | 'transaction' | 'all'
}

export interface SearchResponse {
  assets: any[]
  transactions: any[]
  combined: any[]
  total: number
  hasMore: boolean
}

export interface ActionRegistryItem {
  id: string
  title: string
  subtitle?: string
  keywords: string[]
  icon?: string
  action: () => void | Promise<void>
  showInPalette: boolean
}

export interface PageRegistryItem {
  id: string
  title: string
  subtitle?: string
  path: string
  keywords: string[]
  icon?: string
}

export interface RecentItem {
  id: string
  type: CommandResultType
  timestamp: number
  data: CommandResult
}

export const RECENT_ITEMS_KEY = 'command_palette_recent'
export const MAX_RECENT_ITEMS = 10

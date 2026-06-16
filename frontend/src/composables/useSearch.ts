import { ref } from 'vue'
import axios from 'axios'
import type {
  SearchQuery,
  SearchResponse,
  RecordResult,
  AssetRecordResult,
  TransactionRecordResult,
  CommandResult,
  RecentItem,
  GroupedResults,
} from '../types/commandPalette'
import { RECENT_ITEMS_KEY, MAX_RECENT_ITEMS } from '../types/commandPalette'
import { useCommandRegistry } from './useCommandRegistry'

export function useSearch() {
  const { searchActions, searchPages } = useCommandRegistry()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const recentItems = ref<RecentItem[]>(loadRecentItems())

  function loadRecentItems(): RecentItem[] {
    try {
      const stored = localStorage.getItem(RECENT_ITEMS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  function saveRecentItems() {
    try {
      localStorage.setItem(
        RECENT_ITEMS_KEY,
        JSON.stringify(recentItems.value.slice(0, MAX_RECENT_ITEMS))
      )
    } catch {
      console.warn('Failed to save recent items to localStorage')
    }
  }

  function addToRecent(item: CommandResult) {
    const existingIndex = recentItems.value.findIndex((r) => r.id === item.id && r.type === item.type)
    
    if (existingIndex !== -1) {
      recentItems.value.splice(existingIndex, 1)
    }

    recentItems.value.unshift({
      id: item.id,
      type: item.type,
      timestamp: Date.now(),
      data: item,
    })

    if (recentItems.value.length > MAX_RECENT_ITEMS) {
      recentItems.value = recentItems.value.slice(0, MAX_RECENT_ITEMS)
    }

    saveRecentItems()
  }

  function clearRecent() {
    recentItems.value = []
    localStorage.removeItem(RECENT_ITEMS_KEY)
  }

  function transformAssetRecord(asset: any): AssetRecordResult {
    return {
      id: `asset-${asset.id}`,
      type: 'record',
      recordType: 'asset',
      title: `资产记录 - ${asset.date}`,
      subtitle: `总资产: ¥${asset.total.toLocaleString()}`,
      date: asset.date,
      total: asset.total,
      note: asset.note || '',
      cash: asset.cash,
      longTermInvest: asset.longTermInvest,
      stableBond: asset.stableBond,
      keywords: [
        asset.date,
        asset.note || '',
        String(asset.total),
        String(asset.cash),
        String(asset.longTermInvest),
        String(asset.stableBond),
        '资产',
        '记录',
      ],
      icon: 'DataLine',
      raw: asset,
    }
  }

  function transformTransactionRecord(tx: any): TransactionRecordResult {
    const directionLabels: Record<string, string> = {
      INCOME: '收入',
      EXPENSE: '支出',
      TRANSFER: '转账',
    }
    const sign = tx.direction === 'INCOME' ? '+' : '-'
    return {
      id: `transaction-${tx.id}`,
      type: 'record',
      recordType: 'transaction',
      title: `${directionLabels[tx.direction]} - ${tx.counterparty}`,
      subtitle: `${sign}¥${tx.amount.toLocaleString()} · ${tx.date}`,
      date: tx.date,
      amount: tx.amount,
      direction: tx.direction,
      category: tx.category,
      counterparty: tx.counterparty,
      note: tx.note || '',
      keywords: [
        tx.date,
        tx.counterparty,
        tx.note || '',
        String(tx.amount),
        tx.direction,
        tx.category,
        directionLabels[tx.direction],
        '交易',
      ],
      icon: tx.direction === 'INCOME' ? 'Top' : tx.direction === 'EXPENSE' ? 'Bottom' : 'Switch',
      raw: tx,
    }
  }

  async function searchRecords(query: SearchQuery): Promise<RecordResult[]> {
    if (!query.keyword.trim() && !query.minAmount && !query.maxAmount) {
      return []
    }

    isLoading.value = true
    error.value = null

    try {
      const params: any = {
        keyword: query.keyword.trim() || undefined,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
        type: query.type || 'all',
        limit: 20,
      }

      const response = await axios.get<SearchResponse>('/api/search', { params })
      const { assets, transactions } = response.data

      const assetResults: AssetRecordResult[] = assets.map(transformAssetRecord)
      const transactionResults: TransactionRecordResult[] = transactions.map(
        transformTransactionRecord
      )

      const allRecords = [...assetResults, ...transactionResults].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      return allRecords
    } catch (err: any) {
      error.value = err.response?.data?.error || '搜索失败'
      return []
    } finally {
      isLoading.value = false
    }
  }

  function filterRecordsByKeyword(records: RecordResult[], keyword: string): RecordResult[] {
    if (!keyword.trim()) return records

    const lowerKeyword = keyword.toLowerCase()
    return records.filter((record) => {
      const searchText = [
        record.title,
        record.subtitle || '',
        ...record.keywords,
      ]
        .join(' ')
        .toLowerCase()
      return fuzzyMatch(searchText, lowerKeyword)
    })
  }

  async function searchAll(query: SearchQuery): Promise<GroupedResults> {
    const keyword = query.keyword.trim()

    const [records, actions, pages] = await Promise.all([
      searchRecords(query),
      Promise.resolve(searchActions(keyword)),
      Promise.resolve(searchPages(keyword)),
    ])

    const filteredRecords = keyword
      ? filterRecordsByKeyword(records, keyword)
      : records

    return {
      records: filteredRecords,
      pages,
      actions,
    }
  }

  function getRecentResults(): CommandResult[] {
    return recentItems.value.map((item) => item.data)
  }

  return {
    isLoading,
    error,
    recentItems,
    searchRecords,
    searchAll,
    addToRecent,
    clearRecent,
    getRecentResults,
    transformAssetRecord,
    transformTransactionRecord,
  }
}

function fuzzyMatch(text: string, keyword: string): boolean {
  if (!keyword) return true
  if (text.includes(keyword)) return true

  let keywordIndex = 0
  for (let i = 0; i < text.length && keywordIndex < keyword.length; i++) {
    if (text[i] === keyword[keywordIndex]) {
      keywordIndex++
    }
  }
  return keywordIndex === keyword.length
}

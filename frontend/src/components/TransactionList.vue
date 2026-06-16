<template>
  <div class="transaction-list">
    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span>交易流水</span>
            <el-tag v-if="pagination.total > 0" type="info">共 {{ pagination.total }} 条</el-tag>
          </div>
          <div class="header-right">
            <el-input
              v-model="filters.keyword"
              placeholder="搜索对手方或备注"
              :prefix-icon="Search"
              clearable
              style="width: 200px; margin-right: 12px"
              @change="handleSearch"
              @clear="handleSearch"
            />
            <el-select
              v-model="filters.direction"
              placeholder="交易方向"
              clearable
              style="width: 120px; margin-right: 12px"
              @change="handleSearch"
            >
              <el-option label="收入" value="INCOME" />
              <el-option label="支出" value="EXPENSE" />
              <el-option label="转移" value="TRANSFER" />
            </el-select>
            <el-select
              v-model="filters.category"
              placeholder="资产类别"
              clearable
              style="width: 120px; margin-right: 12px"
              @change="handleSearch"
            >
              <el-option label="活钱" value="CASH" />
              <el-option label="长期投资" value="LONG_TERM_INVEST" />
              <el-option label="稳定债券" value="STABLE_BOND" />
            </el-select>
            <el-date-picker
              v-model="filters.dateRange"
              type="monthrange"
              range-separator="至"
              start-placeholder="开始月份"
              end-placeholder="结束月份"
              value-format="YYYY-MM-DD"
              style="width: 260px"
              @change="handleDateChange"
            />
          </div>
        </div>
      </template>

      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="5" animated />
      </div>

      <div v-else-if="transactions.length === 0" class="empty-state">
        <el-empty description="暂无交易记录">
          <el-button type="primary" @click="$emit('fill-demo')">填充示例数据</el-button>
        </el-empty>
      </div>

      <template v-else>
        <el-table
          :data="transactions"
          style="width: 100%"
          stripe
          border
          :default-sort="{ prop: 'date', order: 'descending' }"
        >
          <el-table-column prop="date" label="日期" width="120" sortable />

          <el-table-column label="方向" width="100">
            <template #default="{ row }">
              <el-tag :type="getDirectionTagType(row.direction)" size="small">
                {{ getDirectionLabel(row.direction) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="金额" width="140" align="right">
            <template #default="{ row }">
              <span :class="['money', getAmountClass(row.direction)]">
                {{ getAmountPrefix(row.direction) }}{{ formatMoney(row.amount) }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="资产类别" width="120">
            <template #default="{ row }">
              <el-tag :type="getCategoryTagType(row.category)" size="small" effect="plain">
                {{ getCategoryLabel(row.category) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="counterparty" label="对手方/分类" min-width="140" show-overflow-tooltip />

          <el-table-column prop="note" label="备注" min-width="180" show-overflow-tooltip />

          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                link
                :icon="Edit"
                @click="$emit('edit', row)"
              >编辑</el-button>
              <el-button
                type="danger"
                size="small"
                link
                :icon="Delete"
                @click="handleDelete(row)"
              >删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="pagination.total"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handlePageChange"
            @current-change="handlePageChange"
          />
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { Search, Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Transaction, Pagination, TransactionDirection, AssetCategory } from '../types'

interface Props {
  transactions: Transaction[]
  pagination: Pagination
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  delete: [id: string]
  edit: [transaction: Transaction]
  'fill-demo': []
  search: [filters: any]
  'page-change': [page: number, pageSize: number]
}>()

const filters = reactive({
  keyword: '',
  direction: '' as TransactionDirection | '',
  category: '' as AssetCategory | '',
  dateRange: [] as string[]
})

const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(value)
}

const getDirectionLabel = (direction: TransactionDirection): string => {
  const map: Record<TransactionDirection, string> = {
    INCOME: '收入',
    EXPENSE: '支出',
    TRANSFER: '转移'
  }
  return map[direction]
}

const getDirectionTagType = (direction: TransactionDirection): string => {
  const map: Record<TransactionDirection, string> = {
    INCOME: 'success',
    EXPENSE: 'danger',
    TRANSFER: 'warning'
  }
  return map[direction]
}

const getCategoryLabel = (category: AssetCategory): string => {
  const map: Record<AssetCategory, string> = {
    CASH: '活钱',
    LONG_TERM_INVEST: '长期投资',
    STABLE_BOND: '稳定债券'
  }
  return map[category]
}

const getCategoryTagType = (category: AssetCategory): string => {
  const map: Record<AssetCategory, string> = {
    CASH: 'success',
    LONG_TERM_INVEST: 'warning',
    STABLE_BOND: 'primary'
  }
  return map[category]
}

const getAmountPrefix = (direction: TransactionDirection): string => {
  if (direction === 'INCOME') return '+'
  if (direction === 'EXPENSE') return '-'
  return ''
}

const getAmountClass = (direction: TransactionDirection): string => {
  const map: Record<TransactionDirection, string> = {
    INCOME: 'income',
    EXPENSE: 'expense',
    TRANSFER: 'transfer'
  }
  return map[direction]
}

const handleSearch = () => {
  emit('search', { ...filters })
}

const handleDateChange = (val: string[] | null) => {
  if (val && val.length === 2) {
    filters.dateRange = val
  } else {
    filters.dateRange = []
  }
  handleSearch()
}

const handlePageChange = () => {
  emit('page-change', filters.keyword ? 1 : undefined, undefined)
}

const handleDelete = (row: Transaction) => {
  ElMessageBox.confirm(
    `确定要删除 ${row.date} 的这条交易记录吗？此操作会影响统计数据。`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      emit('delete', row.id)
    })
    .catch(() => {})
}
</script>

<style scoped>
.transaction-list {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.empty-state,
.loading-state {
  padding: 40px 0;
}

.money {
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.income {
  color: #67c23a;
}

.expense {
  color: #f56c6c;
}

.transfer {
  color: #e6a23c;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .header-right {
    width: 100%;
  }

  .header-right > * {
    flex: 1;
    min-width: 140px;
  }
}
</style>

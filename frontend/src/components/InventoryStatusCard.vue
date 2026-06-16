<template>
  <el-card class="inventory-status-card" :class="cardClass" shadow="hover">
    <div class="status-header">
      <div class="status-icon-wrap" :class="iconClass">
        <el-icon :size="28"><component :is="statusIcon" /></el-icon>
      </div>
      <div class="status-title-wrap">
        <h3 class="status-title">{{ statusTitle }}</h3>
        <p class="status-subtitle" v-if="status?.cycleDescription">
          盘点周期：{{ status.cycleDescription }}
        </p>
        <p class="status-subtitle no-plan" v-else>
          尚未设置盘点计划
        </p>
      </div>
    </div>

    <div class="status-body" v-if="status?.hasPlan">
      <div class="countdown-row" :class="{ overdue: status.isOverdue, today: status.daysUntilNext === 0 }">
        <div class="countdown-number" v-if="status.isOverdue">
          {{ status.overdueDays }}
          <span class="countdown-unit">天逾期</span>
        </div>
        <div class="countdown-number" v-else-if="status.daysUntilNext === 0">
          <span class="countdown-unit">今日盘点</span>
        </div>
        <div class="countdown-number" v-else-if="status.daysUntilNext !== null">
          {{ status.daysUntilNext }}
          <span class="countdown-unit">天后到期</span>
        </div>
        <div class="countdown-number" v-else>
          <el-icon class="loading-icon"><Loading /></el-icon>
          <span class="countdown-unit">计算中</span>
        </div>
      </div>

      <div class="next-date-row" v-if="status.nextInventoryDate">
        <el-icon><Calendar /></el-icon>
        <span>下次盘点：{{ formatDate(status.nextInventoryDate) }}</span>
        <el-tag v-if="status.adjustedForHoliday" size="small" type="warning" effect="light" class="adjust-tag">
          已顺延节假日
        </el-tag>
      </div>

      <div class="last-date-row" v-if="lastInventoryDateStr">
        <el-icon><Clock /></el-icon>
        <span>上次盘点：{{ lastInventoryDateStr }}</span>
      </div>

      <div class="never-inventory" v-else>
        <el-icon><Warning /></el-icon>
        <span>尚未进行过任何盘点，请尽快完成首次盘点</span>
      </div>
    </div>

    <div class="status-body no-plan-body" v-else>
      <p class="hint-text">
        定期盘点资产有助于掌握财务状况。设置盘点计划后，系统将在到期前自动提醒您。
      </p>
    </div>

    <div class="status-footer">
      <slot name="actions">
        <el-button
          v-if="status?.hasPlan"
          type="primary"
          plain
          size="small"
          :icon="Edit"
          @click="$emit('edit')"
        >
          修改计划
        </el-button>
        <el-button
          v-else
          type="primary"
          size="small"
          :icon="Plus"
          @click="$emit('edit')"
        >
          立即设置
        </el-button>
        <el-button
          v-if="status?.hasPlan"
          size="small"
          plain
          :icon="Refresh"
          @click="$emit('refresh')"
        >
          刷新状态
        </el-button>
        <el-button
          v-if="status?.hasPlan && !lastInventoryDateStr"
          size="small"
          plain
          type="success"
          :icon="Upload"
          @click="$emit('sync-last')"
        >
          同步盘点日期
        </el-button>
      </slot>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  WarningFilled,
  BellFilled,
  Calendar,
  CircleCheck,
  Edit,
  Plus,
  Refresh,
  Clock,
  Warning,
  Loading,
  Upload,
} from '@element-plus/icons-vue'
import type { InventoryStatus, InventoryPlan } from '../types'

const props = defineProps<{
  status: InventoryStatus | null
  plan?: InventoryPlan | null
  loading?: boolean
}>()

defineEmits<{
  (e: 'edit'): void
  (e: 'refresh'): void
  (e: 'sync-last'): void
}>()

const lastInventoryDateStr = computed(() => {
  if (props.plan?.lastInventoryDate) {
    return formatDate(props.plan.lastInventoryDate)
  }
  return ''
})

const cardClass = computed(() => ({
  'status-overdue': props.status?.isOverdue,
  'status-reminder': props.status?.reminderDue && !props.status?.isOverdue,
  'status-normal': !props.status?.isOverdue && !props.status?.reminderDue,
  'status-no-plan': !props.status?.hasPlan,
}))

const iconClass = computed(() => {
  if (!props.status?.hasPlan) return 'icon-no-plan'
  if (props.status.isOverdue) return 'icon-overdue'
  if (props.status.reminderDue) return 'icon-reminder'
  return 'icon-normal'
})

const statusIcon = computed(() => {
  if (!props.status?.hasPlan) return Warning
  if (props.status.isOverdue) return WarningFilled
  if (props.status.reminderDue) return BellFilled
  return CircleCheck
})

const statusTitle = computed(() => {
  if (props.loading) return '加载中...'
  if (!props.status?.hasPlan) return '未设置盘点计划'
  if (props.status.isOverdue) return '盘点已逾期'
  if (props.status.daysUntilNext === 0) return '今日需要盘点'
  if (props.status.reminderDue) return '盘点即将到期'
  return '盘点计划运行中'
})

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${year}-${month}-${day} ${WEEKDAY[d.getDay()]}`
  } catch {
    return isoStr
  }
}
</script>

<style scoped>
.inventory-status-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.inventory-status-card.status-overdue {
  border: 1px solid #fef0f0;
  background: linear-gradient(135deg, #fff5f5 0%, #ffeded 100%);
}

.inventory-status-card.status-overdue:hover {
  box-shadow: 0 8px 24px rgba(245, 108, 108, 0.15);
}

.inventory-status-card.status-reminder {
  border: 1px solid #faecd8;
  background: linear-gradient(135deg, #fff9f0 0%, #fff3e0 100%);
}

.inventory-status-card.status-reminder:hover {
  box-shadow: 0 8px 24px rgba(230, 162, 60, 0.15);
}

.inventory-status-card.status-normal {
  border: 1px solid #e4e7ed;
  background: linear-gradient(135deg, #f5f7fa 0%, #ecf0f3 100%);
}

.inventory-status-card.status-no-plan {
  border: 1px dashed #c0c4cc;
  background: linear-gradient(135deg, #fafafa 0%, #f4f4f5 100%);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.status-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-overdue {
  background: linear-gradient(135deg, #f56c6c, #f78989);
  color: white;
}

.icon-reminder {
  background: linear-gradient(135deg, #e6a23c, #f0c78a);
  color: white;
}

.icon-normal {
  background: linear-gradient(135deg, #409eff, #66b1ff);
  color: white;
}

.icon-no-plan {
  background: linear-gradient(135deg, #909399, #b1b3b8);
  color: white;
}

.status-title-wrap {
  flex: 1;
  min-width: 0;
}

.status-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #303133;
}

.status-overdue .status-title {
  color: #f56c6c;
}

.status-reminder .status-title {
  color: #e6a23c;
}

.status-no-plan .status-title {
  color: #909399;
}

.status-subtitle {
  font-size: 13px;
  color: #606266;
  margin: 0;
}

.status-subtitle.no-plan {
  color: #909399;
}

.status-body {
  padding: 14px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 14px;
}

.no-plan-body {
  padding: 20px 0;
}

.hint-text {
  color: #909399;
  font-size: 13px;
  line-height: 1.7;
  margin: 0;
}

.countdown-row {
  text-align: center;
  margin-bottom: 14px;
  padding: 10px 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
}

.countdown-row.overdue {
  background: rgba(245, 108, 108, 0.08);
}

.countdown-row.today {
  background: rgba(230, 162, 60, 0.1);
}

.countdown-number {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.2;
  color: #303133;
}

.countdown-row.overdue .countdown-number {
  color: #f56c6c;
}

.countdown-row.today .countdown-number {
  color: #e6a23c;
}

.countdown-unit {
  font-size: 14px;
  font-weight: 500;
  margin-left: 4px;
}

.loading-icon {
  animation: spin 1s linear infinite;
  vertical-align: middle;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.next-date-row,
.last-date-row,
.never-inventory {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
  margin-top: 8px;
}

.never-inventory {
  color: #e6a23c;
  font-weight: 500;
}

.adjust-tag {
  margin-left: auto;
}

.status-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .countdown-number {
    font-size: 28px;
  }

  .status-title {
    font-size: 16px;
  }

  .status-footer {
    justify-content: stretch;
  }

  .status-footer .el-button {
    flex: 1;
  }
}
</style>

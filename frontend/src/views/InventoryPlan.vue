<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <WalletFilled style="font-size: 32px; color: #409eff;" />
          <div class="title">
            <h1>盘点计划设置</h1>
            <p>配置资产盘点周期与提醒规则</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button :icon="ArrowLeft" plain @click="goBack">
            返回首页
          </el-button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <el-row :gutter="24">
        <el-col :xs="24" :md="10">
          <InventoryStatusCard
            :status="status"
            :plan="plan"
            :loading="loading"
            @edit="focusForm"
            @refresh="refreshPlan"
            @sync-last="handleSyncLast"
          />
        </el-col>

        <el-col :xs="24" :md="14">
          <el-card class="form-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon :size="20" color="#409eff"><Setting /></el-icon>
                <span>{{ plan ? '修改盘点计划' : '创建盘点计划' }}</span>
              </div>
            </template>

            <el-form
              ref="formRef"
              :model="form"
              :rules="formRules"
              label-width="130px"
              label-position="right"
              @change="handleFormChange"
            >
              <el-form-item label="盘点周期" prop="cycleType">
                <el-radio-group v-model="form.cycleType" class="cycle-radio-group">
                  <el-radio-button value="WEEKLY">
                    <el-icon><Calendar /></el-icon>
                    <span>每周</span>
                  </el-radio-button>
                  <el-radio-button value="MONTHLY">
                    <el-icon><Date /></el-icon>
                    <span>每月</span>
                  </el-radio-button>
                  <el-radio-button value="CUSTOM">
                    <el-icon><Edit /></el-icon>
                    <span>自定义</span>
                  </el-radio-button>
                </el-radio-group>
              </el-form-item>

              <el-form-item
                v-if="form.cycleType === 'WEEKLY'"
                label="每周盘点日"
                prop="weeklyDayOfWeek"
              >
                <el-select v-model="form.weeklyDayOfWeek" placeholder="请选择每周的盘点日" style="width: 100%">
                  <el-option :value="0" label="每周日" />
                  <el-option :value="1" label="每周一" />
                  <el-option :value="2" label="每周二" />
                  <el-option :value="3" label="每周三" />
                  <el-option :value="4" label="每周四" />
                  <el-option :value="5" label="每周五" />
                  <el-option :value="6" label="每周六" />
                </el-select>
              </el-form-item>

              <el-form-item
                v-if="form.cycleType === 'MONTHLY'"
                label="每月盘点日"
                prop="monthlyDayOfMonth"
              >
                <el-input-number
                  v-model="form.monthlyDayOfMonth"
                  :min="1"
                  :max="31"
                  :step="1"
                  style="width: 100%"
                  controls-position="right"
                />
                <div class="form-tip">
                  <el-icon><InfoFilled /></el-icon>
                  如当月无此日期，将自动调整为当月最后一天
                </div>
              </el-form-item>

              <el-form-item
                v-if="form.cycleType === 'CUSTOM'"
                label="间隔天数"
                prop="customIntervalDays"
              >
                <el-input-number
                  v-model="form.customIntervalDays"
                  :min="1"
                  :max="365"
                  :step="1"
                  style="width: 100%"
                  controls-position="right"
                />
                <div class="form-tip">
                  <el-icon><InfoFilled /></el-icon>
                  距上次盘点多少天后进行下一次盘点
                </div>
              </el-form-item>

              <el-divider content-position="left">提醒设置</el-divider>

              <el-form-item label="开启提醒">
                <el-switch v-model="form.reminderEnabled" />
                <span class="switch-label">{{ form.reminderEnabled ? '已开启到期提醒' : '已关闭提醒' }}</span>
              </el-form-item>

              <el-form-item
                v-if="form.reminderEnabled"
                label="提前提醒天数"
                prop="reminderDaysBefore"
              >
                <el-slider
                  v-model="form.reminderDaysBefore"
                  :min="0"
                  :max="14"
                  :step="1"
                  show-input
                  :marks="reminderMarks"
                />
                <div class="form-tip">
                  <el-icon><InfoFilled /></el-icon>
                  将在到期前 {{ form.reminderDaysBefore }} 天开始发送站内提醒
                </div>
              </el-form-item>

              <el-divider content-position="left">高级设置</el-divider>

              <el-form-item label="节假日顺延">
                <el-switch v-model="form.skipHolidays" />
                <span class="switch-label">
                  {{ form.skipHolidays ? '盘点日如遇周末或节假日，自动顺延至下一个工作日' : '不进行顺延' }}
                </span>
              </el-form-item>

              <el-form-item label="最近盘点日期">
                <el-date-picker
                  v-model="form.lastInventoryDate"
                  type="date"
                  placeholder="选择最近一次盘点的日期"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  :disabled-date="disabledFutureDate"
                  style="width: 100%"
                  clearable
                />
                <div class="form-tip">
                  <el-icon><InfoFilled /></el-icon>
                  可选：如您已进行过盘点，可在此设置上次盘点日期，系统将据此计算下次盘点
                </div>
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  :loading="saving"
                  :icon="Check"
                  size="large"
                  @click="handleSubmit"
                >
                  {{ plan ? '保存修改' : '创建计划' }}
                </el-button>
                <el-button
                  plain
                  :icon="Refresh"
                  size="large"
                  @click="resetForm"
                >
                  重置
                </el-button>
                <el-button
                  v-if="!hasEverInventory"
                  type="success"
                  plain
                  :icon="Upload"
                  size="large"
                  @click="handleSyncLast"
                >
                  从资产记录同步
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>

          <el-card v-if="previewStatus" class="preview-card" shadow="never">
            <template #header>
              <div class="card-header">
                <el-icon :size="18" color="#67c23a"><View /></el-icon>
                <span>实时预览</span>
              </div>
            </template>

            <div class="preview-content">
              <div class="preview-item">
                <span class="preview-label">下次盘点日期</span>
                <span class="preview-value">
                  {{ previewStatus.nextInventoryDate ? formatDate(previewStatus.nextInventoryDate) : '-' }}
                  <el-tag
                    v-if="previewStatus.adjustedForHoliday"
                    size="small"
                    type="warning"
                    effect="light"
                    style="margin-left: 6px;"
                  >
                    已顺延
                  </el-tag>
                </span>
              </div>
              <div class="preview-item">
                <span class="preview-label">距离下次盘点</span>
                <span
                  class="preview-value"
                  :class="{
                    'text-danger': previewStatus.isOverdue,
                    'text-warning': previewStatus.reminderDue && !previewStatus.isOverdue,
                    'text-success': !previewStatus.isOverdue && !previewStatus.reminderDue,
                  }"
                >
                  <template v-if="previewStatus.isOverdue">
                    已逾期 {{ previewStatus.overdueDays }} 天
                  </template>
                  <template v-else-if="previewStatus.daysUntilNext === 0">
                    今日到期
                  </template>
                  <template v-else-if="previewStatus.daysUntilNext !== null">
                    {{ previewStatus.daysUntilNext }} 天后
                  </template>
                  <template v-else>-</template>
                </span>
              </div>
              <div class="preview-item">
                <span class="preview-label">周期说明</span>
                <span class="preview-value">{{ previewStatus.cycleDescription || '-' }}</span>
              </div>
              <div class="preview-item">
                <span class="preview-label">提醒状态</span>
                <el-tag
                  :type="previewStatus.isOverdue ? 'danger' : previewStatus.reminderDue ? 'warning' : 'info'"
                  effect="light"
                  size="small"
                >
                  {{ previewStatus.isOverdue ? '需要发送逾期提醒' : previewStatus.reminderDue ? '即将发送提醒' : '暂不提醒' }}
                </el-tag>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  WalletFilled,
  ArrowLeft,
  Calendar,
  Date as DateIcon,
  Edit,
  Setting,
  Check,
  Refresh,
  InfoFilled,
  View,
  Upload,
} from '@element-plus/icons-vue'
import { useInventoryPlans } from '../composables/useInventoryPlans'
import InventoryStatusCard from '../components/InventoryStatusCard.vue'
import type { InventoryCycleType, InventoryStatus } from '../types'

const router = useRouter()
const { plan, status, loading, error, fetchPlan, createPlan, updatePlan, syncLastInventory, preview } = useInventoryPlans()

const formRef = ref<FormInstance>()
const saving = ref(false)
const previewStatus = ref<InventoryStatus | null>(null)
const previewing = ref(false)

const hasEverInventory = computed(() => status.value?.hasEverInventory ?? false)

const reminderMarks = {
  0: '当天',
  3: '3天',
  7: '7天',
  14: '14天',
}

const form = reactive({
  cycleType: 'MONTHLY' as InventoryCycleType,
  weeklyDayOfWeek: 0 as number | undefined,
  monthlyDayOfMonth: 1 as number | undefined,
  customIntervalDays: 30 as number | undefined,
  reminderEnabled: true,
  reminderDaysBefore: 3,
  skipHolidays: false,
  lastInventoryDate: '' as string | undefined,
})

const formRules: FormRules = {
  cycleType: [
    { required: true, message: '请选择盘点周期', trigger: 'change' },
  ],
  weeklyDayOfWeek: [
    {
      required: true,
      message: '请选择每周盘点日',
      trigger: 'change',
      validator: (_r: any, value: any, cb: any) => {
        if (form.cycleType === 'WEEKLY' && (value === undefined || value === null)) {
          return cb(new Error('请选择每周盘点日'))
        }
        cb()
      },
    },
  ],
  monthlyDayOfMonth: [
    {
      required: true,
      message: '请输入每月盘点日',
      trigger: 'blur',
      validator: (_r: any, value: any, cb: any) => {
        if (form.cycleType === 'MONTHLY' && (value === undefined || value === null)) {
          return cb(new Error('请输入每月盘点日'))
        }
        if (form.cycleType === 'MONTHLY' && (value < 1 || value > 31)) {
          return cb(new Error('日期必须在 1-31 之间'))
        }
        cb()
      },
    },
  ],
  customIntervalDays: [
    {
      required: true,
      message: '请输入间隔天数',
      trigger: 'blur',
      validator: (_r: any, value: any, cb: any) => {
        if (form.cycleType === 'CUSTOM' && (value === undefined || value === null)) {
          return cb(new Error('请输入间隔天数'))
        }
        if (form.cycleType === 'CUSTOM' && (value < 1 || value > 365)) {
          return cb(new Error('间隔天数必须在 1-365 之间'))
        }
        cb()
      },
    },
  ],
}

function disabledFutureDate(date: Date) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date.getTime() > today.getTime()
}

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

async function refreshPlan() {
  try {
    await fetchPlan()
    syncFormFromPlan()
    ElMessage.success('已刷新最新状态')
  } catch (err: any) {
    ElMessage.error(error.value || err.message || '刷新失败')
  }
}

function syncFormFromPlan() {
  if (plan.value) {
    form.cycleType = plan.value.cycleType
    form.weeklyDayOfWeek = plan.value.weeklyDayOfWeek ?? undefined
    form.monthlyDayOfMonth = plan.value.monthlyDayOfMonth ?? undefined
    form.customIntervalDays = plan.value.customIntervalDays ?? undefined
    form.reminderEnabled = plan.value.reminderEnabled
    form.reminderDaysBefore = plan.value.reminderDaysBefore
    form.skipHolidays = plan.value.skipHolidays
    form.lastInventoryDate = plan.value.lastInventoryDate
      ? new Date(plan.value.lastInventoryDate).toISOString().slice(0, 10)
      : undefined
  } else {
    form.cycleType = 'MONTHLY'
    form.weeklyDayOfWeek = 0
    form.monthlyDayOfMonth = 1
    form.customIntervalDays = 30
    form.reminderEnabled = true
    form.reminderDaysBefore = 3
    form.skipHolidays = false
    form.lastInventoryDate = undefined
  }
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    ElMessage.warning('请正确填写表单')
    return
  }

  saving.value = true
  try {
    const payload: any = {
      cycleType: form.cycleType,
      reminderDaysBefore: form.reminderDaysBefore,
      reminderEnabled: form.reminderEnabled,
      skipHolidays: form.skipHolidays,
      lastInventoryDate: form.lastInventoryDate || null,
    }

    if (form.cycleType === 'WEEKLY') {
      payload.weeklyDayOfWeek = form.weeklyDayOfWeek
    } else if (form.cycleType === 'MONTHLY') {
      payload.monthlyDayOfMonth = form.monthlyDayOfMonth
    } else if (form.cycleType === 'CUSTOM') {
      payload.customIntervalDays = form.customIntervalDays
    }

    if (plan.value) {
      await updatePlan(payload)
      ElMessage.success('盘点计划已更新')
    } else {
      await createPlan(payload)
      ElMessage.success('盘点计划已创建')
    }
  } catch (err: any) {
    ElMessage.error(error.value || err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function resetForm() {
  syncFormFromPlan()
  formRef.value?.clearValidate()
  previewStatus.value = status.value
}

async function handleSyncLast() {
  try {
    await ElMessageBox.confirm(
      '将从您的资产记录中自动获取最新一条记录的日期作为最近盘点日期，是否继续？',
      '同步盘点日期',
      { confirmButtonText: '确认同步', cancelButtonText: '取消', type: 'info' }
    )
    await syncLastInventory()
    syncFormFromPlan()
    ElMessage.success('已同步最新盘点日期')
  } catch {
  }
}

async function updatePreview() {
  if (previewing.value) return
  previewing.value = true

  try {
    const params: any = {
      cycleType: form.cycleType,
      skipHolidays: form.skipHolidays,
    }
    if (form.cycleType === 'WEEKLY' && form.weeklyDayOfWeek !== undefined) {
      params.weeklyDayOfWeek = form.weeklyDayOfWeek
    }
    if (form.cycleType === 'MONTHLY' && form.monthlyDayOfMonth !== undefined) {
      params.monthlyDayOfMonth = form.monthlyDayOfMonth
    }
    if (form.cycleType === 'CUSTOM' && form.customIntervalDays !== undefined) {
      params.customIntervalDays = form.customIntervalDays
    }
    if (form.lastInventoryDate) {
      params.lastInventoryDate = form.lastInventoryDate
    }

    previewStatus.value = await preview(params)
  } catch (e) {
  } finally {
    previewing.value = false
  }
}

let previewTimer: any = null

function handleFormChange() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(updatePreview, 300)
}

function focusForm() {
  nextTick(() => {
    formRef.value?.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function goBack() {
  router.push('/')
}

watch(
  () => [form.cycleType],
  () => {
    if (form.cycleType === 'WEEKLY' && form.weeklyDayOfWeek === undefined) {
      form.weeklyDayOfWeek = 0
    }
    if (form.cycleType === 'MONTHLY' && form.monthlyDayOfMonth === undefined) {
      form.monthlyDayOfMonth = 1
    }
    if (form.cycleType === 'CUSTOM' && form.customIntervalDays === undefined) {
      form.customIntervalDays = 30
    }
  }
)

onMounted(async () => {
  await fetchPlan({ orCreate: false })
  syncFormFromPlan()
  previewStatus.value = status.value
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.title p {
  font-size: 14px;
  opacity: 0.9;
  margin: 4px 0 0 0;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px;
}

.form-card,
.preview-card {
  margin-bottom: 24px;
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.cycle-radio-group {
  width: 100%;
}

.cycle-radio-group :deep(.el-radio-button__inner) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px;
}

.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}

.switch-label {
  margin-left: 10px;
  font-size: 14px;
  color: #606266;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.preview-label {
  font-size: 13px;
  color: #909399;
  font-weight: 500;
}

.preview-value {
  font-size: 14px;
  color: #303133;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.text-danger {
  color: #f56c6c !important;
}

.text-warning {
  color: #e6a23c !important;
}

.text-success {
  color: #67c23a !important;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .logo {
    flex-direction: column;
  }

  .main-content {
    padding: 16px 12px;
  }
}
</style>

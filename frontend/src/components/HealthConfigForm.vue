<template>
  <div class="health-config-form">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="180px"
      @submit.prevent="handleSubmit"
    >
      <el-card class="config-section">
        <template #header>
          <div class="section-header">
            <el-icon><Setting /></el-icon>
            <span>基础配置</span>
          </div>
        </template>

        <el-form-item label="月支出金额" prop="monthlyExpense">
          <el-input-number
            v-model="formData.monthlyExpense"
            :min="0"
            :precision="2"
            :step="100"
            controls-position="right"
            style="width: 200px"
          />
          <span class="form-tip">用于计算应急储备充足度（活钱/月支出）</span>
        </el-form-item>

        <el-form-item label="最低应急储备月数" prop="minEmergencyReserveMonths">
          <el-input-number
            v-model="formData.minEmergencyReserveMonths"
            :min="1"
            :max="12"
            controls-position="right"
            style="width: 150px"
          />
          <span class="form-tip">低于此月数将获得较低评分</span>
        </el-form-item>

        <el-form-item label="理想应急储备月数" prop="idealEmergencyReserveMonths">
          <el-input-number
            v-model="formData.idealEmergencyReserveMonths"
            :min="1"
            :max="24"
            controls-position="right"
            style="width: 150px"
          />
          <span class="form-tip">达到此月数可获得满分</span>
        </el-form-item>

        <el-form-item label="波动率窗口" prop="volatilityWindowMonths">
          <el-input-number
            v-model="formData.volatilityWindowMonths"
            :min="3"
            :max="24"
            controls-position="right"
            style="width: 150px"
          />
          <span class="form-tip">用于计算增长稳定性的历史月数</span>
        </el-form-item>
      </el-card>

      <el-card class="config-section">
        <template #header>
          <div class="section-header">
            <el-icon><PieChart /></el-icon>
            <span>目标资产配置</span>
            <span class="ratio-sum" :class="{ 'error': !isRatioValid }">
              合计: {{ totalRatioPercent }}%
            </span>
          </div>
        </template>

        <el-form-item label="现金占比目标" prop="targetCashRatio">
          <el-slider
            v-model="formData.targetCashRatio"
            :min="0"
            :max="1"
            :step="0.05"
            :show-tooltip="true"
            :format-tooltip="formatPercent"
            style="width: 300px"
          />
          <span class="ratio-value">{{ formatPercent(formData.targetCashRatio) }}</span>
        </el-form-item>

        <el-form-item label="长期投资占比目标" prop="targetLongTermInvestRatio">
          <el-slider
            v-model="formData.targetLongTermInvestRatio"
            :min="0"
            :max="1"
            :step="0.05"
            :show-tooltip="true"
            :format-tooltip="formatPercent"
            style="width: 300px"
          />
          <span class="ratio-value">{{ formatPercent(formData.targetLongTermInvestRatio) }}</span>
        </el-form-item>

        <el-form-item label="稳健债券占比目标" prop="targetStableBondRatio">
          <el-slider
            v-model="formData.targetStableBondRatio"
            :min="0"
            :max="1"
            :step="0.05"
            :show-tooltip="true"
            :format-tooltip="formatPercent"
            style="width: 300px"
          />
          <span class="ratio-value">{{ formatPercent(formData.targetStableBondRatio) }}</span>
        </el-form-item>

        <el-alert
          v-if="!isRatioValid"
          type="warning"
          :closable="false"
          show-icon
          title="配置比例之和必须等于100%"
        />
      </el-card>

      <el-card class="config-section">
        <template #header>
          <div class="section-header">
            <el-icon><Histogram /></el-icon>
            <span>维度权重设置</span>
            <span class="weight-sum">
              合计: {{ totalWeightPercent }}%
              <el-button type="primary" link size="small" @click="normalizeWeights">
                自动归一化
              </el-button>
            </span>
          </div>
        </template>

        <el-form-item label="应急储备权重" prop="emergencyReserveWeight">
          <el-slider
            v-model="formData.emergencyReserveWeight"
            :min="0"
            :max="1"
            :step="0.05"
            :show-tooltip="true"
            :format-tooltip="formatPercent"
            style="width: 300px"
          />
          <span class="ratio-value">{{ formatPercent(formData.emergencyReserveWeight) }}</span>
        </el-form-item>

        <el-form-item label="资产配置权重" prop="assetAllocationWeight">
          <el-slider
            v-model="formData.assetAllocationWeight"
            :min="0"
            :max="1"
            :step="0.05"
            :show-tooltip="true"
            :format-tooltip="formatPercent"
            style="width: 300px"
          />
          <span class="ratio-value">{{ formatPercent(formData.assetAllocationWeight) }}</span>
        </el-form-item>

        <el-form-item label="增长稳定性权重" prop="growthStabilityWeight">
          <el-slider
            v-model="formData.growthStabilityWeight"
            :min="0"
            :max="1"
            :step="0.05"
            :show-tooltip="true"
            :format-tooltip="formatPercent"
            style="width: 300px"
          />
          <span class="ratio-value">{{ formatPercent(formData.growthStabilityWeight) }}</span>
        </el-form-item>

        <el-form-item label="盘点及时性权重" prop="inventoryTimelinessWeight">
          <el-slider
            v-model="formData.inventoryTimelinessWeight"
            :min="0"
            :max="1"
            :step="0.05"
            :show-tooltip="true"
            :format-tooltip="formatPercent"
            style="width: 300px"
          />
          <span class="ratio-value">{{ formatPercent(formData.inventoryTimelinessWeight) }}</span>
        </el-form-item>

        <el-alert
          v-if="Math.abs(totalWeight - 1) > 0.01"
          type="info"
          :closable="false"
          show-icon
          title="权重已自动归一化，保存时将按比例调整"
        />
      </el-card>

      <div class="form-actions">
        <el-button @click="handleReset">恢复默认</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          保存配置
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Setting, PieChart, Histogram } from '@element-plus/icons-vue'
import type { HealthConfigForm, HealthConfig } from '../types'

const props = defineProps<{
  config: HealthConfig | null
  defaultConfig?: HealthConfigForm | null
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: HealthConfigForm]
  reset: []
}>()

const formRef = ref<FormInstance>()

const formData = reactive<HealthConfigForm>({
  monthlyExpense: 5000,
  targetCashRatio: 0.3,
  targetLongTermInvestRatio: 0.5,
  targetStableBondRatio: 0.2,
  emergencyReserveWeight: 0.3,
  assetAllocationWeight: 0.3,
  growthStabilityWeight: 0.25,
  inventoryTimelinessWeight: 0.15,
  volatilityWindowMonths: 6,
  minEmergencyReserveMonths: 3,
  idealEmergencyReserveMonths: 6,
})

const rules: FormRules = {
  monthlyExpense: [
    { required: true, message: '请输入月支出金额', trigger: 'blur' },
    { type: 'number', min: 0, message: '月支出不能为负数', trigger: 'blur' },
  ],
  minEmergencyReserveMonths: [
    { required: true, message: '请输入最低应急储备月数', trigger: 'blur' },
    { type: 'number', min: 1, max: 12, message: '月数必须在1-12之间', trigger: 'blur' },
  ],
  idealEmergencyReserveMonths: [
    { required: true, message: '请输入理想应急储备月数', trigger: 'blur' },
    { type: 'number', min: 1, max: 24, message: '月数必须在1-24之间', trigger: 'blur' },
  ],
  volatilityWindowMonths: [
    { required: true, message: '请输入波动率窗口', trigger: 'blur' },
    { type: 'number', min: 3, max: 24, message: '窗口必须在3-24个月之间', trigger: 'blur' },
  ],
}

const totalRatio = computed(
  () =>
    formData.targetCashRatio +
    formData.targetLongTermInvestRatio +
    formData.targetStableBondRatio
)

const totalRatioPercent = computed(() => (totalRatio.value * 100).toFixed(0))

const isRatioValid = computed(() => Math.abs(totalRatio.value - 1) < 0.001)

const totalWeight = computed(
  () =>
    formData.emergencyReserveWeight +
    formData.assetAllocationWeight +
    formData.growthStabilityWeight +
    formData.inventoryTimelinessWeight
)

const totalWeightPercent = computed(() => (totalWeight.value * 100).toFixed(0))

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`
}

function normalizeWeights() {
  const total = totalWeight.value
  if (total <= 0) {
    ElMessage.warning('权重之和不能为0')
    return
  }
  formData.emergencyReserveWeight = formData.emergencyReserveWeight / total
  formData.assetAllocationWeight = formData.assetAllocationWeight / total
  formData.growthStabilityWeight = formData.growthStabilityWeight / total
  formData.inventoryTimelinessWeight = formData.inventoryTimelinessWeight / total
  ElMessage.success('权重已归一化')
}

function loadConfig(config: HealthConfig | HealthConfigForm) {
  formData.monthlyExpense = Number(config.monthlyExpense)
  formData.targetCashRatio = Number(config.targetCashRatio)
  formData.targetLongTermInvestRatio = Number(config.targetLongTermInvestRatio)
  formData.targetStableBondRatio = Number(config.targetStableBondRatio)
  formData.emergencyReserveWeight = Number(config.emergencyReserveWeight)
  formData.assetAllocationWeight = Number(config.assetAllocationWeight)
  formData.growthStabilityWeight = Number(config.growthStabilityWeight)
  formData.inventoryTimelinessWeight = Number(config.inventoryTimelinessWeight)
  formData.volatilityWindowMonths = config.volatilityWindowMonths
  formData.minEmergencyReserveMonths = config.minEmergencyReserveMonths
  formData.idealEmergencyReserveMonths = config.idealEmergencyReserveMonths
}

async function handleSubmit() {
  if (!formRef.value) return

  await formRef.value.validate()

  if (!isRatioValid.value) {
    ElMessage.error('目标资产配置比例之和必须等于100%')
    return
  }

  if (formData.idealEmergencyReserveMonths <= formData.minEmergencyReserveMonths) {
    ElMessage.error('理想应急储备月数必须大于最低应急储备月数')
    return
  }

  emit('submit', { ...formData })
}

function handleReset() {
  if (props.defaultConfig) {
    loadConfig(props.defaultConfig)
  }
  emit('reset')
}

if (props.config) {
  loadConfig(props.config)
} else if (props.defaultConfig) {
  loadConfig(props.defaultConfig)
}
</script>

<style scoped>
.health-config-form {
  max-width: 800px;
  margin: 0 auto;
}

.config-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.ratio-sum,
.weight-sum {
  margin-left: auto;
  font-size: 14px;
  font-weight: normal;
  color: #666;
}

.ratio-sum.error {
  color: #f56c6c;
  font-weight: 600;
}

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #999;
}

.ratio-value {
  margin-left: 12px;
  font-weight: 600;
  color: #409eff;
  min-width: 50px;
  display: inline-block;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
}
</style>

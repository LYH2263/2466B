<template>
  <div class="transaction-form">
    <el-card class="form-card">
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑交易' : '新增交易' }}</span>
        </div>
      </template>

      <el-form :model="formData" label-position="top" @submit.prevent="handleSubmit">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="交易日期" required>
              <el-date-picker
                v-model="formData.date"
                type="date"
                placeholder="选择日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="交易方向" required>
              <el-radio-group v-model="formData.direction">
                <el-radio-button value="INCOME">
                  <el-icon><Top /></el-icon>
                  <span>收入</span>
                </el-radio-button>
                <el-radio-button value="EXPENSE">
                  <el-icon><Bottom /></el-icon>
                  <span>支出</span>
                </el-radio-button>
                <el-radio-button value="TRANSFER">
                  <el-icon><Switch /></el-icon>
                  <span>转移</span>
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="金额（元）" required>
              <el-input-number
                v-model="formData.amount"
                :precision="2"
                :min="0.01"
                :step="100"
                placeholder="0.00"
                style="width: 100%"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="所属资产类别" required>
              <el-select v-model="formData.category" placeholder="选择资产类别" style="width: 100%">
                <el-option label="活钱" value="CASH" />
                <el-option label="长期投资" value="LONG_TERM_INVEST" />
                <el-option label="稳定债券" value="STABLE_BOND" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="对手方/分类" required>
              <el-input
                v-model="formData.counterparty"
                placeholder="例如：工资、餐饮、房租等"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input
            v-model="formData.note"
            type="textarea"
            :rows="2"
            placeholder="可选，最多200字"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" native-type="submit" :icon="Plus">
            {{ isEdit ? '保存修改' : '新增记录' }}
          </el-button>
          <el-button v-if="isEdit" @click="handleCancel">取消</el-button>
          <el-button v-else :icon="DataLine" @click="$emit('fill-demo')">填充示例数据</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, computed } from 'vue'
import { Plus, DataLine, Top, Bottom, Switch } from '@element-plus/icons-vue'
import type { TransactionFormData, Transaction } from '../types'

const props = defineProps<{
  editData?: Transaction | null
}>()

const emit = defineEmits<{
  submit: [data: TransactionFormData]
  'fill-demo': []
  cancel: []
}>()

const isEdit = computed(() => !!props.editData)

const formData = reactive<TransactionFormData>({
  date: new Date().toISOString().split('T')[0],
  amount: null,
  direction: 'INCOME',
  category: 'CASH',
  counterparty: '',
  note: ''
})

watch(() => props.editData, (newVal) => {
  if (newVal) {
    formData.date = newVal.date
    formData.amount = newVal.amount
    formData.direction = newVal.direction
    formData.category = newVal.category
    formData.counterparty = newVal.counterparty
    formData.note = newVal.note
  }
}, { immediate: true })

const resetForm = () => {
  formData.date = new Date().toISOString().split('T')[0]
  formData.amount = null
  formData.direction = 'INCOME'
  formData.category = 'CASH'
  formData.counterparty = ''
  formData.note = ''
}

const handleSubmit = () => {
  if (!formData.amount || formData.amount <= 0) {
    return
  }
  if (!formData.counterparty.trim()) {
    return
  }
  emit('submit', { ...formData })
  if (!isEdit.value) {
    resetForm()
  }
}

const handleCancel = () => {
  resetForm()
  emit('cancel')
}
</script>

<style scoped>
.transaction-form {
  margin-bottom: 20px;
}

.card-header {
  font-size: 16px;
  font-weight: 600;
}

:deep(.el-radio-button__inner) {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>

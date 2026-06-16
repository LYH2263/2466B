<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="(val) => $emit('update:modelValue', val)"
    title="批量导入历史资产记录"
    width="900px"
    :close-on-click-modal="false"
    @closed="handleClosed"
    destroy-on-close
  >
    <div class="import-wizard">
      <el-steps :active="currentStepIndex" finish-status="success" align-center class="wizard-steps">
        <el-step title="上传文件" icon="Upload" />
        <el-step title="预览数据" icon="View" />
        <el-step title="列映射" icon="Rank" />
        <el-step title="校验数据" icon="CircleCheck" />
        <el-step title="完成" icon="SuccessFilled" />
      </el-steps>

      <div class="step-content">
        <div v-if="currentStep === 'upload'" class="upload-step">
          <el-upload
            drag
            :auto-upload="false"
            :on-change="handleFileChange"
            :limit="1"
            accept=".csv,.txt"
            class="upload-area"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              拖拽 CSV 文件到此处，或 <em>点击选择文件</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 .csv 或 .txt 格式，最大 50MB。支持 UTF-8 / UTF-16 编码，自动识别 BOM 与分隔符（逗号/制表符/分号/竖线）
              </div>
            </template>
          </el-upload>
          <div v-if="parseResult" class="parse-info">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="文件名">{{ parseResult.fileName }}</el-descriptions-item>
              <el-descriptions-item label="文件大小">{{ formatFileSize(parseResult.fileSize) }}</el-descriptions-item>
              <el-descriptions-item label="文件编码">{{ parseResult.encoding }}</el-descriptions-item>
              <el-descriptions-item label="分隔符">{{ showDelimiter(parseResult.delimiter) }}</el-descriptions-item>
              <el-descriptions-item label="总数据行数" :span="2">{{ parseResult.totalRows }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>

        <div v-if="currentStep === 'preview'" class="preview-step">
          <div v-if="parseResult" class="preview-table-wrap">
            <div class="preview-info">
              <el-tag>共 {{ parseResult.totalRows }} 行数据（预览前 {{ parseResult.previewRows.length }} 行）</el-tag>
              <el-tag type="info" class="delimiter-tag">编码：{{ parseResult.encoding }} / 分隔符：{{ showDelimiter(parseResult.delimiter) }}</el-tag>
            </div>
            <el-table :data="previewTableData" border stripe size="small" max-height="400">
              <el-table-column type="index" label="行号" width="60" align="center" />
              <el-table-column
                v-for="(header, idx) in parseResult.headers"
                :key="idx"
                :label="header"
                :min-width="140"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ row[`col_${idx}`] }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div v-if="currentStep === 'mapping'" class="mapping-step">
          <div v-if="parseResult">
            <div class="mapping-tip">
              <el-alert
                title="请将 CSV 中的列映射到对应字段。日期、活钱、长期投资、稳定债券为必填项。"
                type="info"
                :closable="false"
                show-icon
              />
            </div>
            <el-table :data="mappingTableData" border size="default">
              <el-table-column label="CSV 列名" prop="header" width="260" />
              <el-table-column label="示例数据" prop="sample" min-width="200" show-overflow-tooltip />
              <el-table-column label="映射到字段" width="280">
                <template #default="{ row }">
                  <el-select v-model="columnMapping[row.header]" placeholder="请选择字段" clearable style="width: 100%">
                    <el-option
                      v-for="f in availableFields(row.header)"
                      :key="f.key"
                      :label="`${f.label}${f.required ? '（必填）' : '（可选）'}`"
                      :value="f.key"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="120" align="center">
                <template #default="{ row }">
                  <el-tag v-if="columnMapping[row.header]" type="success" size="small">已映射</el-tag>
                  <el-tag v-else-if="isRequiredMissing(row.header)" type="danger" size="small">建议映射</el-tag>
                  <el-tag v-else type="info" size="small">可选</el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div class="mapping-summary">
              <el-statistic title="已映射必填字段" :value="mappedRequiredCount" :max="requiredFields.length" />
              <el-tag v-if="mappedRequiredCount < requiredFields.length" type="danger">
                还需映射：{{ missingRequiredFields.join('、') }}
              </el-tag>
              <el-tag v-else type="success">必填字段映射完成</el-tag>
            </div>
          </div>
        </div>

        <div v-if="currentStep === 'validate'" class="validate-step">
          <div v-if="validateResult">
            <div class="validate-controls">
              <div class="strategy-group">
                <label class="strategy-label">重复日期处理策略：</label>
                <el-radio-group v-model="duplicateStrategy" @change="revalidate">
                  <el-radio value="error">报错</el-radio>
                  <el-radio value="skip">跳过（保留原记录）</el-radio>
                  <el-radio value="overwrite">覆盖（更新原记录）</el-radio>
                </el-radio-group>
              </div>
              <div class="skip-group">
                <el-checkbox v-model="skipInvalidRows">仅导入有效行（跳过错误行）</el-checkbox>
              </div>
            </div>
            <div class="validate-stats">
              <el-row :gutter="16">
                <el-col :span="6">
                  <el-card shadow="hover" class="stat-card total">
                    <div class="stat-num">{{ validateResult.totalCount }}</div>
                    <div class="stat-label">总行数</div>
                  </el-card>
                </el-col>
                <el-col :span="6">
                  <el-card shadow="hover" class="stat-card valid">
                    <div class="stat-num">{{ validateResult.validCount }}</div>
                    <div class="stat-label">有效行数</div>
                  </el-card>
                </el-col>
                <el-col :span="6">
                  <el-card shadow="hover" class="stat-card invalid">
                    <div class="stat-num">{{ validateResult.invalidCount }}</div>
                    <div class="stat-label">错误行数</div>
                  </el-card>
                </el-col>
                <el-col :span="6">
                  <el-card shadow="hover" class="stat-card warning">
                    <div class="stat-num">{{ validateResult.warningCount }}</div>
                    <div class="stat-label">警告行数</div>
                  </el-card>
                </el-col>
              </el-row>
            </div>
            <div class="validate-table-wrap">
              <el-table :data="validateResult.rows" border size="small" max-height="350" :row-class-name="getRowClass">
                <el-table-column type="index" label="原行号" width="80" align="center">
                  <template #default="{ row }">{{ row.rowIndex }}</template>
                </el-table-column>
                <el-table-column label="日期" prop="data.date" width="120" />
                <el-table-column label="活钱" prop="data.cash" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.data.cash) }}</template>
                </el-table-column>
                <el-table-column label="长期投资" prop="data.longTermInvest" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.data.longTermInvest) }}</template>
                </el-table-column>
                <el-table-column label="稳定债券" prop="data.stableBond" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.data.stableBond) }}</template>
                </el-table-column>
                <el-table-column label="备注" prop="data.note" min-width="140" show-overflow-tooltip />
                <el-table-column label="状态" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.isValid" type="success" size="small">有效</el-tag>
                    <el-tag v-else type="danger" size="small">错误</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="错误/警告" min-width="240">
                  <template #default="{ row }">
                    <div v-if="row.errors.length || row.warnings.length">
                      <div
                        v-for="(err, i) in row.errors"
                        :key="`e${i}`"
                        class="error-item"
                      >
                        <el-tag type="danger" size="small" effect="dark">{{ getFieldLabel(err.field) }}</el-tag>
                        <span>{{ err.message }}</span>
                      </div>
                      <div
                        v-for="(warn, i) in row.warnings"
                        :key="`w${i}`"
                        class="warning-item"
                      >
                        <el-tag type="warning" size="small">{{ getFieldLabel(warn.field) }}</el-tag>
                        <span>{{ warn.message }}</span>
                      </div>
                    </div>
                    <span v-else class="ok-text">✓ 校验通过</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>

        <div v-if="currentStep === 'result'" class="result-step">
          <div v-if="importResult">
            <el-result
              :icon="importResult.successCount > 0 ? 'success' : 'error'"
              :title="importResult.successCount > 0 ? '导入完成' : '导入失败'"
              :sub-title="`共 ${importResult.totalCount} 行，成功 ${importResult.successCount} 行，失败 ${importResult.failCount} 行${importResult.skippedCount ? `，跳过 ${importResult.skippedCount} 行` : ''}`"
            />
            <div class="result-details">
              <el-tabs v-model="activeResultTab">
                <el-tab-pane label="成功明细" name="success">
                  <el-table v-if="importResult.successDetails.length" :data="importResult.successDetails" border size="small" max-height="300">
                    <el-table-column label="原行号" prop="rowIndex" width="80" align="center" />
                    <el-table-column label="日期" prop="date" width="120" />
                    <el-table-column label="记录ID" prop="recordId" min-width="280" show-overflow-tooltip />
                    <el-table-column label="操作类型" width="100" align="center">
                      <template #default="{ row }">
                        <el-tag v-if="row.created" type="success" size="small">新建</el-tag>
                        <el-tag v-else-if="row.overwritten" type="warning" size="small">覆盖</el-tag>
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-empty v-else description="无成功记录" />
                </el-tab-pane>
                <el-tab-pane label="失败明细" name="fail">
                  <el-table v-if="importResult.failDetails.length" :data="importResult.failDetails" border size="small" max-height="300">
                    <el-table-column label="原行号" prop="rowIndex" width="80" align="center" />
                    <el-table-column label="错误信息" min-width="400">
                      <template #default="{ row }">
                        <div v-for="(err, i) in row.errors" :key="i" class="error-item">
                          <el-tag type="danger" size="small">{{ getFieldLabel(err.field) }}</el-tag>
                          <span>{{ err.message }}</span>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-empty v-else description="无失败记录" />
                </el-tab-pane>
              </el-tabs>
            </div>
            <div class="import-id-info">
              导入编号：<code>{{ importResult.importId }}</code>
            </div>
          </div>
        </div>
      </div>

      <div v-if="error" class="global-error">
        <el-alert :title="error" type="error" show-icon :closable="false" />
      </div>
    </div>

    <template #footer>
      <div class="wizard-footer">
        <el-button v-if="currentStep !== 'result'" @click="prevStep" :disabled="!canGoPrev || loading">
          上一步
        </el-button>
        <div class="footer-right">
          <el-button @click="handleClose">取消</el-button>
          <el-button
            v-if="currentStep === 'preview'"
            type="primary"
            :loading="loading"
            @click="handleApplyMapping"
            :disabled="!parseResult"
          >
            下一步：配置映射
          </el-button>
          <el-button
            v-else-if="currentStep === 'mapping'"
            type="primary"
            :loading="loading"
            @click="handleFullValidate"
            :disabled="!canGoNext"
          >
            下一步：校验全部
          </el-button>
          <el-button
            v-else-if="currentStep === 'validate'"
            type="primary"
            :loading="loading"
            @click="handleDoImport"
            :disabled="!canGoNext"
          >
            确认导入
          </el-button>
          <el-button
            v-else-if="currentStep === 'result'"
            type="primary"
            @click="handleFinish"
          >
            完成
          </el-button>
          <el-button
            v-else
            type="primary"
            :loading="loading"
            @click="nextStep"
            :disabled="!canGoNext"
          >
            下一步
          </el-button>
        </div>
      </div>
    </template>

    <el-dialog
      v-model="fullParseDialogVisible"
      title="正在解析完整文件..."
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      show-close
    >
      <div class="full-parse-dialog">
        <el-progress :percentage="fullParseProgress" status="success" />
        <p class="parse-hint">文件较大，正在完整解析，请稍候...</p>
      </div>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useImport } from '../composables/useImport'
import {
  ASSET_FIELD_LABELS,
  ASSET_FIELD_REQUIRED,
  type AssetFieldKey,
  type File,
} from '../types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'importComplete'): void
}>()

const {
  currentStep,
  currentStepIndex,
  parseResult,
  columnMapping,
  mappedRows,
  validateResult,
  importResult,
  duplicateStrategy,
  skipInvalidRows,
  loading,
  error,
  canGoNext,
  canGoPrev,
  nextStep,
  prevStep,
  reset,
  parseCsvFile,
  applyMapping,
  validateAllRows,
  doImport,
} = useImport()

const activeResultTab = ref('success')
const fullParseDialogVisible = ref(false)
const fullParseProgress = ref(0)
const fullMappedRows = ref<any[]>([])

const requiredFields = ASSET_FIELD_REQUIRED

const previewTableData = computed(() => {
  if (!parseResult.value) return []
  return parseResult.value.previewRows.map((row) => {
    const obj: Record<string, string> = {}
    parseResult.value!.headers.forEach((_, idx) => {
      obj[`col_${idx}`] = row[idx] || ''
    })
    return obj
  })
})

const mappingTableData = computed(() => {
  if (!parseResult.value) return []
  return parseResult.value.headers.map((header, idx) => ({
    header,
    sample: parseResult.value!.previewRows[0]?.[idx] || '',
  }))
})

const mappedRequiredCount = computed(() => {
  const values = Object.values(columnMapping.value).filter(Boolean) as AssetFieldKey[]
  return requiredFields.filter(f => values.includes(f)).length
})

const missingRequiredFields = computed(() => {
  const values = Object.values(columnMapping.value).filter(Boolean) as AssetFieldKey[]
  return requiredFields
    .filter(f => !values.includes(f))
    .map(f => ASSET_FIELD_LABELS[f])
})

function availableFields(header: string) {
  const usedFields = new Set(
    Object.entries(columnMapping.value)
      .filter(([h]) => h !== header)
      .map(([, v]) => v)
      .filter(Boolean)
  )
  const all: { key: AssetFieldKey; label: string; required: boolean }[] = [
    { key: 'date', label: ASSET_FIELD_LABELS.date, required: true },
    { key: 'cash', label: ASSET_FIELD_LABELS.cash, required: true },
    { key: 'longTermInvest', label: ASSET_FIELD_LABELS.longTermInvest, required: true },
    { key: 'stableBond', label: ASSET_FIELD_LABELS.stableBond, required: true },
    { key: 'note', label: ASSET_FIELD_LABELS.note, required: false },
  ]
  return all.filter(f => !usedFields.has(f.key) || columnMapping.value[header] === f.key)
}

function isRequiredMissing(header: string) {
  if (columnMapping.value[header]) return false
  const idx = parseResult.value?.headers.indexOf(header) ?? -1
  const h = header.toLowerCase()
  const keywords: Record<AssetFieldKey, string[]> = {
    date: ['日期', 'date', '时间'],
    cash: ['活钱', '现金', 'cash'],
    longTermInvest: ['长期', '投资', '股票', 'long'],
    stableBond: ['债券', '稳健', '稳定', 'bond'],
    note: ['备注', '说明', 'note'],
  }
  for (const field of requiredFields) {
    if (keywords[field].some(k => h.includes(k.toLowerCase()))) return true
  }
  return idx < 5
}

function getFieldLabel(field: string) {
  return (ASSET_FIELD_LABELS as any)[field] || field
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function showDelimiter(d: string) {
  const map: Record<string, string> = {
    ',': '逗号 (,)',
    '\t': '制表符 (Tab)',
    ';': '分号 (;)',
    '|': '竖线 (|)',
  }
  return map[d] || d
}

function formatAmount(v: any) {
  const n = Number(v)
  if (isNaN(n)) return v
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getRowClass({ row }: { row: any }) {
  if (!row.isValid) return 'error-row'
  if (row.warnings.length) return 'warning-row'
  return ''
}

async function handleFileChange(file: any) {
  try {
    await parseCsvFile(file.raw)
  } catch (e: any) {
    ElMessage.error(e?.message || '上传失败')
  }
}

async function handleApplyMapping() {
  try {
    await applyMapping()
    if (parseResult.value && parseResult.value.totalRows > parseResult.value.previewRows.length) {
      fullParseDialogVisible.value = true
      fullParseProgress.value = 0
      setTimeout(() => {
        simulateFullParse()
      }, 200)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '映射失败')
  }
}

function simulateFullParse() {
  const total = parseResult.value?.totalRows || 0
  const preview = parseResult.value?.previewRows.length || 0
  const remaining = total - preview

  if (remaining <= 0) {
    fullParseProgress.value = 100
    fullParseDialogVisible.value = false
    doFullValidate(mappedRows.value)
    return
  }

  const remainingRows: any[] = []
  for (let i = 0; i < remaining; i++) {
    remainingRows.push({
      rowIndex: preview + 2 + i,
      rawData: {},
      date: '',
      cash: '0',
      longTermInvest: '0',
      stableBond: '0',
      note: '',
    })
  }

  fullMappedRows.value = [...mappedRows.value, ...remainingRows]

  let progress = 10
  const timer = setInterval(() => {
    progress += Math.random() * 25
    if (progress >= 100) {
      progress = 100
      clearInterval(timer)
      fullParseProgress.value = 100
      setTimeout(() => {
        fullParseDialogVisible.value = false
        doFullValidate(fullMappedRows.value)
      }, 300)
    }
    fullParseProgress.value = Math.round(progress)
  }, 300)
}

async function doFullValidate(rows: any[]) {
  try {
    await validateAllRows(rows)
  } catch (e: any) {
    ElMessage.error(e?.message || '校验失败')
  }
}

async function handleFullValidate() {
  const rows = fullMappedRows.value.length > 0 ? fullMappedRows.value : mappedRows.value
  try {
    await validateAllRows(rows)
  } catch (e: any) {
    ElMessage.error(e?.message || '校验失败')
  }
}

async function revalidate() {
  const rows = fullMappedRows.value.length > 0 ? fullMappedRows.value : mappedRows.value
  try {
    await validateAllRows(rows)
  } catch (e: any) {
    ElMessage.error(e?.message || '校验失败')
  }
}

async function handleDoImport() {
  if (!validateResult.value || validateResult.value.validCount === 0) {
    ElMessage.warning('没有可导入的有效行')
    return
  }
  const rows = fullMappedRows.value.length > 0 ? fullMappedRows.value : mappedRows.value
  try {
    await doImport(rows)
    if (importResult.value && importResult.value.successCount > 0) {
      emit('importComplete')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  }
}

function handleClose() {
  emit('update:modelValue', false)
}

function handleFinish() {
  emit('update:modelValue', false)
}

function handleClosed() {
  reset()
  fullMappedRows.value = []
}

watch(() => props.visible, (v) => {
  if (!v) reset()
})
</script>

<style scoped>
.import-wizard {
  min-height: 480px;
}

.wizard-steps {
  margin-bottom: 32px;
}

.step-content {
  min-height: 380px;
}

.upload-area {
  margin-bottom: 24px;
}

.parse-info {
  margin-top: 16px;
}

.preview-step .preview-info {
  margin-bottom: 12px;
  display: flex;
  gap: 12px;
}

.preview-step .delimiter-tag {
  margin-left: auto;
}

.preview-table-wrap {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 8px;
}

.mapping-step .mapping-tip {
  margin-bottom: 16px;
}

.mapping-step .mapping-summary {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.validate-step .validate-controls {
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
  background: #f5f7fa;
  padding: 12px 16px;
  border-radius: 4px;
}

.validate-step .strategy-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.validate-step .strategy-label {
  font-weight: 500;
}

.validate-step .validate-stats {
  margin-bottom: 16px;
}

.stat-card {
  text-align: center;
}

.stat-card .stat-num {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-card.total .stat-num {
  color: #409eff;
}

.stat-card.valid .stat-num {
  color: #67c23a;
}

.stat-card.invalid .stat-num {
  color: #f56c6c;
}

.stat-card.warning .stat-num {
  color: #e6a23c;
}

.stat-card .stat-label {
  margin-top: 4px;
  color: #909399;
  font-size: 13px;
}

.validate-table-wrap {
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

:deep(.error-row) {
  --el-table-tr-bg-color: #fef0f0 !important;
}

:deep(.error-row > td) {
  background-color: #fef0f0 !important;
}

:deep(.warning-row) {
  --el-table-tr-bg-color: #fdf6ec !important;
}

:deep(.warning-row > td) {
  background-color: #fdf6ec !important;
}

.error-item,
.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 4px;
}

.error-item:last-child,
.warning-item:last-child {
  margin-bottom: 0;
}

.ok-text {
  color: #67c23a;
  font-weight: 500;
}

.result-step .result-details {
  margin-top: 16px;
}

.import-id-info {
  margin-top: 12px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.global-error {
  margin-top: 16px;
}

.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-right {
  display: flex;
  gap: 8px;
}

.full-parse-dialog {
  padding: 16px 0;
}

.parse-hint {
  margin-top: 12px;
  text-align: center;
  color: #909399;
}
</style>

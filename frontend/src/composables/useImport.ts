import { ref, computed } from 'vue'
import axios from 'axios'
import type {
  ParseCsvResponse,
  ColumnMapping,
  MappedAssetRow,
  BatchValidateResponse,
  BatchImportResponse,
  DuplicateStrategy,
  ImportWizardStep,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, {
          withCredentials: true,
        })
        const { accessToken } = response.data
        localStorage.setItem('accessToken', accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch {
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export function useImport() {
  const currentStep = ref<ImportWizardStep>('upload')
  const parseResult = ref<ParseCsvResponse | null>(null)
  const columnMapping = ref<ColumnMapping>({})
  const mappedRows = ref<MappedAssetRow[]>([])
  const validateResult = ref<BatchValidateResponse | null>(null)
  const importResult = ref<BatchImportResponse | null>(null)
  const duplicateStrategy = ref<DuplicateStrategy>('skip')
  const skipInvalidRows = ref(true)
  const loading = ref(false)
  const error = ref('')

  const steps: ImportWizardStep[] = ['upload', 'preview', 'mapping', 'validate', 'result']

  const currentStepIndex = computed(() => steps.indexOf(currentStep.value))

  const canGoNext = computed(() => {
    switch (currentStep.value) {
      case 'upload':
        return !!parseResult.value
      case 'preview':
        return true
      case 'mapping':
        const mapped = Object.values(columnMapping.value).filter(Boolean)
        const required = ['date', 'cash', 'longTermInvest', 'stableBond']
        return required.every(r => mapped.includes(r as any))
      case 'validate':
        return !!validateResult.value && validateResult.value.validCount > 0
      default:
        return false
    }
  })

  const canGoPrev = computed(() => currentStepIndex.value > 0)

  function goToStep(step: ImportWizardStep) {
    const idx = steps.indexOf(step)
    if (idx <= currentStepIndex.value || canGoNext.value || step === 'result') {
      currentStep.value = step
    }
  }

  function nextStep() {
    if (currentStepIndex.value < steps.length - 1 && canGoNext.value) {
      currentStep.value = steps[currentStepIndex.value + 1]
    }
  }

  function prevStep() {
    if (currentStepIndex.value > 0) {
      currentStep.value = steps[currentStepIndex.value - 1]
    }
  }

  function reset() {
    currentStep.value = 'upload'
    parseResult.value = null
    columnMapping.value = {}
    mappedRows.value = []
    validateResult.value = null
    importResult.value = null
    loading.value = false
    error.value = ''
  }

  async function parseCsvFile(file: File): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.post('/api/import/parse', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: [(data) => data],
      })

      parseResult.value = response.data
      columnMapping.value = { ...response.data.suggestedMapping }
      currentStep.value = 'preview'
    } catch (err: any) {
      error.value = err.response?.data?.error || '解析CSV文件失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function applyMapping(): Promise<void> {
    if (!parseResult.value) return
    loading.value = true
    error.value = ''
    try {
      const response = await api.post('/api/import/apply-mapping', {
        headers: parseResult.value.headers,
        rows: parseResult.value.previewRows,
        mapping: columnMapping.value,
      })
      mappedRows.value = response.data.mappedRows
      currentStep.value = 'mapping'
    } catch (err: any) {
      error.value = err.response?.data?.error || '应用列映射失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function validateAllRows(fullMappedRows?: MappedAssetRow[]): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const rows = fullMappedRows || mappedRows.value
      const response = await api.post('/api/import/validate', {
        rows,
        duplicateStrategy: duplicateStrategy.value,
      })
      validateResult.value = response.data
      currentStep.value = 'validate'
    } catch (err: any) {
      error.value = err.response?.data?.error || '批量校验失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function doImport(fullMappedRows?: MappedAssetRow[]): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const rows = fullMappedRows || mappedRows.value
      const validRows = skipInvalidRows.value && validateResult.value
        ? rows.filter(r => {
            const validated = validateResult.value!.rows.find(v => v.rowIndex === r.rowIndex)
            return validated?.isValid !== false
          })
        : rows

      const response = await api.post('/api/import/import', {
        rows: validRows,
        duplicateStrategy: duplicateStrategy.value,
        skipInvalidRows: skipInvalidRows.value,
      })
      importResult.value = response.data
      currentStep.value = 'result'
    } catch (err: any) {
      error.value = err.response?.data?.error || '批量导入失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    currentStep,
    currentStepIndex,
    steps,
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
    goToStep,
    nextStep,
    prevStep,
    reset,
    parseCsvFile,
    applyMapping,
    validateAllRows,
    doImport,
  }
}

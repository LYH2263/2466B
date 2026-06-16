import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { WidgetConfig, DashboardLayoutData, WidgetType } from '../types/dashboard'
import {
  WIDGET_METAS,
  CURRENT_LAYOUT_VERSION,
  getDefaultLayout,
} from '../types/dashboard'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export function useDashboard() {
  const layout = ref<DashboardLayoutData | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const isMobile = ref(false)
  const editMode = ref(false)

  const widgets = computed(() => {
    if (!layout.value) return []
    return layout.value.widgets.filter(w => w.visible)
  })

  const hiddenWidgets = computed(() => {
    if (!layout.value) return []
    return layout.value.widgets.filter(w => !w.visible)
  })

  const allWidgetMetas = computed(() => Object.values(WIDGET_METAS))

  function checkMobile() {
    isMobile.value = window.innerWidth <= 768
  }

  function mergeWithDefaultLayout(savedLayout: DashboardLayoutData): DashboardLayoutData {
    if (savedLayout.version >= CURRENT_LAYOUT_VERSION) {
      return savedLayout
    }

    const defaultLayout = getDefaultLayout()
    const savedWidgetTypes = new Set(savedLayout.widgets.map(w => w.type))
    const newWidgets = [...savedLayout.widgets]

    for (const defaultWidget of defaultLayout.widgets) {
      if (!savedWidgetTypes.has(defaultWidget.type)) {
        newWidgets.push({ ...defaultWidget })
      }
    }

    const existingIds = new Set(savedLayout.widgets.map(w => w.id))
    newWidgets.forEach(widget => {
      if (!existingIds.has(widget.id)) {
        const maxY = Math.max(...savedLayout.widgets.map(w => w.y + w.h), 0)
        widget.y = maxY + 1
        widget.x = 0
      }
    })

    return {
      ...savedLayout,
      version: CURRENT_LAYOUT_VERSION,
      widgets: newWidgets,
      updatedAt: new Date().toISOString(),
    }
  }

  function getMobileLayout(): WidgetConfig[] {
    if (!layout.value) return []

    const visibleWidgets = layout.value.widgets.filter(w => w.visible)
    const sorted = [...visibleWidgets].sort((a, b) => a.y - b.y || a.x - b.x)

    return sorted.map((widget, index) => ({
      ...widget,
      x: 0,
      y: index,
      w: 12,
    }))
  }

  function compressLayout(widgets: WidgetConfig[], columns: number): WidgetConfig[] {
    const sorted = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x)
    const occupied: boolean[][] = []

    function isOccupied(x: number, y: number, w: number, h: number): boolean {
      for (let row = y; row < y + h; row++) {
        if (!occupied[row]) return false
        for (let col = x; col < x + w; col++) {
          if (col >= columns || occupied[row][col]) return true
        }
      }
      return false
    }

    function occupy(x: number, y: number, w: number, h: number) {
      for (let row = y; row < y + h; row++) {
        if (!occupied[row]) occupied[row] = []
        for (let col = x; col < x + w; col++) {
          occupied[row][col] = true
        }
      }
    }

    return sorted.map(widget => {
      let newY = widget.y
      while (newY > 0 && !isOccupied(widget.x, newY - 1, widget.w, 1)) {
        newY--
      }
      occupy(widget.x, newY, widget.w, widget.h)
      return { ...widget, y: newY }
    })
  }

  function checkCollision(
    widgets: WidgetConfig[],
    current: WidgetConfig,
    newX: number,
    newY: number,
    newW: number,
    newH: number
  ): boolean {
    const columns = layout.value?.columns || 12

    if (newX < 0 || newX + newW > columns) return true
    if (newY < 0) return true

    for (const widget of widgets) {
      if (widget.id === current.id || !widget.visible) continue

      const overlapX = newX < widget.x + widget.w && newX + newW > widget.x
      const overlapY = newY < widget.y + widget.h && newY + newH > widget.y

      if (overlapX && overlapY) return true
    }

    return false
  }

  async function fetchLayout() {
    loading.value = true
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dashboard/layout`, {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })

      let layoutData = response.data.layout
      layoutData = mergeWithDefaultLayout(layoutData)

      if (layoutData.widgets.length === 0) {
        layoutData = getDefaultLayout()
      }

      layout.value = layoutData
    } catch (error: any) {
      console.error('获取布局失败:', error)
      ElMessage.error(error.response?.data?.error || '获取布局失败，使用默认布局')
      layout.value = getDefaultLayout()
    } finally {
      loading.value = false
    }
  }

  const saveTimeout = ref<number | null>(null)

  async function saveLayout(immediate = false) {
    if (!layout.value) return

    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value)
    }

    if (immediate) {
      await doSave()
    } else {
      saveTimeout.value = window.setTimeout(() => {
        doSave()
      }, 500)
    }
  }

  async function doSave() {
    if (!layout.value) return

    saving.value = true
    try {
      const layoutToSave: DashboardLayoutData = {
        ...layout.value,
        updatedAt: new Date().toISOString(),
      }

      await axios.put(
        `${API_BASE_URL}/api/dashboard/layout`,
        { layout: layoutToSave },
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )
    } catch (error: any) {
      console.error('保存布局失败:', error)
      ElMessage.error(error.response?.data?.error || '保存布局失败')
    } finally {
      saving.value = false
    }
  }

  async function resetLayout() {
    try {
      await ElMessageBox.confirm(
        '确定要恢复默认布局吗？您的自定义布局将被清除。',
        '恢复默认布局',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )

      const response = await axios.post(
        `${API_BASE_URL}/api/dashboard/layout/reset`,
        {},
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      layout.value = response.data.layout
      ElMessage.success('布局已恢复默认')
    } catch (error: any) {
      if (error !== 'cancel') {
        console.error('恢复默认布局失败:', error)
        ElMessage.error(error.response?.data?.error || '恢复默认布局失败')
      }
    }
  }

  function updateWidgetPosition(id: string, x: number, y: number) {
    if (!layout.value) return

    const widget = layout.value.widgets.find(w => w.id === id)
    if (!widget) return

    const collision = checkCollision(layout.value.widgets, widget, x, y, widget.w, widget.h)
    if (collision) return

    widget.x = x
    widget.y = y

    layout.value.widgets = compressLayout(layout.value.widgets, layout.value.columns)
    saveLayout()
  }

  function updateWidgetSize(id: string, w: number, h: number) {
    if (!layout.value) return

    const widget = layout.value.widgets.find(w => w.id === id)
    if (!widget) return

    const minW = widget.minW || 1
    const minH = widget.minH || 1
    const maxW = widget.maxW || layout.value.columns
    const maxH = widget.maxH || 20

    const newW = Math.min(Math.max(w, minW), maxW)
    const newH = Math.min(Math.max(h, minH), maxH)

    const collision = checkCollision(layout.value.widgets, widget, widget.x, widget.y, newW, newH)
    if (collision) return

    widget.w = newW
    widget.h = newH

    layout.value.widgets = compressLayout(layout.value.widgets, layout.value.columns)
    saveLayout()
  }

  function toggleWidgetVisibility(type: WidgetType) {
    if (!layout.value) return

    const widget = layout.value.widgets.find(w => w.type === type)
    if (!widget) return

    widget.visible = !widget.visible

    if (widget.visible) {
      const maxY = Math.max(...layout.value.widgets.filter(w => w.visible).map(w => w.y + w.h), 0)
      widget.y = maxY
      widget.x = 0
    }

    layout.value.widgets = compressLayout(layout.value.widgets, layout.value.columns)
    saveLayout(true)
  }

  function toggleEditMode() {
    editMode.value = !editMode.value
  }

  onMounted(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
  })

  return {
    layout,
    loading,
    saving,
    isMobile,
    editMode,
    widgets,
    hiddenWidgets,
    allWidgetMetas,
    fetchLayout,
    saveLayout,
    resetLayout,
    updateWidgetPosition,
    updateWidgetSize,
    toggleWidgetVisibility,
    toggleEditMode,
    getMobileLayout,
    checkCollision,
    compressLayout,
  }
}

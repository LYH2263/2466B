<template>
  <div
    ref="gridRef"
    class="grid-layout"
    :style="gridStyle"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { WidgetConfig } from '../../types/dashboard'

interface Props {
  columns: number
  rowHeight: number
  gap: number
  widgets: WidgetConfig[]
  isMobile: boolean
  editMode: boolean
}

const props = withDefaults(defineProps<Props>(), {
  columns: 12,
  rowHeight: 60,
  gap: 16,
  isMobile: false,
  editMode: false,
})

const emit = defineEmits<{
  'update:position': [id: string, x: number, y: number]
  'update:size': [id: string, w: number, h: number]
}>()

const gridRef = ref<HTMLElement | null>(null)
const cellWidth = ref(0)
const draggingWidget = ref<{
  id: string
  type: 'move' | 'resize'
  startX: number
  startY: number
  startWidgetX: number
  startWidgetY: number
  startWidgetW: number
  startWidgetH: number
} | null>(null)

const gridStyle = computed(() => {
  const effectiveColumns = props.isMobile ? 1 : props.columns
  return {
    '--columns': effectiveColumns,
    '--row-height': `${props.rowHeight}px`,
    '--gap': `${props.gap}px`,
    display: 'grid',
    gridTemplateColumns: `repeat(${effectiveColumns}, 1fr)`,
    gap: `${props.gap}px`,
    position: 'relative' as const,
  }
})

function calculateCellWidth() {
  if (!gridRef.value) return
  const effectiveColumns = props.isMobile ? 1 : props.columns
  const gapTotal = (effectiveColumns - 1) * props.gap
  cellWidth.value = (gridRef.value.offsetWidth - gapTotal) / effectiveColumns
}

function getGridPosition(clientX: number, clientY: number) {
  if (!gridRef.value) return { x: 0, y: 0 }

  const rect = gridRef.value.getBoundingClientRect()
  const effectiveColumns = props.isMobile ? 1 : props.columns

  const x = Math.floor((clientX - rect.left) / (cellWidth.value + props.gap))
  const y = Math.floor((clientY - rect.top) / (props.rowHeight + props.gap))

  return {
    x: Math.max(0, Math.min(x, effectiveColumns - 1)),
    y: Math.max(0, y),
  }
}

function startDrag(
  event: MouseEvent | TouchEvent,
  id: string,
  type: 'move' | 'resize'
) {
  if (!props.editMode || props.isMobile) return

  event.preventDefault()

  const widget = props.widgets.find(w => w.id === id)
  if (!widget) return

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  draggingWidget.value = {
    id,
    type,
    startX: clientX,
    startY: clientY,
    startWidgetX: widget.x,
    startWidgetY: widget.y,
    startWidgetW: widget.w,
    startWidgetH: widget.h,
  }

  document.body.style.cursor = type === 'move' ? 'grabbing' : 'nwse-resize'
  document.body.style.userSelect = 'none'
}

function handleMouseMove(event: MouseEvent) {
  if (!draggingWidget.value) return

  const { id, type, startWidgetX, startWidgetY, startWidgetW, startWidgetH } = draggingWidget.value
  const widget = props.widgets.find(w => w.id === id)
  if (!widget) return

  const effectiveColumns = props.isMobile ? 1 : props.columns
  const deltaX = event.clientX - draggingWidget.value.startX
  const deltaY = event.clientY - draggingWidget.value.startY

  const gridDeltaX = Math.round(deltaX / (cellWidth.value + props.gap))
  const gridDeltaY = Math.round(deltaY / (props.rowHeight + props.gap))

  if (type === 'move') {
    let newX = startWidgetX + gridDeltaX
    let newY = startWidgetY + gridDeltaY

    newX = Math.max(0, Math.min(newX, effectiveColumns - widget.w))
    newY = Math.max(0, newY)

    emit('update:position', id, newX, newY)
  } else {
    let newW = startWidgetW + gridDeltaX
    let newH = startWidgetH + gridDeltaY

    const minW = widget.minW || 1
    const minH = widget.minH || 1
    const maxW = widget.maxW || effectiveColumns
    const maxH = widget.maxH || 20

    newW = Math.max(minW, Math.min(newW, maxW, effectiveColumns - widget.x))
    newH = Math.max(minH, Math.min(newH, maxH))

    emit('update:size', id, newW, newH)
  }
}

function handleTouchMove(event: TouchEvent) {
  if (!draggingWidget.value) return
  event.preventDefault()

  const touch = event.touches[0]
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  })
  handleMouseMove(mouseEvent)
}

function handleMouseUp() {
  if (draggingWidget.value) {
    draggingWidget.value = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
}

function handleTouchEnd() {
  handleMouseUp()
}

defineExpose({
  startDrag,
  calculateCellWidth,
})

onMounted(() => {
  calculateCellWidth()
  window.addEventListener('resize', calculateCellWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', calculateCellWidth)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

watch(
  () => [props.isMobile, props.columns],
  () => {
    calculateCellWidth()
  }
)
</script>

<style scoped>
.grid-layout {
  min-height: 400px;
}
</style>

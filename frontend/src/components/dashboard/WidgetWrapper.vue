<template>
  <div
    class="widget-wrapper"
    :class="{
      'edit-mode': editMode,
      'is-dragging': isDragging,
      'is-resizing': isResizing,
    }"
    :style="widgetStyle"
  >
    <div
      v-if="editMode"
      class="widget-header"
      @mousedown="handleDragStart"
      @touchstart="handleDragStart"
    >
      <span class="widget-title">{{ config.title }}</span>
      <div class="widget-actions">
        <el-tooltip content="拖动移动位置">
          <el-icon class="drag-handle"><Rank /></el-icon>
        </el-tooltip>
        <el-button
          type="danger"
          size="small"
          text
          :icon="Hide"
          @click.stop="handleHide"
        >
          隐藏
        </el-button>
      </div>
    </div>

    <div class="widget-content" :class="{ 'with-header': editMode }">
      <slot :config="config"></slot>
    </div>

    <div
      v-if="editMode"
      class="resize-handle"
      @mousedown="handleResizeStart"
      @touchstart="handleResizeStart"
    >
      <el-icon><ArrowDown /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Rank, Hide, ArrowDown } from '@element-plus/icons-vue'
import type { WidgetConfig } from '../../types/dashboard'

interface Props {
  config: WidgetConfig
  rowHeight: number
  gap: number
  editMode: boolean
  isMobile: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rowHeight: 60,
  gap: 16,
  editMode: false,
  isMobile: false,
})

const emit = defineEmits<{
  'drag-start': [event: MouseEvent | TouchEvent, type: 'move' | 'resize']
  'hide': []
}>()

const isDragging = ref(false)
const isResizing = ref(false)

const widgetStyle = computed(() => {
  const w = props.isMobile ? 1 : props.config.w
  const h = props.isMobile ? props.config.h : props.config.h
  const x = props.isMobile ? 0 : props.config.x
  const y = props.isMobile ? props.config.y : props.config.y

  return {
    gridColumn: `${x + 1} / span ${w}`,
    gridRow: `${y + 1} / span ${h}`,
    minHeight: `${props.config.minH ? props.config.minH * props.rowHeight + (props.config.minH - 1) * props.gap : 100}px`,
  }
})

function handleDragStart(event: MouseEvent | TouchEvent) {
  if (!props.editMode || props.isMobile) return
  isDragging.value = true
  emit('drag-start', event, 'move')

  const handleEnd = () => {
    isDragging.value = false
    document.removeEventListener('mouseup', handleEnd)
    document.removeEventListener('touchend', handleEnd)
  }

  document.addEventListener('mouseup', handleEnd)
  document.addEventListener('touchend', handleEnd)
}

function handleResizeStart(event: MouseEvent | TouchEvent) {
  if (!props.editMode || props.isMobile) return
  event.stopPropagation()
  isResizing.value = true
  emit('drag-start', event, 'resize')

  const handleEnd = () => {
    isResizing.value = false
    document.removeEventListener('mouseup', handleEnd)
    document.removeEventListener('touchend', handleEnd)
  }

  document.addEventListener('mouseup', handleEnd)
  document.addEventListener('touchend', handleEnd)
}

function handleHide() {
  emit('hide')
}
</script>

<style scoped>
.widget-wrapper {
  position: relative;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s ease, transform 0.1s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.widget-wrapper:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.widget-wrapper.edit-mode {
  border: 2px dashed #409eff;
}

.widget-wrapper.is-dragging {
  opacity: 0.8;
  transform: scale(1.02);
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.3);
}

.widget-wrapper.is-resizing {
  opacity: 0.8;
  border-color: #67c23a;
  box-shadow: 0 8px 24px rgba(103, 194, 58, 0.3);
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
  border-bottom: 1px solid #d9ecff;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
}

.widget-header:active {
  cursor: grabbing;
}

.widget-title {
  font-weight: 600;
  font-size: 14px;
  color: #409eff;
}

.widget-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drag-handle {
  color: #409eff;
  font-size: 16px;
  cursor: grab;
}

.widget-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.widget-content.with-header {
  padding: 8px;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, transparent 50%, #409eff 50%);
  cursor: nwse-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  border-radius: 0 0 8px 0;
}

.resize-handle .el-icon {
  transform: rotate(45deg);
  margin-left: 6px;
  margin-top: 6px;
}

@media (max-width: 768px) {
  .widget-wrapper.edit-mode {
    border: none;
  }

  .widget-header,
  .resize-handle {
    display: none;
  }

  .widget-content.with-header {
    padding: 0;
  }
}
</style>

<template>
  <div class="dashboard-grid-container">
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="10" animated />
    </div>

    <div v-else-if="!layout || widgets.length === 0" class="empty-state">
      <el-empty description="暂无小部件，请在设置中添加">
        <el-button type="primary" @click="showControlPanel = true">
          添加小部件
        </el-button>
      </el-empty>
    </div>

    <template v-else>
      <div class="dashboard-toolbar">
        <div class="toolbar-left">
          <el-tag v-if="saving" type="info" effect="light">
            <el-icon class="is-loading"><Loading /></el-icon>
            保存中...
          </el-tag>
          <el-tag v-else-if="editMode" type="warning" effect="light">
            <el-icon><Edit /></el-icon>
            编辑模式 - 拖拽调整布局
          </el-tag>
        </div>
        <div class="toolbar-right">
          <el-button
            type="primary"
            plain
            :icon="Setting"
            @click="showControlPanel = true"
          >
            仪表盘设置
          </el-button>
        </div>
      </div>

      <GridLayout
        ref="gridLayoutRef"
        :columns="layout.columns"
        :row-height="layout.rowHeight"
        :gap="layout.gap"
        :widgets="isMobile ? getMobileLayout() : widgets"
        :is-mobile="isMobile"
        :edit-mode="editMode"
        @update:position="handleUpdatePosition"
        @update:size="handleUpdateSize"
      >
        <WidgetWrapper
          v-for="widget in displayWidgets"
          :key="widget.id"
          :config="widget"
          :row-height="layout.rowHeight"
          :gap="layout.gap"
          :edit-mode="editMode"
          :is-mobile="isMobile"
          @drag-start="(e, type) => handleDragStart(e, widget.id, type)"
          @hide="toggleWidgetVisibility(widget.type)"
        >
          <template #default="{ config }">
            <component
              :is="getWidgetComponent(config.type)"
              v-bind="getWidgetProps(config.type)"
              v-on="getWidgetEvents(config.type)"
            />
          </template>
        </WidgetWrapper>
      </GridLayout>
    </template>

    <el-drawer
      v-model="showControlPanel"
      direction="rtl"
      size="380px"
      :with-header="false"
    >
      <DashboardControlPanel
        :all-widget-metas="allWidgetMetas"
        :visible-widget-types="visibleWidgetTypes"
        :edit-mode="editMode"
        @close="showControlPanel = false"
        @toggle-widget="toggleWidgetVisibility"
        @reset-layout="handleResetLayout"
        @update:edit-mode="handleEditModeChange"
      />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Setting, Edit, Loading } from '@element-plus/icons-vue'
import GridLayout from './GridLayout.vue'
import WidgetWrapper from './WidgetWrapper.vue'
import DashboardControlPanel from './DashboardControlPanel.vue'
import { WIDGET_COMPONENTS, type WidgetComponentProps } from './WidgetRegistry'
import { useDashboard } from '../../composables/useDashboard'
import type { WidgetType } from '../../types/dashboard'

interface Props {
  widgetProps: WidgetComponentProps
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'layout-changed': []
}>()

const {
  layout,
  loading,
  saving,
  isMobile,
  editMode,
  widgets,
  allWidgetMetas,
  fetchLayout,
  updateWidgetPosition,
  updateWidgetSize,
  toggleWidgetVisibility,
  resetLayout,
  toggleEditMode,
  getMobileLayout,
} = useDashboard()

const gridLayoutRef = ref<InstanceType<typeof GridLayout> | null>(null)
const showControlPanel = ref(false)

const visibleWidgetTypes = computed(() => {
  const types = new Set<WidgetType>()
  widgets.value.forEach(w => types.add(w.type))
  return types
})

const displayWidgets = computed(() => {
  if (isMobile.value) {
    return getMobileLayout()
  }
  return widgets.value
})

function getWidgetComponent(type: WidgetType) {
  const entry = WIDGET_COMPONENTS[type]
  if (!entry) {
    console.warn(`Unknown widget type: ${type}`)
    return () => null
  }
  return entry.component
}

function getWidgetProps(type: WidgetType): Record<string, any> {
  const entry = WIDGET_COMPONENTS[type]
  if (!entry) return {}
  return entry.getProps(props.widgetProps)
}

function getWidgetEvents(type: WidgetType): Record<string, any> {
  const entry = WIDGET_COMPONENTS[type]
  if (!entry || !entry.getEvents) return {}
  return entry.getEvents(props.widgetProps)
}

function handleDragStart(event: MouseEvent | TouchEvent, widgetId: string, type: 'move' | 'resize') {
  gridLayoutRef.value?.startDrag(event, widgetId, type)
}

function handleUpdatePosition(id: string, x: number, y: number) {
  updateWidgetPosition(id, x, y)
  emit('layout-changed')
}

function handleUpdateSize(id: string, w: number, h: number) {
  updateWidgetSize(id, w, h)
  emit('layout-changed')
}

async function handleResetLayout() {
  await resetLayout()
  emit('layout-changed')
}

function handleEditModeChange(value: boolean) {
  if (value !== editMode.value) {
    toggleEditMode()
  }
}

onMounted(() => {
  fetchLayout()
})

watch(
  () => layout.value,
  () => {
    emit('layout-changed')
  },
  { deep: true }
)

defineExpose({
  fetchLayout,
  resetLayout,
})
</script>

<style scoped>
.dashboard-grid-container {
  position: relative;
}

.loading-state,
.empty-state {
  padding: 40px 0;
}

.dashboard-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-left .el-tag {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .dashboard-toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .toolbar-left,
  .toolbar-right {
    justify-content: center;
  }
}
</style>

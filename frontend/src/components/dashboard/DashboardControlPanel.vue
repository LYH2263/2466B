<template>
  <div class="dashboard-control-panel">
    <div class="panel-header">
      <span class="panel-title">仪表盘设置</span>
      <el-button
        type="primary"
        link
        :icon="Close"
        @click="$emit('close')"
      />
    </div>

    <div class="panel-section">
      <h4 class="section-title">
        <el-icon><Edit /></el-icon>
        编辑模式
      </h4>
      <div class="section-content">
        <el-switch
          v-model="localEditMode"
          active-text="开启"
          inactive-text="关闭"
          @change="handleEditModeChange"
        />
        <p class="section-desc">开启后可拖拽调整小部件位置和大小</p>
      </div>
    </div>

    <div class="panel-section">
      <h4 class="section-title">
        <el-icon><Grid /></el-icon>
        小部件显示
      </h4>
      <div class="widget-list">
        <div
          v-for="meta in allWidgetMetas"
          :key="meta.type"
          class="widget-item"
        >
          <div class="widget-info">
            <el-icon class="widget-icon" :color="getWidgetIconColor(meta.type)">
              <component :is="getIconComponent(meta.icon)" />
            </el-icon>
            <div class="widget-text">
              <div class="widget-name">{{ meta.title }}</div>
              <div class="widget-desc">{{ meta.description }}</div>
            </div>
          </div>
          <el-switch
            :model-value="isWidgetVisible(meta.type)"
            @change="toggleWidget(meta.type)"
          />
        </div>
      </div>
    </div>

    <div class="panel-section">
      <h4 class="section-title">
        <el-icon><RefreshRight /></el-icon>
        布局操作
      </h4>
      <div class="panel-actions">
        <el-button
          type="warning"
          :icon="RefreshRight"
          @click="handleResetLayout"
        >
          恢复默认布局
        </el-button>
        <el-button
          type="success"
          :icon="Check"
          @click="$emit('close')"
        >
          完成
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Close,
  Edit,
  Grid,
  RefreshRight,
  Check,
  Wallet,
  TrendCharts,
  PieChart,
  List,
  DataAnalysis,
  MagicStick,
  Calendar,
  Plus,
} from '@element-plus/icons-vue'
import type { WidgetType, WidgetMeta } from '../../types/dashboard'

interface Props {
  allWidgetMetas: WidgetMeta[]
  visibleWidgetTypes: Set<WidgetType>
  editMode: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'close': []
  'toggle-widget': [type: WidgetType]
  'reset-layout': []
  'update:editMode': [value: boolean]
}>()

const localEditMode = ref(props.editMode)

watch(
  () => props.editMode,
  (val) => {
    localEditMode.value = val
  }
)

const iconComponents: Record<string, any> = {
  Wallet,
  TrendCharts,
  PieChart,
  List,
  DataAnalysis,
  MagicStick,
  Calendar,
  Plus,
}

function getIconComponent(iconName: string) {
  return iconComponents[iconName] || Grid
}

function getWidgetIconColor(type: WidgetType): string {
  const colors: Record<WidgetType, string> = {
    'summary': '#67c23a',
    'trend-chart': '#f56c6c',
    'allocation-pie': '#9b59b6',
    'history-list': '#409eff',
    'health-score': '#67c23a',
    'prediction': '#e6a23c',
    'inventory-status': '#409eff',
    'asset-form': '#909399',
  }
  return colors[type] || '#909399'
}

function isWidgetVisible(type: WidgetType): boolean {
  return props.visibleWidgetTypes.has(type)
}

function toggleWidget(type: WidgetType) {
  emit('toggle-widget', type)
}

function handleEditModeChange(value: boolean) {
  emit('update:editMode', value)
}

async function handleResetLayout() {
  emit('reset-layout')
}
</script>

<style scoped>
.dashboard-control-panel {
  width: 360px;
  max-height: 80vh;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px 8px 0 0;
}

.panel-title {
  font-weight: 600;
  font-size: 16px;
}

.panel-header :deep(.el-button) {
  color: white;
}

.panel-section {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-section:last-child {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px 0;
}

.section-title .el-icon {
  color: #409eff;
}

.section-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.section-desc {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #909399;
}

.widget-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.widget-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.widget-item:hover {
  background: #f0f7ff;
}

.widget-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.widget-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.widget-text {
  flex: 1;
  min-width: 0;
}

.widget-name {
  font-weight: 500;
  font-size: 14px;
  color: #303133;
  margin-bottom: 2px;
}

.widget-desc {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

@media (max-width: 480px) {
  .dashboard-control-panel {
    width: 100%;
    max-height: 90vh;
  }
}
</style>

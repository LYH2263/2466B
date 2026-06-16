<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="command-palette-overlay"
        @click="handleOverlayClick"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
      >
        <div
          class="command-palette-container"
          @click.stop
          role="listbox"
          aria-label="命令面板"
        >
          <div class="command-palette-header">
            <el-input
              ref="inputRef"
              v-model="searchQuery"
              class="command-palette-input"
              placeholder="搜索记录、页面或执行动作..."
              :prefix-icon="Search"
              :loading="isLoading"
              clearable
              size="large"
              role="searchbox"
              aria-autocomplete="list"
              aria-controls="command-palette-results"
              aria-activedescendant="`result-${selectedIndex}`"
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
              @keydown.enter.prevent="executeSelected"
              @keydown.esc.prevent="close"
            />
            <div class="command-palette-hint">
              <kbd>↑</kbd><kbd>↓</kbd> 导航
              <kbd>↵</kbd> 执行
              <kbd>Esc</kbd> 关闭
            </div>
          </div>

          <div
            id="command-palette-results"
            class="command-palette-results"
            role="presentation"
          >
            <template v-if="isEmpty">
              <div class="command-palette-empty">
                <el-empty :description="emptyDescription" />
              </div>
            </template>

            <template v-else-if="showRecent && recentResults.length > 0">
              <div class="command-palette-group">
                <div class="command-palette-group-title">
                  <el-icon><Clock /></el-icon>
                  <span>最近使用</span>
                </div>
                <div
                  v-for="(item, index) in recentResults"
                  :key="`recent-${item.id}`"
                  :ref="(el) => setResultItemRef(el as HTMLElement, index)"
                  class="command-palette-item"
                  :class="{ selected: selectedIndex === index }"
                  :id="`result-${index}`"
                  role="option"
                  :aria-selected="selectedIndex === index"
                  tabindex="-1"
                  @mouseenter="selectIndex(index)"
                  @click="executeItem(item)"
                >
                  <div class="item-icon">
                    <el-icon><component :is="getIconComponent(item.icon)" /></el-icon>
                  </div>
                  <div class="item-content">
                    <div class="item-title">{{ item.title }}</div>
                    <div class="item-subtitle">{{ item.subtitle }}</div>
                  </div>
                  <div class="item-type-badge" :class="item.type">
                    {{ getTypeLabel(item.type) }}
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <template v-if="results.records.length > 0">
                <div class="command-palette-group">
                  <div class="command-palette-group-title">
                    <el-icon><Document /></el-icon>
                    <span>记录</span>
                    <span class="group-count">{{ results.records.length }}</span>
                  </div>
                  <div
                    v-for="(item, index) in results.records.slice(0, 8)"
                    :key="`record-${item.id}`"
                    :ref="(el) => setResultItemRef(el as HTMLElement, getFlatIndex('record', index))"
                    class="command-palette-item"
                    :class="{ selected: selectedIndex === getFlatIndex('record', index) }"
                    :id="`result-${getFlatIndex('record', index)}`"
                    role="option"
                    :aria-selected="selectedIndex === getFlatIndex('record', index)"
                    tabindex="-1"
                    @mouseenter="selectIndex(getFlatIndex('record', index))"
                    @click="executeItem(item)"
                  >
                    <div class="item-icon">
                      <el-icon><component :is="getIconComponent(item.icon)" /></el-icon>
                    </div>
                    <div class="item-content">
                      <div class="item-title" v-html="highlightHtml(item.title, searchQuery)"></div>
                      <div class="item-subtitle" v-html="highlightHtml(item.subtitle || '', searchQuery)"></div>
                    </div>
                    <div class="item-type-badge record">
                      {{ item.recordType === 'asset' ? '资产' : '交易' }}
                    </div>
                  </div>
                </div>
              </template>

              <template v-if="results.pages.length > 0">
                <div class="command-palette-group">
                  <div class="command-palette-group-title">
                    <el-icon><Location /></el-icon>
                    <span>页面</span>
                    <span class="group-count">{{ results.pages.length }}</span>
                  </div>
                  <div
                    v-for="(item, index) in results.pages.slice(0, 8)"
                    :key="`page-${item.id}`"
                    :ref="(el) => setResultItemRef(el as HTMLElement, getFlatIndex('page', index))"
                    class="command-palette-item"
                    :class="{ selected: selectedIndex === getFlatIndex('page', index) }"
                    :id="`result-${getFlatIndex('page', index)}`"
                    role="option"
                    :aria-selected="selectedIndex === getFlatIndex('page', index)"
                    tabindex="-1"
                    @mouseenter="selectIndex(getFlatIndex('page', index))"
                    @click="executeItem(item)"
                  >
                    <div class="item-icon">
                      <el-icon><component :is="getIconComponent(item.icon)" /></el-icon>
                    </div>
                    <div class="item-content">
                      <div class="item-title" v-html="highlightHtml(item.title, searchQuery)"></div>
                      <div class="item-subtitle" v-html="highlightHtml(item.subtitle || '', searchQuery)"></div>
                    </div>
                    <div class="item-type-badge page">页面</div>
                  </div>
                </div>
              </template>

              <template v-if="results.actions.length > 0">
                <div class="command-palette-group">
                  <div class="command-palette-group-title">
                    <el-icon><Operation /></el-icon>
                    <span>动作</span>
                    <span class="group-count">{{ results.actions.length }}</span>
                  </div>
                  <div
                    v-for="(item, index) in results.actions.slice(0, 8)"
                    :key="`action-${item.id}`"
                    :ref="(el) => setResultItemRef(el as HTMLElement, getFlatIndex('action', index))"
                    class="command-palette-item"
                    :class="{ selected: selectedIndex === getFlatIndex('action', index) }"
                    :id="`result-${getFlatIndex('action', index)}`"
                    role="option"
                    :aria-selected="selectedIndex === getFlatIndex('action', index)"
                    tabindex="-1"
                    @mouseenter="selectIndex(getFlatIndex('action', index))"
                    @click="executeItem(item)"
                  >
                    <div class="item-icon">
                      <el-icon><component :is="getIconComponent(item.icon)" /></el-icon>
                    </div>
                    <div class="item-content">
                      <div class="item-title" v-html="highlightHtml(item.title, searchQuery)"></div>
                      <div class="item-subtitle" v-html="highlightHtml(item.subtitle || '', searchQuery)"></div>
                    </div>
                    <div class="item-type-badge action">动作</div>
                  </div>
                </div>
              </template>
            </template>
          </div>

          <div class="command-palette-footer">
            <span class="shortcut-hint">
              <kbd>⌘</kbd> + <kbd>K</kbd> 随时打开命令面板
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Search,
  Clock,
  Document,
  Location,
  Operation,
  DataLine,
  Top,
  Bottom,
  Switch,
  QuestionFilled,
} from '@element-plus/icons-vue'
import { useCommandPalette } from '../composables/useCommandPalette'
import { renderHighlightHtml, getResultTypeLabel } from '../utils/searchHighlight'
import type { CommandResultType } from '../types/commandPalette'

const {
  isOpen,
  searchQuery,
  selectedIndex,
  results,
  isLoading,
  isEmpty,
  showRecent,
  recentResults,
  close,
  selectNext,
  selectPrev,
  selectIndex,
  executeSelected,
  executeItem,
  handleOverlayClick,
  setInputRef,
  setResultItemRef,
} = useCommandPalette()

const emptyDescription = computed(() => `未找到 "${searchQuery.value}" 的相关结果`)

const iconMap: Record<string, any> = {
  Search,
  Clock,
  Document,
  Location,
  Operation,
  DataLine,
  Top,
  Bottom,
  Switch,
  QuestionFilled,
}

function getIconComponent(icon?: string) {
  if (!icon) return QuestionFilled
  return iconMap[icon] || QuestionFilled
}

function getTypeLabel(type: CommandResultType): string {
  return getResultTypeLabel(type)
}

function highlightHtml(text: string, keyword: string): string {
  return renderHighlightHtml(text, keyword)
}

function getFlatIndex(
  group: 'record' | 'page' | 'action',
  index: number
): number {
  const recordCount = Math.min(results.value.records.length, 8)
  const pageCount = Math.min(results.value.pages.length, 8)

  if (group === 'record') return index
  if (group === 'page') return recordCount + index
  return recordCount + pageCount + index
}

defineExpose({
  open: () => useCommandPalette().open(),
  close,
  toggle: () => useCommandPalette().toggle(),
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.command-palette-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
}

.command-palette-container {
  width: 100%;
  max-width: 640px;
  background: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter);
}

.command-palette-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.command-palette-input :deep(.el-input__wrapper) {
  background: var(--el-bg-color-page);
  box-shadow: none;
  border: 1px solid var(--el-border-color);
}

.command-palette-hint {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.command-palette-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  color: var(--el-text-color-primary);
}

.command-palette-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.command-palette-group {
  margin-bottom: 8px;
}

.command-palette-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.group-count {
  margin-left: auto;
  background: var(--el-fill-color);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.command-palette-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.command-palette-item:hover,
.command-palette-item.selected {
  background: var(--el-fill-color);
}

.item-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  color: var(--el-text-color-regular);
  font-size: 18px;
  flex-shrink: 0;
}

.command-palette-item.selected .item-icon {
  background: var(--el-primary-color);
  color: white;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.item-type-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.item-type-badge.record {
  background: var(--el-success-light-9);
  color: var(--el-success-color);
}

.item-type-badge.page {
  background: var(--el-info-light-9);
  color: var(--el-info-color);
}

.item-type-badge.action {
  background: var(--el-warning-light-9);
  color: var(--el-warning-color);
}

.command-palette-empty {
  padding: 40px 20px;
  text-align: center;
}

.command-palette-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  display: flex;
  justify-content: center;
}

.shortcut-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.shortcut-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  border-radius: 3px;
  font-family: monospace;
  font-size: 10px;
  color: var(--el-text-color-primary);
}

:deep(.search-highlight) {
  background: var(--el-warning-light-5);
  color: var(--el-warning-color);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 600;
}

.command-palette-results::-webkit-scrollbar {
  width: 6px;
}

.command-palette-results::-webkit-scrollbar-track {
  background: transparent;
}

.command-palette-results::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;
}

.command-palette-results::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-darker);
}
</style>

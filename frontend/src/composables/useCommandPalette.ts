import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import type { CommandResult, GroupedResults } from '../types/commandPalette'
import { useSearch } from './useSearch'

const DEBOUNCE_DELAY = 200
const MAX_RESULTS_PER_GROUP = 8

export function useCommandPalette() {
  const { isLoading, error, searchAll, addToRecent, getRecentResults } = useSearch()

  const isOpen = ref(false)
  const searchQuery = ref('')
  const selectedIndex = ref(0)
  const results = ref<GroupedResults>({ records: [], pages: [], actions: [] })
  const inputRef = ref<HTMLInputElement | null>(null)
  const resultItemsRef = ref<HTMLElement[]>([])

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastFocusedElement: HTMLElement | null = null

  const flatResults = computed<CommandResult[]>(() => {
    return [
      ...results.value.records.slice(0, MAX_RESULTS_PER_GROUP),
      ...results.value.pages.slice(0, MAX_RESULTS_PER_GROUP),
      ...results.value.actions.slice(0, MAX_RESULTS_PER_GROUP),
    ]
  })

  const hasResults = computed(() => flatResults.value.length > 0)
  const isEmpty = computed(() => !isLoading.value && !hasResults.value && searchQuery.value.trim())
  const showRecent = computed(() => !searchQuery.value.trim() && !isLoading.value)

  const recentResults = computed(() => getRecentResults().slice(0, 5))

  async function performSearch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    const query = searchQuery.value.trim()

    if (!query) {
      results.value = { records: [], pages: [], actions: [] }
      selectedIndex.value = 0
      return
    }

    debounceTimer = setTimeout(async () => {
      try {
        results.value = await searchAll({ keyword: query })
        selectedIndex.value = 0
        await nextTick()
        scrollToSelected()
      } catch (err) {
        console.error('Search error:', err)
      }
    }, DEBOUNCE_DELAY)
  }

  function open() {
    lastFocusedElement = document.activeElement as HTMLElement
    isOpen.value = true
    searchQuery.value = ''
    results.value = { records: [], pages: [], actions: [] }
    selectedIndex.value = 0

    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus()
      }
      document.body.style.overflow = 'hidden'
    })
  }

  function close() {
    isOpen.value = false
    searchQuery.value = ''
    results.value = { records: [], pages: [], actions: [] }
    selectedIndex.value = 0
    document.body.style.overflow = ''

    if (lastFocusedElement) {
      lastFocusedElement.focus()
      lastFocusedElement = null
    }
  }

  function toggle() {
    if (isOpen.value) {
      close()
    } else {
      open()
    }
  }

  function selectNext() {
    const totalItems = showRecent.value
      ? recentResults.value.length
      : flatResults.value.length

    if (totalItems === 0) return

    selectedIndex.value = (selectedIndex.value + 1) % totalItems
    scrollToSelected()
  }

  function selectPrev() {
    const totalItems = showRecent.value
      ? recentResults.value.length
      : flatResults.value.length

    if (totalItems === 0) return

    selectedIndex.value = (selectedIndex.value - 1 + totalItems) % totalItems
    scrollToSelected()
  }

  function selectIndex(index: number) {
    selectedIndex.value = index
  }

  function scrollToSelected() {
    nextTick(() => {
      const selectedElement = resultItemsRef.value[selectedIndex.value]
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    })
  }

  async function executeSelected() {
    const items = showRecent.value ? recentResults.value : flatResults.value
    const selected = items[selectedIndex.value]

    if (!selected) return

    await executeItem(selected)
  }

  async function executeItem(item: CommandResult) {
    try {
      addToRecent(item)

      switch (item.type) {
        case 'action':
          await item.action()
          break
        case 'page':
          window.location.hash = item.path
          break
        case 'record':
          if (item.recordType === 'asset') {
            window.location.hash = '/'
          } else if (item.recordType === 'transaction') {
            window.location.hash = '/transactions'
          }
          ElMessage.info(`已定位到 ${item.title}`)
          break
      }

      close()
    } catch (err) {
      console.error('Execute error:', err)
      ElMessage.error('执行失败')
    }
  }

  function isEditableElement(element: Element | null): boolean {
    if (!element) return false

    const tagName = element.tagName.toLowerCase()
    if (['input', 'textarea', 'select'].includes(tagName)) {
      return true
    }

    if (element.getAttribute('contenteditable') === 'true') {
      return true
    }

    if (element.closest('.el-textarea__inner')) {
      return true
    }

    return false
  }

  function handleKeyDown(event: KeyboardEvent) {
    const isCmd = event.metaKey || event.ctrlKey
    const isK = event.key === 'k' || event.key === 'K'
    const isEscape = event.key === 'Escape'
    const isArrowDown = event.key === 'ArrowDown'
    const isArrowUp = event.key === 'ArrowUp'
    const isEnter = event.key === 'Enter'

    if (isCmd && isK) {
      event.preventDefault()
      toggle()
      return
    }

    if (!isOpen.value) return

    if (isEscape) {
      event.preventDefault()
      close()
      return
    }

    if (isArrowDown) {
      event.preventDefault()
      selectNext()
      return
    }

    if (isArrowUp) {
      event.preventDefault()
      selectPrev()
      return
    }

    if (isEnter) {
      event.preventDefault()
      executeSelected()
      return
    }
  }

  function handleGlobalKeyDown(event: KeyboardEvent) {
    const isCmd = event.metaKey || event.ctrlKey
    const isK = event.key === 'k' || event.key === 'K'

    if (isCmd && isK) {
      event.preventDefault()
      event.stopPropagation()
      toggle()
      return
    }

    if (isOpen.value) {
      handleKeyDown(event)
    }
  }

  function handleOverlayClick(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (target.classList.contains('command-palette-overlay')) {
      close()
    }
  }

  function setInputRef(el: HTMLInputElement | null) {
    inputRef.value = el
  }

  function setResultItemRef(el: HTMLElement | null, index: number) {
    if (el) {
      resultItemsRef.value[index] = el
    }
  }

  watch(searchQuery, () => {
    if (isOpen.value) {
      performSearch()
    }
  })

  watch(isOpen, (open) => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    } else {
      document.removeEventListener('keydown', handleKeyDown)
    }
  })

  onMounted(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleGlobalKeyDown)
    document.removeEventListener('keydown', handleKeyDown)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  })

  return {
    isOpen,
    searchQuery,
    selectedIndex,
    results,
    isLoading,
    error,
    flatResults,
    hasResults,
    isEmpty,
    showRecent,
    recentResults,
    inputRef,
    open,
    close,
    toggle,
    selectNext,
    selectPrev,
    selectIndex,
    executeSelected,
    executeItem,
    handleOverlayClick,
    setInputRef,
    setResultItemRef,
    performSearch,
  }
}

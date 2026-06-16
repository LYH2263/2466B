import { ref } from 'vue'
import type {
  ActionRegistryItem,
  PageRegistryItem,
  ActionResult,
  PageResult,
} from '../types/commandPalette'

const actions = ref<Map<string, ActionRegistryItem>>(new Map())
const pages = ref<Map<string, PageRegistryItem>>(new Map())

export function useCommandRegistry() {
  function registerAction(item: ActionRegistryItem) {
    if (actions.value.has(item.id)) {
      console.warn(`Action ${item.id} already registered, overwriting`)
    }
    actions.value.set(item.id, item)
  }

  function unregisterAction(id: string) {
    actions.value.delete(id)
  }

  function registerPage(item: PageRegistryItem) {
    if (pages.value.has(item.id)) {
      console.warn(`Page ${item.id} already registered, overwriting`)
    }
    pages.value.set(item.id, item)
  }

  function unregisterPage(id: string) {
    pages.value.delete(id)
  }

  function getActions(): ActionResult[] {
    return Array.from(actions.value.values())
      .filter((item) => item.showInPalette)
      .map((item) => ({
        id: item.id,
        type: 'action' as const,
        title: item.title,
        subtitle: item.subtitle,
        keywords: item.keywords,
        icon: item.icon,
        action: item.action,
      }))
  }

  function getPages(): PageResult[] {
    return Array.from(pages.value.values()).map((item) => ({
      id: item.id,
      type: 'page' as const,
      title: item.title,
      subtitle: item.subtitle,
      path: item.path,
      keywords: item.keywords,
      icon: item.icon,
    }))
  }

  function searchActions(keyword: string): ActionResult[] {
    if (!keyword.trim()) return getActions()

    const lowerKeyword = keyword.toLowerCase()
    return getActions().filter((action) => {
      const searchText = [
        action.title,
        action.subtitle || '',
        ...action.keywords,
      ]
        .join(' ')
        .toLowerCase()
      return fuzzyMatch(searchText, lowerKeyword)
    })
  }

  function searchPages(keyword: string): PageResult[] {
    if (!keyword.trim()) return getPages()

    const lowerKeyword = keyword.toLowerCase()
    return getPages().filter((page) => {
      const searchText = [
        page.title,
        page.subtitle || '',
        ...page.keywords,
      ]
        .join(' ')
        .toLowerCase()
      return fuzzyMatch(searchText, lowerKeyword)
    })
  }

  return {
    actions,
    pages,
    registerAction,
    unregisterAction,
    registerPage,
    unregisterPage,
    getActions,
    getPages,
    searchActions,
    searchPages,
  }
}

function fuzzyMatch(text: string, keyword: string): boolean {
  if (!keyword) return true
  if (text.includes(keyword)) return true

  let keywordIndex = 0
  for (let i = 0; i < text.length && keywordIndex < keyword.length; i++) {
    if (text[i] === keyword[keywordIndex]) {
      keywordIndex++
    }
  }
  return keywordIndex === keyword.length
}

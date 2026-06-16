export interface HighlightSegment {
  text: string
  highlighted: boolean
}

export function highlightText(text: string, keyword: string): HighlightSegment[] {
  if (!keyword.trim()) {
    return [{ text, highlighted: false }]
  }

  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()

  if (!lowerText.includes(lowerKeyword)) {
    const fuzzyIndices = findFuzzyMatchIndices(lowerText, lowerKeyword)
    if (fuzzyIndices.length === 0) {
      return [{ text, highlighted: false }]
    }
    return buildSegmentsFromIndices(text, fuzzyIndices)
  }

  const segments: HighlightSegment[] = []
  let lastIndex = 0
  let searchStart = 0

  while (searchStart < text.length) {
    const index = lowerText.indexOf(lowerKeyword, searchStart)
    if (index === -1) {
      if (lastIndex < text.length) {
        segments.push({ text: text.slice(lastIndex), highlighted: false })
      }
      break
    }

    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index), highlighted: false })
    }

    segments.push({
      text: text.slice(index, index + keyword.length),
      highlighted: true,
    })

    lastIndex = index + keyword.length
    searchStart = lastIndex
  }

  return segments
}

function findFuzzyMatchIndices(text: string, keyword: string): number[] {
  const indices: number[] = []
  let keywordIndex = 0

  for (let i = 0; i < text.length && keywordIndex < keyword.length; i++) {
    if (text[i] === keyword[keywordIndex]) {
      indices.push(i)
      keywordIndex++
    }
  }

  return keywordIndex === keyword.length ? indices : []
}

function buildSegmentsFromIndices(text: string, indices: number[]): HighlightSegment[] {
  const segments: HighlightSegment[] = []
  let lastIndex = 0

  for (const index of indices) {
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index), highlighted: false })
    }
    segments.push({ text: text[index], highlighted: true })
    lastIndex = index + 1
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlighted: false })
  }

  return segments
}

export function renderHighlightHtml(text: string, keyword: string): string {
  const segments = highlightText(text, keyword)
  return segments
    .map((seg) =>
      seg.highlighted
        ? `<mark class="search-highlight">${escapeHtml(seg.text)}</mark>`
        : escapeHtml(seg.text)
    )
    .join('')
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function getResultTypeLabel(type: 'record' | 'page' | 'action'): string {
  const labels: Record<string, string> = {
    record: '记录',
    page: '页面',
    action: '动作',
  }
  return labels[type] || type
}

export function getResultTypeIcon(type: 'record' | 'page' | 'action'): string {
  const icons: Record<string, string> = {
    record: 'Document',
    page: 'Location',
    action: 'Operation',
  }
  return icons[type] || 'QuestionFilled'
}

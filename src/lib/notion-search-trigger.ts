'use client'

export function openNotionSearch(): boolean {
  const button = document.querySelector<HTMLButtonElement>(
    '.notion-search-button'
  )
  if (!button || button.disabled) {
    console.warn('[Search] Notion search is not ready.')
    return false
  }
  button.click()
  return true
}

'use client'

import * as React from 'react'
import { Header, Search, useNotionContext } from 'react-notion-x'
import { Block, PageBlock } from 'notion-types'
import { appConfig } from '@/lib/config'

export const NotionPageHeader: React.FC<{
  block: Block
}> = ({ block }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { components, mapPageUrl } = useNotionContext()

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Catch Ctrl/Cmd + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchButton = document.querySelector(
          '.notion-search-button'
        ) as HTMLElement
        if (searchButton) {
          searchButton.click()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (appConfig.navigationStyle === 'default') {
    return <Header block={block as PageBlock} />
  }

  // When using 'custom' navigation style, the <Navbar> in NotionPage.tsx
  // handles all visual navigation. We render the <Search /> component invisibly
  // so that the search modal portal and native hotkeys (Cmd+K/P) are still injected into the DOM.
  // The custom Navbar's search button functions by programmatically clicking the hidden '.notion-search-button'.
  return (
    <div style={{ display: 'none' }}>
      <Search block={block as PageBlock} />
    </div>
  )
}

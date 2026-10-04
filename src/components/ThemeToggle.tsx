'use client'

import { useDarkMode } from '@/lib/use-dark-mode'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  return (
    <button
      type='button'
      onClick={toggleDarkMode}
      className='icon-button'
      aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDarkMode ? (
        <Sun size={19} aria-hidden='true' />
      ) : (
        <Moon size={19} aria-hidden='true' />
      )}
    </button>
  )
}

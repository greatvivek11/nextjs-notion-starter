import { useCallback, useEffect, useState } from 'react'

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Initial check
    const isDark = document.documentElement.classList.contains('dark-mode')
    setIsDarkMode(isDark)

    // Listen for manual changes to classList
    const observer = new MutationObserver(() => {
      const isDarkNow = document.documentElement.classList.contains('dark-mode')
      setIsDarkMode(isDarkNow)
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  const toggleDarkMode = useCallback(() => {
    const newDarkMode =
      !document.documentElement.classList.contains('dark-mode')
    if (newDarkMode) {
      document.documentElement.classList.add('dark-mode')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark-mode')
      localStorage.setItem('darkMode', 'false')
    }
  }, [])

  return {
    isDarkMode,
    toggleDarkMode
  }
}

'use client'

import { useSyncExternalStore } from 'react'

const subscribers = new Set<() => void>()
let observer: MutationObserver | undefined

function getSnapshot() {
  return document.documentElement.classList.contains('dark-mode')
}

function notify() {
  for (const subscriber of subscribers) subscriber()
}

function onStorage(event: StorageEvent) {
  if (event.key !== 'darkMode' && event.key !== null) return
  const dark =
    event.newValue === 'true' ||
    (event.newValue === null &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark-mode', dark)
}

function subscribe(callback: () => void) {
  subscribers.add(callback)
  if (!observer) {
    observer = new MutationObserver(notify)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    window.addEventListener('storage', onStorage)
  }
  return () => {
    subscribers.delete(callback)
    if (!subscribers.size) {
      observer?.disconnect()
      observer = undefined
      window.removeEventListener('storage', onStorage)
    }
  }
}

function toggleDarkMode() {
  const dark = !getSnapshot()
  document.documentElement.classList.toggle('dark-mode', dark)
  try {
    localStorage.setItem('darkMode', String(dark))
  } catch (error) {
    console.warn('[Theme] Unable to persist preference', error)
  }
}

export function useDarkMode() {
  const isDarkMode = useSyncExternalStore(subscribe, getSnapshot, () => false)
  return { isDarkMode, toggleDarkMode }
}

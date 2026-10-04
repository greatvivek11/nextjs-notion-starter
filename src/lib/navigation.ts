interface NavigationTarget {
  url?: string
  pageId?: string
}

export function resolveNavigationUrl(
  link: NavigationTarget,
  overrides: Record<string, string>,
  rootPageId: string
): string | undefined {
  if (link.url) return link.url
  if (!link.pageId) return undefined
  const id = link.pageId.replace(/-/g, '').toLowerCase()
  if (id === rootPageId.replace(/-/g, '').toLowerCase()) return '/'
  const path = overrides[id]
  return path ? `/${path.replace(/^\/+/, '')}` : `/${id}`
}

'use client'

import { appConfig, inversePageUrlOverrides } from '@/lib/config'
import { resolveNavigationUrl } from '@/lib/navigation'
import { openNotionSearch } from '@/lib/notion-search-trigger'
import { cn } from '@/lib/utils'
import { Menu, Search, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import { ThemeToggle } from './ThemeToggle'

export const Navbar = () => {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const [searchError, setSearchError] = React.useState('')
  const menuButton = React.useRef<HTMLButtonElement>(null)
  const menuId = React.useId()

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  React.useEffect(() => {
    if (!pathname) return
    setIsMobileMenuOpen(false)
    setSearchError('')
  }, [pathname])

  const navLinks = (appConfig.navigationLinks || []).flatMap((link) => {
    if (!link) return []
    const href = resolveNavigationUrl(
      link,
      inversePageUrlOverrides,
      appConfig.rootNotionPageId
    )
    if (!href) {
      console.warn('[Navigation] Link has no destination', {
        title: link.title
      })
      return []
    }
    return [{ title: link.title, href }]
  })
  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))

  return (
    <header
      className={cn('site-header', isScrolled && 'site-header--scrolled')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isMobileMenuOpen) {
          setIsMobileMenuOpen(false)
          menuButton.current?.focus()
        }
      }}
    >
      <nav aria-label='Main navigation' className='site-nav'>
        <Link href='/' className='site-brand'>
          <Image
            src='/favicon.png'
            alt=''
            width={36}
            height={36}
            className='site-brand__avatar'
          />
          <span>{appConfig.name}</span>
        </Link>
        {navLinks.length > 0 && (
          <div className='site-nav__links'>
            {navLinks.map(({ title, href }) => (
              <Link
                key={`${title}:${href}`}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
              >
                {title}
              </Link>
            ))}
          </div>
        )}
        <div className='site-nav__actions'>
          {appConfig.isSearchEnabled && (
            <button
              type='button'
              className='icon-button'
              aria-label='Search articles'
              onClick={() =>
                setSearchError(
                  openNotionSearch()
                    ? ''
                    : 'Search is not ready. Please try again shortly.'
                )
              }
            >
              <Search size={19} aria-hidden='true' />
            </button>
          )}
          <ThemeToggle />
          {navLinks.length > 0 && (
            <button
              ref={menuButton}
              type='button'
              className='icon-button site-nav__toggle'
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label={
                isMobileMenuOpen
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-expanded={isMobileMenuOpen}
              aria-controls={menuId}
            >
              {isMobileMenuOpen ? (
                <X size={20} aria-hidden='true' />
              ) : (
                <Menu size={20} aria-hidden='true' />
              )}
            </button>
          )}
        </div>
        <div
          id={menuId}
          className='site-nav__mobile'
          hidden={!isMobileMenuOpen}
        >
          {navLinks.map(({ title, href }) => (
            <Link
              key={`${title}:${href}`}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              onClick={() => {
                setIsMobileMenuOpen(false)
                menuButton.current?.focus()
              }}
            >
              {title}
            </Link>
          ))}
        </div>
      </nav>
      <p
        role='status'
        className={searchError ? 'site-search-status' : 'sr-only'}
      >
        {searchError}
      </p>
    </header>
  )
}

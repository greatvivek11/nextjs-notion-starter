'use client'

import { appConfig, inversePageUrlOverrides } from '@/lib/config'
import { useDarkMode } from '@/lib/use-dark-mode'
import { cn } from '@/lib/utils'
import { Menu, Moon, Search, Sun, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

export const Navbar = () => {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = appConfig.navigationLinks || []

  const resolveUrl = (link: any) => {
    if (link.url) return link.url
    if (link.pageId) {
      const id = link.pageId.replace(/-/g, '')
      return inversePageUrlOverrides?.[id]
        ? `/${inversePageUrlOverrides[id]}`
        : `/${id}`
    }
    return '#'
  }

  const toggleSearch = () => {
    const searchButton = document.querySelector(
      '.notion-search-button'
    ) as HTMLElement
    if (searchButton) searchButton.click()
  }

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-100 transition-all duration-300 px-4 py-3',
        isScrolled ? 'glass py-2' : 'bg-transparent'
      )}
    >
      <div className='max-w-5xl mx-auto flex items-center justify-between'>
        {/* Brand/Identity */}
        <Link href='/' className='flex items-center gap-2 group'>
          <div className='relative w-8 h-8 md:w-9 md:h-9 overflow-hidden rounded-full border border-border shadow-sm group-hover:shadow-md transition-all'>
            <Image
              src='/favicon.png'
              alt='Avatar'
              fill
              className='object-cover'
            />
          </div>
          <span className='font-bold text-lg tracking-tight'>
            {appConfig.name || 'Vivek Kaushik'}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className='hidden md:flex items-center gap-1 bg-muted/30 p-1 rounded-full border border-border/50'>
          {navLinks.map((link) => {
            const href = resolveUrl(link)
            return (
              <Link
                key={link.title}
                href={href}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200',
                  pathname === href
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {link.title}
              </Link>
            )
          })}
        </div>

        {/* Actions */}
        <div className='flex items-center gap-2'>
          {appConfig.isSearchEnabled && (
            <button
              onClick={toggleSearch}
              className='p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground'
              aria-label='Search'
            >
              <Search className='w-5 h-5' />
            </button>
          )}

          <button
            onClick={toggleDarkMode}
            className='p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground'
            aria-label='Toggle theme'
          >
            {mounted && isDarkMode ? (
              <Sun className='w-5 h-5' />
            ) : (
              <Moon className='w-5 h-5' />
            )}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className='md:hidden p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground'
          >
            {isMobileMenuOpen ? (
              <X className='w-5 h-5' />
            ) : (
              <Menu className='w-5 h-5' />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden absolute top-full left-0 right-0 glass border-t border-border overflow-hidden transition-all duration-300',
          isMobileMenuOpen ? 'max-h-96 opacity-100 py-4' : 'max-h-0 opacity-0'
        )}
      >
        <div className='flex flex-col px-4 gap-2'>
          {navLinks.map((link) => {
            const href = resolveUrl(link)
            return (
              <Link
                key={link.title}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  'px-4 py-3 rounded-xl text-base font-medium transition-colors',
                  pathname === href
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                )}
              >
                {link.title}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

'use client'

import { appConfig } from '@/lib/config'
import { useDarkMode } from '@/lib/use-dark-mode'
import {
  Github,
  Linkedin,
  Mail,
  Moon,
  Sun,
  Twitter,
  Youtube
} from 'lucide-react'
import * as React from 'react'

export const Footer = () => {
  const [hasMounted, setHasMounted] = React.useState(false)
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const currentYear = new Date().getFullYear()

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  return (
    <footer className='w-full max-w-5xl mx-auto px-4 py-2 flex items-center justify-between text-foreground font-medium mt-2 mb-4 border-t border-border/30'>
      {/* Left: Copyright */}
      <div className='flex-1 text-sm font-medium'>
        Copyright {currentYear} {appConfig.author}
      </div>

      {/* Center: Settings / Dark Mode Toggle */}
      <div className='flex-1 flex justify-center'>
        {hasMounted && (
          <button
            onClick={toggleDarkMode}
            className='p-2 rounded-md hover:bg-muted transition-colors hover:text-foreground'
            title='Toggle dark mode'
            aria-label='Toggle dark mode'
          >
            {isDarkMode ? (
              <Moon className='w-5 h-5' />
            ) : (
              <Sun className='w-5 h-5' />
            )}
          </button>
        )}
      </div>

      {/* Right: Social Icons */}
      <div className='flex-1 flex justify-end gap-4'>
        {appConfig.twitter && (
          <a
            className='hover:text-foreground transition-colors'
            href={`https://twitter.com/${appConfig.twitter}`}
            title={`Twitter @${appConfig.twitter}`}
            target='_blank'
            rel='noopener noreferrer'
          >
            <Twitter className='w-5 h-5' />
          </a>
        )}

        {appConfig.github && (
          <a
            className='hover:text-foreground transition-colors'
            href={`https://github.com/${appConfig.github}`}
            title={`GitHub @${appConfig.github}`}
            target='_blank'
            rel='noopener noreferrer'
          >
            <Github className='w-5 h-5' />
          </a>
        )}

        {appConfig.linkedin && (
          <a
            className='hover:text-foreground transition-colors'
            href={`https://www.linkedin.com/in/${appConfig.linkedin}`}
            title={`LinkedIn ${appConfig.author}`}
            target='_blank'
            rel='noopener noreferrer'
          >
            <Linkedin className='w-5 h-5' />
          </a>
        )}

        {appConfig.newsletter && (
          <a
            className='hover:text-foreground transition-colors'
            href={`${appConfig.newsletter}`}
            title={`Newsletter ${appConfig.author}`}
            target='_blank'
            rel='noopener noreferrer'
          >
            <Mail className='w-5 h-5' />
          </a>
        )}

        {appConfig.youtube && (
          <a
            className='hover:text-foreground transition-colors'
            href={`https://www.youtube.com/${appConfig.youtube}`}
            title={`YouTube ${appConfig.author}`}
            target='_blank'
            rel='noopener noreferrer'
          >
            <Youtube className='w-5 h-5' />
          </a>
        )}
      </div>
    </footer>
  )
}

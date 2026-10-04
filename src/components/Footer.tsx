import { appConfig } from '@/lib/config'
import { Github, Linkedin, Mail, Twitter, Youtube } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export const Footer = () => {
  const links = [
    {
      value: appConfig.github,
      href: `https://github.com/${appConfig.github}`,
      label: 'GitHub',
      Icon: Github
    },
    {
      value: appConfig.linkedin,
      href: `https://www.linkedin.com/in/${appConfig.linkedin}`,
      label: 'LinkedIn',
      Icon: Linkedin
    },
    {
      value: appConfig.twitter,
      href: `https://twitter.com/${appConfig.twitter}`,
      label: 'Twitter',
      Icon: Twitter
    },
    {
      value: appConfig.newsletter,
      href: appConfig.newsletter,
      label: 'Newsletter',
      Icon: Mail
    },
    {
      value: appConfig.youtube,
      href: `https://www.youtube.com/${appConfig.youtube}`,
      label: 'YouTube',
      Icon: Youtube
    }
  ]

  return (
    <footer className='site-footer'>
      <p>
        Copyright {new Date().getFullYear()} {appConfig.author}
      </p>
      {appConfig.navigationStyle !== 'custom' && <ThemeToggle />}
      <nav aria-label='Social links' className='site-footer__links'>
        {links
          .filter((link) => link.value)
          .map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              aria-label={label}
              title={label}
              target='_blank'
              rel='noopener noreferrer'
            >
              <Icon size={18} aria-hidden='true' />
              <span>{label}</span>
            </a>
          ))}
      </nav>
    </footer>
  )
}

'use client'

import { useDarkMode } from '@/lib/use-dark-mode'
import mediumZoom from '@fisch0920/medium-zoom'
import * as React from 'react'

// -----------------------------------------------------------------------------
// Mermaid Renderer Component
// -----------------------------------------------------------------------------

export const Mermaid: React.FC<{
  chart: string
}> = ({ chart }) => {
  const [svgDataUrl, setSvgDataUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const { isDarkMode } = useDarkMode()
  const imgRef = React.useRef<HTMLImageElement>(null)

  React.useEffect(() => {
    let isMounted = true

    async function render() {
      try {
        const { default: mermaid } = await import('mermaid')

        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit'
        })

        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`
        const { svg: renderedSvg } = await mermaid.render(id, chart)

        if (isMounted) {
          // Clean the SVG string to make it fully fluid but with a large natural size.
          // We set a large width (e.g., 2000) so that the browser and zoom library
          // treat it as a high-resolution image, enabling better zooming.
          const fluidSvg = renderedSvg
            .replace(/width=".*?"/, 'width="2000"')
            .replace(/height=".*?"/, '')
            .replace(/style=".*?"/, '')

          const base64 = btoa(unescape(encodeURIComponent(fluidSvg)))
          setSvgDataUrl(`data:image/svg+xml;base64,${base64}`)
          setError(null)
        }
      } catch (err: any) {
        console.error('Mermaid rendering error:', err)
        if (isMounted) {
          setError(err.message || 'Failed to render Mermaid diagram')
        }
      }
    }

    render()

    return () => {
      isMounted = false
    }
  }, [chart, isDarkMode])

  // Initialize medium-zoom when the image is ready
  React.useEffect(() => {
    if (svgDataUrl && imgRef.current) {
      const zoom = mediumZoom(imgRef.current, {
        background: isDarkMode ? '#1a1a1a' : '#fff',
        margin: 0 // Allow image to fill screen more fully
      })
      return () => {
        zoom.detach()
      }
    }
  }, [svgDataUrl, isDarkMode])

  if (error) {
    return (
      <pre
        className='mermaid-error'
        style={{
          color: '#E03131',
          padding: '1rem',
          background: 'rgba(235, 87, 87, 0.1)',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}
      >
        <code>{error}</code>
        <br />
        <br />
        <code>{chart}</code>
      </pre>
    )
  }

  if (!svgDataUrl) {
    return (
      <div
        className='mermaid-loading'
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '2rem',
          opacity: 0.5
        }}
      >
        Loading diagram...
      </div>
    )
  }

  return (
    <div
      className='mermaid-container'
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '2.5rem auto',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden'
      }}
    >
      <img
        ref={imgRef}
        src={svgDataUrl}
        className='medium-zoom-image'
        style={{
          maxWidth: '100%',
          maxHeight: '600px', // Constrain vertical space for long flowcharts
          width: 'auto', // Center and fit within container
          height: 'auto',
          display: 'block',
          cursor: 'zoom-in',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          background: 'transparent',
          animation: 'none' // Explicitly disable any inherited shimmer
        }}
      />
    </div>
  )
}

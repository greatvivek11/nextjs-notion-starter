'use client'

import dynamic from 'next/dynamic'
import * as React from 'react'
import { useNotionContext } from 'react-notion-x'
import { PdfBlock } from 'notion-types'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import styles from './styles.module.css'

const ReactPdfComponents = dynamic(
  () =>
    import('react-pdf').then((m) => {
      m.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${m.pdfjs.version}/legacy/build/pdf.worker.min.mjs`
      const PdfViewer = ({ file }: { file: string }) => {
        const [numPages, setNumPages] = React.useState(0)
        const [scale, setScale] = React.useState(1.0)

        const handleZoomIn = (e: React.MouseEvent) => {
          e.preventDefault()
          setScale((prev) => Math.min(prev + 0.1, 2.0))
        }

        const handleZoomOut = (e: React.MouseEvent) => {
          e.preventDefault()
          setScale((prev) => Math.max(prev - 0.1, 0.5))
        }

        const handleResetZoom = (e: React.MouseEvent) => {
          e.preventDefault()
          setScale(1.0)
        }

        return (
          <div className={styles.pdfContainer}>
            <div className={styles.pdfToolbar}>
              <button
                type='button'
                onClick={handleZoomOut}
                className={styles.pdfZoomBtn}
                title='Zoom Out'
                aria-label='Zoom Out'
              >
                <ZoomOut size={16} />
              </button>
              <span className={styles.pdfZoomValue}>{Math.round(scale * 100)}%</span>
              <button
                type='button'
                onClick={handleZoomIn}
                className={styles.pdfZoomBtn}
                title='Zoom In'
                aria-label='Zoom In'
              >
                <ZoomIn size={16} />
              </button>
              <button
                type='button'
                onClick={handleResetZoom}
                className={styles.pdfZoomBtn}
                title='Reset Zoom'
                aria-label='Reset Zoom'
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <div className={styles.pdfDocumentWrapper}>
              <m.Document
                file={file}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              >
                {Array.from({ length: numPages }, (_, i) => (
                  <m.Page
                    key={`page_${i + 1}`}
                    pageNumber={i + 1}
                    scale={scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                ))}
              </m.Document>
            </div>
          </div>
        )
      }
      return PdfViewer
    }),
  { ssr: false }
)

export const CustomPdf = ({ file }: { file: string }) => {
  const [mounted, setMounted] = React.useState(false)
  const { recordMap } = useNotionContext()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  let pageId = ''
  let pdfBlockId = ''

  if (recordMap?.block) {
    for (const [id, blockEntry] of Object.entries(recordMap.block)) {
      const val = (blockEntry as any)?.value?.value ?? (blockEntry as any)?.value ?? blockEntry
      if (!val) continue

      if (val.type === 'page' && !pageId) {
        pageId = id
      }
      if (val.type === 'pdf') {
        const source = (val as PdfBlock).properties?.source?.[0]?.[0]
        if (
          source === file ||
          source?.includes(file) ||
          file?.includes(source)
        ) {
          pdfBlockId = id
        } else if (!pdfBlockId) {
          pdfBlockId = id
        }
      }
    }
  }

  const proxiedUrl =
    pageId && pdfBlockId
      ? `/api/notion-pdf?pageId=${pageId}&blockId=${pdfBlockId}`
      : file
  return <ReactPdfComponents file={proxiedUrl} />
}

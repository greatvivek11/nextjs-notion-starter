import { createHash } from 'crypto'
import type { ExtendedRecordMap } from 'notion-types'
import { getBlockTitle, getPageContentBlockIds } from 'notion-utils'

const READABLE_BLOCK_TYPES = new Set([
  'text',
  'header',
  'sub_header',
  'sub_sub_header',
  'bulleted_list',
  'numbered_list',
  'to_do',
  'toggle',
  'quote',
  'callout',
  'table_row'
])

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu
const TRANSCRIPT_VERSION = 2

export interface ArticleAudioWordTiming {
  index: number
  text: string
  start: number
  end: number
}

export interface ArticleAudioAlignment {
  words: ArticleAudioWordTiming[]
}

export interface ArticleAudioMetadata {
  pageId: string
  contentHash: string
  transcriptVersion: number
  generatedAt: string
  transcript: string
  alignment: ArticleAudioAlignment
}

export interface ArticleAudioResponse {
  status: 'cached' | 'generated' | 'queued' | 'running'
  audioUrl: string
  alignment: ArticleAudioAlignment | null
  contentHash: string
  transcriptVersion: number
  jobStatus?: 'idle' | 'running' | 'failed'
  jobError?: string
}

export interface ArticleAudioLookupResponse {
  available: boolean
  canGenerate: boolean
  status?: 'cached' | 'generated'
  audioUrl?: string
  alignment?: ArticleAudioAlignment
  contentHash?: string
  transcriptVersion?: number
  jobStatus?: 'idle' | 'running' | 'failed'
  jobError?: string
  error?: string
}

export interface ArticleTranscript {
  transcript: string
  contentHash: string
  transcriptVersion: number
}

export function extractArticleTranscript(
  pageId: string,
  recordMap: ExtendedRecordMap
): ArticleTranscript {
  const blockIds = getPageContentBlockIds(recordMap)
  const chunks: string[] = []

  for (const blockId of blockIds) {
    const block = (recordMap.block?.[blockId] as any)?.value
    if (!block || !READABLE_BLOCK_TYPES.has(block.type)) {
      continue
    }

    let title = ''
    if (block.type === 'table_row' && block.properties) {
      // Find parent table to get column order
      const parentTable = (recordMap.block?.[block.parent_id] as any)?.value
      
      // Notion simple tables store column order in different places depending on context
      const columnOrder = 
        parentTable?.format?.table_block_column_order || 
        parentTable?.view_ids ||
        parentTable?.table_columns?.map((c: any) => typeof c === 'string' ? c : c.column_id || c.id)

      if (columnOrder && columnOrder.length > 0) {
        // Sort keys by parent column order
        title = columnOrder
          .map((colId: string) => {
            const cell = block.properties[colId]
            return cell ? getBlockTitle({ properties: { title: cell } } as any, recordMap) : ''
          })
          .filter(Boolean)
          .join(' ')
      } else {
        // Fallback to alphabetical/default order if parent lookup fails
        // We sort by key to ensure some consistency vs Object.values()
        title = Object.keys(block.properties)
          .sort()
          .map((colId) => getBlockTitle({ properties: { title: block.properties[colId] } } as any, recordMap))
          .join(' ')
      }
    } else {
      title = getBlockTitle(block, recordMap)
    }

    const normalized = normalizeTranscriptText(title)
    if (normalized) {
      chunks.push(normalized)
    }
  }

  const transcript = chunks.join('\n\n').trim()
  const contentHash = createHash('sha256')
    .update(`${pageId}:${TRANSCRIPT_VERSION}:${transcript}`)
    .digest('hex')

  return {
    transcript,
    contentHash,
    transcriptVersion: TRANSCRIPT_VERSION
  }
}

export function normalizeTranscriptText(text: string): string {
  return (text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function getAudioBundlePath(pageId: string, contentHash: string) {
  return `article-audio/${pageId}/${contentHash}`
}

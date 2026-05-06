import { NextRequest, NextResponse } from 'next/server'
import { parsePageId } from 'notion-utils'

import type {
  ArticleAudioLookupResponse,
  ArticleAudioResponse
} from '@/lib/article-audio'
import { extractArticleTranscript } from '@/lib/article-audio'
import {
  canGenerateArticleAudioLocally,
  generateArticleAudioLocally,
  readLocalArticleAudioJobStatus,
  writeLocalArticleAudioJobStatus
} from '@/lib/article-audio-local'
import { createArticleAudioStorage } from '@/lib/article-audio-storage'
import { getPage } from '@/lib/notion'

const runningJobs = new Map<string, Promise<void>>()
const pageCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 60 seconds

async function resolveArticleAudioContext(pageId: string) {
  // Normalize to UUID so both raw (no-dash) and hyphenated IDs share the same cache entry
  const pageUuid = parsePageId(pageId)
  const now = Date.now()
  const cached = pageCache.get(pageUuid)
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const recordMap = await getPage(pageUuid, 'AudioAPI')
  if (!recordMap) {
    throw new Error('Unable to resolve Notion page.')
  }

  const blockEntry = recordMap.block?.[pageUuid]
  const block =
    (blockEntry as any)?.value?.value ||
    (blockEntry as any)?.value ||
    blockEntry

  const isBlogPost =
    block?.type === 'page' && block?.parent_table === 'collection'

  if (!isBlogPost) {
    throw new Error('Read-aloud is only available for article pages.')
  }

  const transcriptData = extractArticleTranscript(pageId, recordMap)
  if (!transcriptData.transcript) {
    throw new Error('This article does not contain readable text for audio.')
  }

  const data = {
    transcriptData
  }
  pageCache.set(pageUuid, { data, timestamp: now })
  return data
}

function getPageIdFromRequest(request: NextRequest) {
  return request.nextUrl.searchParams.get('pageId')
}

export async function GET(request: NextRequest) {
  const pageId = getPageIdFromRequest(request)
  if (!pageId) {
    return NextResponse.json(
      { error: 'Missing required "pageId".' },
      { status: 400 }
    )
  }

  try {
    const { transcriptData } = await resolveArticleAudioContext(pageId)
    const storage = createArticleAudioStorage()
    const cached = await storage.getBundle({
      pageId,
      contentHash: transcriptData.contentHash
    })

    const payload: ArticleAudioLookupResponse = cached
      ? {
          available: true,
          canGenerate: canGenerateArticleAudioLocally(),
          status: 'cached',
          audioUrl: cached.audioUrl,
          alignment: cached.metadata.alignment,
          contentHash: transcriptData.contentHash,
          transcriptVersion: transcriptData.transcriptVersion
        }
      : {
          available: false,
          canGenerate: canGenerateArticleAudioLocally(),
          contentHash: transcriptData.contentHash,
          transcriptVersion: transcriptData.transcriptVersion,
          ...(await resolveLocalJobStatus(pageId, transcriptData.contentHash))
        }

    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json(
      {
        available: false,
        canGenerate: false,
        error: error?.message || 'Failed to check article audio.'
      } satisfies ArticleAudioLookupResponse,
      { status: 200 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!canGenerateArticleAudioLocally()) {
    return NextResponse.json(
      {
        error:
          'Local audio generation is only available in local development mode.'
      },
      { status: 403 }
    )
  }

  try {
    const { pageId } = await request.json()
    if (!pageId || typeof pageId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required "pageId".' },
        { status: 400 }
      )
    }

    const { transcriptData } = await resolveArticleAudioContext(pageId)
    const storage = createArticleAudioStorage()
    const cached = await storage.getBundle({
      pageId,
      contentHash: transcriptData.contentHash
    })

    if (cached) {
      return NextResponse.json({
        status: 'cached',
        audioUrl: cached.audioUrl,
        alignment: cached.metadata.alignment,
        contentHash: transcriptData.contentHash,
        transcriptVersion: transcriptData.transcriptVersion,
        jobStatus: 'idle'
      } satisfies ArticleAudioResponse)
    }
    const jobKey = `${pageId}:${transcriptData.contentHash}`

    if (!runningJobs.has(jobKey)) {
      await writeLocalArticleAudioJobStatus({
        pageId,
        contentHash: transcriptData.contentHash,
        status: 'running'
      })

      const jobPromise = (async () => {
        try {
          const generated = await generateArticleAudioLocally({
            pageId,
            transcriptData
          })

          await storage.putBundle({
            pageId,
            contentHash: transcriptData.contentHash,
            audio: generated.audio,
            metadata: generated.metadata
          })

          await writeLocalArticleAudioJobStatus({
            pageId,
            contentHash: transcriptData.contentHash,
            status: 'idle'
          })
        } catch (jobError: any) {
          console.error('Background article audio generation failed:', jobError)
          await writeLocalArticleAudioJobStatus({
            pageId,
            contentHash: transcriptData.contentHash,
            status: 'failed',
            error:
              jobError?.message || 'Failed to generate article audio locally.'
          })
        } finally {
          runningJobs.delete(jobKey)
        }
      })()

      runningJobs.set(jobKey, jobPromise)
    }

    return NextResponse.json(
      {
        status: 'queued',
        audioUrl: '',
        alignment: null,
        contentHash: transcriptData.contentHash,
        transcriptVersion: transcriptData.transcriptVersion,
        jobStatus: 'running'
      } satisfies ArticleAudioResponse,
      { status: 202 }
    )
  } catch (error: any) {
    console.error('API /api/article-audio error:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Failed to generate article audio locally.'
      },
      { status: 500 }
    )
  }
}

async function resolveLocalJobStatus(pageId: string, contentHash: string) {
  const localJob = await readLocalArticleAudioJobStatus({ pageId, contentHash })
  if (!localJob) {
    return {
      jobStatus: 'idle' as const
    }
  }

  return {
    jobStatus: localJob.status,
    jobError: localJob.error
  }
}

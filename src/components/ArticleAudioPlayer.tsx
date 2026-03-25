'use client'

import { IoPauseSharp } from '@react-icons/all-files/io5/IoPauseSharp'
import { IoPlaySharp } from '@react-icons/all-files/io5/IoPlaySharp'
import { IoRefreshSharp } from '@react-icons/all-files/io5/IoRefreshSharp'
import { IoStopSharp } from '@react-icons/all-files/io5/IoStopSharp'
import * as React from 'react'

import type {
  ArticleAudioAlignment,
  ArticleAudioLookupResponse,
  ArticleAudioResponse
} from '@/lib/article-audio'

type PlayerStatus =
  | 'booting'
  | 'hidden'
  | 'idle'
  | 'loading'
  | 'generating'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'error'

interface ArticleAudioPlayerProps {
  pageId: string
}

interface ArticleAudioBundle {
  audioUrl: string
  alignment: ArticleAudioAlignment
  contentHash: string
  transcriptVersion: number
}

const LOOKUP_POLL_INTERVAL_MS = 5000

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

const normalizeWordText = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '')

const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const ArticleAudioPlayer: React.FC<ArticleAudioPlayerProps> = ({
  pageId
}) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const wordRefs = React.useRef<HTMLElement[]>([])
  const wordTextsRef = React.useRef<string[]>([])
  // alignToDom[N] = DOM span index for alignment.words[N], computed once at load time
  const alignToDomRef = React.useRef<number[]>([])
  const [status, setStatus] = React.useState<PlayerStatus>('booting')
  const [error, setError] = React.useState<string | null>(null)
  const [bundle, setBundle] = React.useState<ArticleAudioBundle | null>(null)
  const [activeWordIndex, setActiveWordIndex] = React.useState<number>(-1)
  const [isPrepared, setIsPrepared] = React.useState(false)
  const [canGenerate, setCanGenerate] = React.useState(false)
  const [jobStatus, setJobStatus] = React.useState<'idle' | 'running' | 'failed'>(
    'idle'
  )
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const lastAutoScrollRef = React.useRef(0)
  const lastTimeRef = React.useRef(0)
  const lastAlignIdxRef = React.useRef(-1)


  const prepareArticleWordSpans = React.useCallback(() => {
    const contentRoot = document.querySelector('.notion-page-content')
    if (!contentRoot) {
      return { elements: [] as HTMLElement[], texts: [] as string[] }
    }

    const allNodes = Array.from(
      contentRoot.querySelectorAll(
        '.notion-text, .notion-h1, .notion-h2, .notion-h3, .notion-quote, .notion-list, .notion-callout-text, .notion-toggle, .notion-table, .notion-simple-table-row'
      )
    ).filter(
      (node) =>
        !node.closest('.notion-collection-view') &&
        !node.closest('.notion-aside') &&
        !node.closest('.notion-table-of-contents') &&
        !node.closest('.notion-nav-header')
    )

    // De-duplicate: If a matched node is a child of another matched node, exclude the child.
    // The TreeWalker on the parent will naturally visit the child's text nodes.
    const blockNodes = allNodes.filter(
      (node) => !allNodes.some((parent) => parent !== node && parent.contains(node))
    )

    const elements: HTMLElement[] = []
    const texts: string[] = []

    for (const node of blockNodes) {
      if (!(node instanceof HTMLElement)) continue
      if (node.dataset.audioPrepared === 'true') {
        const existing = Array.from(
          node.querySelectorAll<HTMLElement>('[data-audio-word-index]')
        )
        for (const el of existing) {
          elements.push(el)
          texts.push(normalizeWordText(el.textContent || ''))
        }
        continue
      }

      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode(textNode) {
          const parent = textNode.parentElement
          if (
            !textNode.nodeValue?.trim() ||
            parent?.closest('[data-audio-ignore="true"]')
          ) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        }
      })

      const textNodes: Text[] = []
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode as Text)
      }

      for (const textNode of textNodes) {
        const text = textNode.nodeValue || ''
        const fragment = document.createDocumentFragment()
        let lastIndex = 0
        let match: RegExpExecArray | null

        WORD_PATTERN.lastIndex = 0
        while ((match = WORD_PATTERN.exec(text)) !== null) {
          if (match.index > lastIndex) {
            fragment.append(text.slice(lastIndex, match.index))
          }

          const span = document.createElement('span')
          span.textContent = match[0]
          span.className = 'article-audio-word'
          span.dataset.audioWordIndex = String(elements.length)
          elements.push(span)
          texts.push(normalizeWordText(match[0]))
          fragment.append(span)
          lastIndex = match.index + match[0].length
        }

        if (lastIndex < text.length) {
          fragment.append(text.slice(lastIndex))
        }

        textNode.parentNode?.replaceChild(fragment, textNode)
      }

      node.dataset.audioPrepared = 'true'
    }

    return { elements, texts }
  }, [])

  const syncBundle = React.useCallback(
    (nextBundle: ArticleAudioBundle | null) => {
      setBundle(nextBundle)
      if (nextBundle) {
        setStatus('ready')
        setError(null)
        return
      }

      setStatus(canGenerate ? 'idle' : 'hidden')
    },
    [canGenerate]
  )

  const lookupBundle = React.useCallback(async () => {
    const response = await fetch(
      `/api/article-audio?pageId=${encodeURIComponent(pageId)}`,
      {
        method: 'GET'
      }
    )
    const data = (await response.json()) as ArticleAudioLookupResponse
    return data
  }, [pageId])

  const generateBundle = React.useCallback(async () => {
    const response = await fetch('/api/article-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pageId })
    })
    const data = (await response.json()) as ArticleAudioResponse & {
      error?: string
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate article audio.')
    }

    return data
  }, [pageId])

  React.useEffect(() => {
    let cancelled = false

    const boot = async () => {
      try {
        const data = await lookupBundle()
        if (cancelled) return

        setCanGenerate(data.canGenerate)
        setJobStatus(data.jobStatus || 'idle')

        if (!data.available || !data.audioUrl || !data.alignment) {
          setStatus(
            data.jobStatus === 'running'
              ? 'generating'
              : data.canGenerate
                ? 'idle'
                : 'hidden'
          )
          setError(data.jobError || data.error || null)
          return
        }

        setBundle({
          audioUrl: data.audioUrl,
          alignment: data.alignment,
          contentHash: data.contentHash || '',
          transcriptVersion: data.transcriptVersion || 1
        })
        setStatus('ready')
      } catch (error: any) {
        if (cancelled) return
        setStatus('error')
        setError(error?.message || 'Failed to check article audio.')
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [lookupBundle])

  React.useEffect(() => {
    if (jobStatus !== 'running' || bundle) {
      return
    }

    let cancelled = false
    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const data = await lookupBundle()
          if (cancelled) return

          setCanGenerate(data.canGenerate)
          setJobStatus(data.jobStatus || 'idle')

          if (data.available && data.audioUrl && data.alignment) {
            syncBundle({
              audioUrl: data.audioUrl,
              alignment: data.alignment,
              contentHash: data.contentHash || '',
              transcriptVersion: data.transcriptVersion || 1
            })
            return
          }

          if (data.jobStatus === 'failed') {
            setStatus('error')
            setError(data.jobError || 'Audio generation failed.')
          }
        } catch (pollError: any) {
          if (cancelled) return
          setStatus('error')
          setError(pollError?.message || 'Failed to refresh article audio.')
        }
      })()
    }, LOOKUP_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [bundle, jobStatus, lookupBundle, syncBundle])

  React.useEffect(() => {
    if (!bundle || isPrepared) return

    const { elements, texts } = prepareArticleWordSpans()
    wordRefs.current = elements
    wordTextsRef.current = texts

    const alignWords = bundle.alignment.words


    // Pre-compute a monotone alignment-word → DOM-span index map.
    const map: number[] = new Array(alignWords.length).fill(-1)
    let domPtr = 0
    let missCount = 0
    for (let ai = 0; ai < alignWords.length; ai++) {
      const target = normalizeWordText(alignWords[ai].text)
      if (!target) continue

      const limit = Math.min(texts.length, domPtr + 20)
      for (let di = domPtr; di < limit; di++) {
        if (texts[di] === target) {
          map[ai] = di
          domPtr = di + 1
          break
        }
      }
      if (map[ai] === -1 && domPtr < texts.length) {
        missCount++
        if (missCount <= 30) {
          console.warn(`[AudioSync] MISS ai=${ai} "${alignWords[ai].text}" (norm="${target}") domPtr=${domPtr} window=[${texts.slice(domPtr, domPtr + 10).join(',')}]`)
        }
        domPtr++
      }
    }
    alignToDomRef.current = map

    // -- DEBUG: check monotonicity and log violations --
    let prevDom = -1
    for (let ai = 0; ai < map.length; ai++) {
      if (map[ai] !== -1) {
        if (map[ai] < prevDom) {
          console.error(`[AudioSync] NON-MONOTONE! ai=${ai} "${alignWords[ai].text}" domIdx=${map[ai]} < prev=${prevDom}`)
        }
        prevDom = map[ai]
      }
    }
    console.log(`[AudioSync] Map built. Misses: ${missCount}, Final domPtr: ${domPtr}/${texts.length}`)

    setIsPrepared(true)
  }, [bundle, isPrepared, prepareArticleWordSpans])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio || !bundle) return

    const updateActiveWord = () => {
      const currentTime = audio.currentTime
      const words = bundle.alignment.words

      let foundIdx = -1
      const startSearchAt = Math.max(0, lastAlignIdxRef.current)
      
      // 1. Monotonic Forward Search
      for (let i = startSearchAt; i < words.length; i++) {
        const word = words[i]
        if (currentTime >= word.start && currentTime <= word.end + 0.1) {
          foundIdx = i
          // Keep searching to find the *latest* matching word in case of overlaps
        } else if (word.start > currentTime + 0.5) {
          break
        }
      }

      // 2. Silent Backward Jump Detection
      // If we found nothing forward, but our currentTime is significantly BEFORE
      // the word we were tracking, the audio jumped backward natively (e.g. loop).
      if (foundIdx === -1 && startSearchAt < words.length) {
        if (currentTime < words[startSearchAt].start - 0.5) {
          // Perform a full search from 0
          for (let i = 0; i < words.length; i++) {
            const word = words[i]
            if (currentTime >= word.start && currentTime <= word.end + 0.1) {
              foundIdx = i
              break
            }
          }
        }
      }

      if (foundIdx !== -1) {
        lastAlignIdxRef.current = foundIdx
        const domIdx = alignToDomRef.current[foundIdx]
        if (domIdx !== -1 && domIdx !== undefined) {
          setActiveWordIndex((prev) => {
            if (prev !== -1 && domIdx < prev) {
              console.error(`🚨 [AudioSync Jump] Backward jump detected!`, {
                currentTime,
                prevDomIdx: prev,
                newDomIdx: domIdx,
                foundIdx,
                wordText: words[foundIdx].text,
                wordStart: words[foundIdx].start,
                wordEnd: words[foundIdx].end,
              });
            }
            return prev === domIdx ? prev : domIdx
          })
        }
      }
    }

    const handleEnded = () => {
      setStatus('ready')
      setActiveWordIndex(-1)
      lastAlignIdxRef.current = -1
      lastTimeRef.current = 0
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      updateActiveWord()
    }

    const handleSeeked = () => {
      // Force a re-sync on explicit seek
      lastAlignIdxRef.current = -1
      updateActiveWord()
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('seeked', handleSeeked)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('seeked', handleSeeked)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [bundle])

  React.useEffect(() => {
    // 1. Remove active class from all currently highlighted words
    document
      .querySelectorAll('.article-audio-word-active')
      .forEach((el) => el.classList.remove('article-audio-word-active'))

    if (activeWordIndex < 0) return

    // 2. Find the exact word element directly from the live DOM
    const activeElement = document.querySelector(
      `[data-audio-word-index="${activeWordIndex}"]`
    )
    if (!activeElement) return

    // 3. Add the active class
    activeElement.classList.add('article-audio-word-active')

    // 4. Handle smooth auto-scrolling
    const now = Date.now()
    const rect = activeElement.getBoundingClientRect()
    const topThreshold = 120
    const bottomThreshold = window.innerHeight - 180
    const outOfView = rect.top < topThreshold || rect.bottom > bottomThreshold

    if (outOfView && now - lastAutoScrollRef.current > 500) {
      lastAutoScrollRef.current = now
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
    }
  }, [activeWordIndex])

  const playBundle = React.useCallback(async () => {
    if (!bundle) return

    const audio = audioRef.current
    if (!audio) return

    if (audio.src !== bundle.audioUrl) {
      audio.src = bundle.audioUrl
    }

    await audio.play()
    setStatus('playing')
  }, [bundle])

  const handlePlay = React.useCallback(async () => {
    try {
      setError(null)
      if (!bundle) {
        setStatus('loading')
        const data = await lookupBundle()
        setCanGenerate(data.canGenerate)

        if (!data.available || !data.audioUrl || !data.alignment) {
          setStatus(data.canGenerate ? 'idle' : 'hidden')
          return
        }

        const nextBundle = {
          audioUrl: data.audioUrl,
          alignment: data.alignment,
          contentHash: data.contentHash || '',
          transcriptVersion: data.transcriptVersion || 1
        }

        setBundle(nextBundle)
        const audio = audioRef.current
        if (!audio) return
        if (audio.src !== nextBundle.audioUrl) {
          audio.src = nextBundle.audioUrl
        }
        await audio.play()
        setStatus('playing')
        return
      }

      await playBundle()
    } catch (error: any) {
      setStatus('error')
      setError(error?.message || 'Failed to play article audio.')
    }
  }, [bundle, lookupBundle, playBundle])

  const handleGenerate = React.useCallback(async () => {
    try {
      setStatus('generating')
      setError(null)
      setJobStatus('running')
      const generated = await generateBundle()
      if (
        generated.audioUrl &&
        generated.alignment &&
        generated.status !== 'queued' &&
        generated.status !== 'running'
      ) {
        syncBundle({
          audioUrl: generated.audioUrl,
          alignment: generated.alignment,
          contentHash: generated.contentHash,
          transcriptVersion: generated.transcriptVersion
        })
        return
      }

      setStatus('generating')
    } catch (error: any) {
      setStatus('error')
      setError(error?.message || 'Failed to generate article audio.')
    }
  }, [generateBundle, syncBundle])

  const handlePause = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setStatus('paused')
  }, [])

  const handleResume = React.useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    await audio.play()
    setStatus('playing')
  }, [])

  const handleStop = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setStatus(bundle ? 'ready' : canGenerate ? 'idle' : 'hidden')
    setActiveWordIndex(-1)
  }, [bundle, canGenerate])

  if (status === 'booting' || status === 'hidden') {
    return null
  }

  return (
    <>
      <audio ref={audioRef} preload='none' />
      <div className='article-audio-player glass'>
        <div className='article-audio-player__copy'>
          <strong>Listen to this article</strong>
          <span>
            {status === 'generating'
              ? 'Generating audio locally in the background and uploading it to cache...'
              : status === 'loading'
                ? 'Checking whether this article already has audio...'
                  : status === 'playing'
                    ? '' // Subtitle removed for more progress bar space
                  : bundle
                    ? ''
                    : canGenerate
                      ? 'This article has no cached audio yet. Generate it locally when you need it.'
                      : 'Audio is not available for this article yet.'}
          </span>
          {error && (
            <span className='article-audio-player__error'>{error}</span>
          )}
        </div>

        {bundle && (
          <div className='article-audio-player__progress-container'>
            <div className='article-audio-player__progress-wrapper'>
              <span className='article-audio-player__time'>
                {formatTime(currentTime)}
              </span>
              <input
                type='range'
                className='article-audio-player__progress'
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setCurrentTime(val)
                  if (audioRef.current) {
                    audioRef.current.currentTime = val
                  }
                }}
              />
              <span className='article-audio-player__time'>
                {formatTime(duration)}
              </span>
            </div>
          </div>
        )}

        <div className='article-audio-player__controls'>
          {!bundle && canGenerate && (
            <button
              type='button'
              className='article-audio-player__button primary'
              onClick={handleGenerate}
              disabled={status === 'generating'}
            >
              <IoRefreshSharp />
              <span>
                {status === 'generating' ? 'Generating...' : 'Generate audio'}
              </span>
            </button>
          )}

          {bundle &&
            (status === 'idle' ||
              status === 'ready' ||
              status === 'error' ||
              status === 'loading') && (
              <button
                type='button'
                className='article-audio-player__button primary'
                onClick={handlePlay}
              >
                <IoPlaySharp />
                <span>Play</span>
              </button>
            )}

          {status === 'playing' && (
            <button
              type='button'
              className='article-audio-player__button'
              onClick={handlePause}
            >
              <IoPauseSharp />
              <span>Pause</span>
            </button>
          )}

          {status === 'paused' && (
            <button
              type='button'
              className='article-audio-player__button primary'
              onClick={handleResume}
            >
              <IoPlaySharp />
              <span>Resume</span>
            </button>
          )}

          {(status === 'playing' || status === 'paused') && (
            <button
              type='button'
              className='article-audio-player__button'
              onClick={handleStop}
            >
              <IoStopSharp />
              <span>Stop</span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}

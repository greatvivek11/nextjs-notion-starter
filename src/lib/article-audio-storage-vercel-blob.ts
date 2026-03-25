import { head, put } from '@vercel/blob'
import type { ArticleAudioMetadata } from './article-audio'
import { getAudioBundlePath } from './article-audio'
import {
  type ArticleAudioStorage,
  type StoredArticleAudioBundle
} from './article-audio-storage'

export class VercelBlobArticleAudioStore implements ArticleAudioStorage {
  constructor(private readonly token: string) {
    // Token is stored for exact-path Blob operations.
  }

  async getBundle({
    pageId,
    contentHash
  }: {
    pageId: string
    contentHash: string
  }): Promise<StoredArticleAudioBundle | null> {
    const basePath = getAudioBundlePath(pageId, contentHash)
    const audioPath = `${basePath}/audio.wav`
    const metadataPath = `${basePath}/alignment.json`

    try {
      const [audioHead, metadataHead] = await Promise.all([
        head(audioPath, { token: this.token }),
        head(metadataPath, { token: this.token })
      ])

      const metadata = (await fetch(metadataHead.url).then((res) =>
        res.json()
      )) as ArticleAudioMetadata

      return {
        audioUrl: audioHead.url,
        metadata
      }
    } catch (error) {
      return null
    }
  }

  async putBundle({
    pageId,
    contentHash,
    audio,
    metadata
  }: {
    pageId: string
    contentHash: string
    audio: Blob
    metadata: ArticleAudioMetadata
  }): Promise<StoredArticleAudioBundle> {
    const basePath = getAudioBundlePath(pageId, contentHash)
    const audioPath = `${basePath}/audio.wav`
    const metadataPath = `${basePath}/alignment.json`

    const [audioBlob, metadataBlob] = await Promise.all([
      put(audioPath, audio, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'audio/wav',
        token: this.token
      }),
      put(metadataPath, JSON.stringify(metadata), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'application/json',
        token: this.token
      })
    ])

    return {
      audioUrl: audioBlob.url,
      metadata
    }
  }
}

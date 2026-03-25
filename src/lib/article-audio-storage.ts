import type { ArticleAudioMetadata } from './article-audio'
import { getEnv } from './get-config-value'

export interface StoredArticleAudioBundle {
  audioUrl: string
  metadata: ArticleAudioMetadata
}

export interface ArticleAudioStorage {
  getBundle(params: {
    pageId: string
    contentHash: string
  }): Promise<StoredArticleAudioBundle | null>
  putBundle(params: {
    pageId: string
    contentHash: string
    audio: Blob
    metadata: ArticleAudioMetadata
  }): Promise<StoredArticleAudioBundle>
}

export function createArticleAudioStorage(): ArticleAudioStorage {
  const provider = process.env.AUDIO_STORAGE_PROVIDER || 'vercel-blob'

  switch (provider) {
    case 'vercel-blob': {
      const {
        VercelBlobArticleAudioStore
      } = require('./article-audio-storage-vercel-blob')
      return new VercelBlobArticleAudioStore(getEnv('BLOB_READ_WRITE_TOKEN'))
    }
    default:
      throw new Error(
        `Unsupported AUDIO_STORAGE_PROVIDER "${provider}". Expected "vercel-blob".`
      )
  }
}

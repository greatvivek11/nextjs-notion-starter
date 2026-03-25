import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { promisify } from 'util'
import os from 'os'

import type {
  ArticleAudioAlignment,
  ArticleAudioMetadata,
  ArticleTranscript
} from './article-audio'

const execFileAsync = promisify(execFile)

export interface LocalArticleAudioResult {
  audio: Blob
  metadata: ArticleAudioMetadata
}

export interface LocalArticleAudioJobStatus {
  status: 'idle' | 'running' | 'failed'
  updatedAt: string
  error?: string
}

export function canGenerateArticleAudioLocally() {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV
}

export function getKokoroWorkspaceRoot() {
  // Use a hidden folder in the user's home directory to avoid Next.js build/Turbopack issues
  // with symlinks pointing outside the project root.
  return path.join(os.homedir(), '.notion-audio-kokoro')
}

function getLocalArticleJobDir(pageId: string, contentHash: string) {
  return path.join(getKokoroWorkspaceRoot(), 'jobs', pageId, contentHash)
}

function getLocalArticleJobStatusPath(pageId: string, contentHash: string) {
  return path.join(
    getLocalArticleJobDir(pageId, contentHash),
    'job-status.json'
  )
}

function getKokoroPythonPath() {
  return path.join(getKokoroWorkspaceRoot(), '.venv', 'bin', 'python3')
}

function getMlxPythonPath() {
  return path.join(getKokoroWorkspaceRoot(), '.venv-mlx', 'bin', 'python3')
}

function getMlxScriptPath() {
  return path.join(
    process.cwd(),
    'tools',
    'kokoro',
    'generate_article_audio_mlx.py'
  )
}

function getCoremlScriptPath() {
  return path.join(
    process.cwd(),
    'tools',
    'kokoro',
    'generate_article_audio_coreml.py'
  )
}

function getAlignmentScriptPath() {
  return path.join(process.cwd(), 'tools', 'kokoro', 'align_article_audio.py')
}

function getConcatScriptPath() {
  return path.join(process.cwd(), 'tools', 'kokoro', 'concat_audio_chunks.py')
}

function getLegacyGeneratorScriptPath() {
  return path.join(
    process.cwd(),
    'tools',
    'kokoro',
    'generate_article_audio.py'
  )
}

function getLocalTtsBackend() {
  const backend = process.env.LOCAL_TTS_BACKEND || 'mlx-audio'

  if (backend === 'mlx-audio') {
    return backend
  }

  throw new Error(
    `Unsupported LOCAL_TTS_BACKEND "${backend}". Only "mlx-audio" is supported in the refined workflow.`
  )
}

function getPreferredWhisperDevice() {
  if (process.env.KOKORO_WHISPERX_DEVICE) {
    return process.env.KOKORO_WHISPERX_DEVICE
  }

  return process.platform === 'darwin' ? 'mps' : 'cpu'
}

export async function generateArticleAudioLocally({
  pageId,
  transcriptData
}: {
  pageId: string
  transcriptData: ArticleTranscript
}): Promise<LocalArticleAudioResult> {
  if (!canGenerateArticleAudioLocally()) {
    throw new Error('Local audio generation is only available in development.')
  }

  const workspaceRoot = getKokoroWorkspaceRoot()
  const jobsDir = path.join(
    workspaceRoot,
    'jobs',
    pageId,
    transcriptData.contentHash
  )
  const transcriptPath = path.join(jobsDir, 'transcript.txt')
  const audioPath = path.join(jobsDir, 'audio.wav')
  const alignmentPath = path.join(jobsDir, 'alignment.json')
  const segmentsPath = path.join(jobsDir, 'segments.json')

  await fs.mkdir(jobsDir, { recursive: true })
  await fs.writeFile(transcriptPath, transcriptData.transcript, 'utf8')

  const voice = process.env.KOKORO_VOICE || 'af_heart'
  const language = process.env.KOKORO_LANGUAGE || 'a'
  const alignmentLanguage = process.env.KOKORO_ALIGNMENT_LANGUAGE || 'en'
  const alignModelName = process.env.KOKORO_WHISPERX_ALIGN_MODEL || ''
  const whisperDevice = getPreferredWhisperDevice()
  const preferredBackend = getLocalTtsBackend()

  try {
    await generateWithSelectedBackend({
      pageId,
      transcriptPath,
      audioPath,
      alignmentPath,
      voice,
      language,
      alignmentLanguage,
      alignModelName,
      whisperDevice,
      backend: preferredBackend
    })
  } catch (error: any) {
    if (preferredBackend === 'kokoro-coreml') {
      console.warn(
        `[Article Audio] CoreML-backed generation failed for page ${pageId}. Falling back to the Python Kokoro backend.`
      )
      try {
        await generateWithSelectedBackend({
          pageId,
          transcriptPath,
          audioPath,
          alignmentPath,
          voice,
          language,
          alignmentLanguage,
          alignModelName,
          whisperDevice,
          backend: 'kokoro'
        })
      } catch (fallbackError: any) {
        throw normalizeGeneratorError(fallbackError)
      }
    } else {
      throw normalizeGeneratorError(error)
    }
  }

  return finalizeLocalAudioResult({
    pageId,
    transcriptData,
    audioPath,
    alignmentPath
  })
}

export async function readLocalArticleAudioJobStatus({
  pageId,
  contentHash
}: {
  pageId: string
  contentHash: string
}): Promise<LocalArticleAudioJobStatus | null> {
  try {
    const raw = await fs.readFile(
      getLocalArticleJobStatusPath(pageId, contentHash),
      'utf8'
    )
    return JSON.parse(raw) as LocalArticleAudioJobStatus
  } catch {
    return null
  }
}

export async function writeLocalArticleAudioJobStatus({
  pageId,
  contentHash,
  status,
  error
}: {
  pageId: string
  contentHash: string
  status: LocalArticleAudioJobStatus['status']
  error?: string
}) {
  const jobDir = getLocalArticleJobDir(pageId, contentHash)
  await fs.mkdir(jobDir, { recursive: true })
  await fs.writeFile(
    getLocalArticleJobStatusPath(pageId, contentHash),
    JSON.stringify(
      {
        status,
        updatedAt: new Date().toISOString(),
        error
      } satisfies LocalArticleAudioJobStatus,
      null,
      2
    ),
    'utf8'
  )
}

async function finalizeLocalAudioResult({
  pageId,
  transcriptData,
  audioPath,
  alignmentPath
}: {
  pageId: string
  transcriptData: ArticleTranscript
  audioPath: string
  alignmentPath: string
}): Promise<LocalArticleAudioResult> {
  const [audioBuffer, alignmentBuffer] = await Promise.all([
    fs.readFile(audioPath),
    fs.readFile(alignmentPath, 'utf8')
  ])

  const alignment = JSON.parse(alignmentBuffer) as ArticleAudioAlignment
  const metadata: ArticleAudioMetadata = {
    pageId,
    contentHash: transcriptData.contentHash,
    transcriptVersion: transcriptData.transcriptVersion,
    generatedAt: new Date().toISOString(),
    transcript: transcriptData.transcript,
    alignment
  }

  return {
    audio: new Blob([audioBuffer], { type: 'audio/wav' }),
    metadata
  }
}

async function generateWithSelectedBackend({
  pageId,
  transcriptPath,
  audioPath,
  alignmentPath,
  voice,
  language,
  alignmentLanguage,
  alignModelName,
  whisperDevice,
  backend
}: {
  pageId: string
  transcriptPath: string
  audioPath: string
  alignmentPath: string
  voice: string
  language: string
  alignmentLanguage: string
  alignModelName: string
  whisperDevice: string
  backend: string
}) {
  const startedAt = Date.now()
  console.info(
    `[Article Audio] Starting local generation for page ${pageId} with backend "${backend}" and WhisperX device "${whisperDevice}".`
  )

  if (backend === 'mlx-audio') {
    const jobsDir = path.dirname(audioPath)
    const segmentsPath = path.join(jobsDir, 'segments.json')
    
    await runMlxAudioGeneration({
      transcriptPath,
      audioPath,
      alignmentPath,
      voice,
      language,
      alignmentLanguage,
      alignModelName,
      whisperDevice,
      segmentsPath
    })
  } else {
    throw new Error(
      `Unsupported LOCAL_TTS_BACKEND "${backend}". MLX-Audio is the primary and only supported backend.`
    )
  }

  const durationInSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.info(
    `[Article Audio] Local generation for page ${pageId} completed in ${durationInSeconds}s using backend "${backend}".`
  )
}

async function runMlxAudioGeneration({
  transcriptPath,
  audioPath,
  alignmentPath,
  voice,
  language,
  alignmentLanguage,
  alignModelName,
  whisperDevice,
  segmentsPath
}: {
  transcriptPath: string
  audioPath: string
  alignmentPath: string
  voice: string
  language: string
  alignmentLanguage: string
  alignModelName: string
  whisperDevice: string
  segmentsPath: string
}) {
  const pythonPath = getMlxPythonPath()

  try {
    await fs.access(pythonPath)
  } catch {
    throw new Error(
      'MLX-Audio is not set up yet. Run `npm run audio:setup-mlx` first.'
    )
  }

  const speed = process.env.KOKORO_SPEED || '1.0'

  await runGeneratorCommand({
    pythonPath,
    scriptPath: getMlxScriptPath(),
    args: [
      '--transcript-file',
      transcriptPath,
      '--output-audio-file',
      audioPath,
      '--output-segments-file',
      segmentsPath,
      '--voice',
      voice,
      '--language-code',
      language,
      '--speed',
      speed
    ]
  })

  // Run WhisperX alignment after MLX synthesis
  await runAlignmentOnly({
    audioPath,
    transcriptPath,
    alignmentPath,
    alignmentLanguage,
    alignModelName,
    whisperDevice,
    segmentsPath
  })
}

// No changes needed here, just removing everything between runMlxAudioGeneration end and runAlignmentOnly start if I can
// Actually I'll just target the functions directly below.


async function runAlignmentOnly({
  audioPath,
  transcriptPath,
  alignmentPath,
  alignmentLanguage,
  alignModelName,
  whisperDevice,
  segmentsPath
}: {
  audioPath: string
  transcriptPath: string
  alignmentPath: string
  alignmentLanguage: string
  alignModelName: string
  whisperDevice: string
  segmentsPath?: string
}) {
  const pythonPath = getKokoroPythonPath()

  try {
    await fs.access(pythonPath)
  } catch {
    throw new Error(
      'WhisperX alignment is not set up yet. Run `npm run audio:setup-kokoro` first.'
    )
  }

  try {
    await runGeneratorCommand({
      pythonPath,
      scriptPath: getAlignmentScriptPath(),
      args: [
        '--transcript-file',
        transcriptPath,
        '--input-audio-file',
        audioPath,
        '--output-alignment-file',
        alignmentPath,
        '--segments-file',
        segmentsPath || '',
        '--alignment-language',
        alignmentLanguage,
        '--align-model-name',
        alignModelName,
        '--whisper-device',
        whisperDevice
      ]
    })
  } catch (error: any) {
    if (whisperDevice !== 'mps') {
      throw error
    }

    console.warn(
      '[Article Audio] WhisperX MPS alignment failed after synthesis. Retrying alignment on CPU.'
    )
    await runGeneratorCommand({
      pythonPath,
      scriptPath: getAlignmentScriptPath(),
      args: [
        '--transcript-file',
        transcriptPath,
        '--input-audio-file',
        audioPath,
        '--output-alignment-file',
        alignmentPath,
        '--segments-file',
        segmentsPath || '',
        '--alignment-language',
        alignmentLanguage,
        '--align-model-name',
        alignModelName,
        '--whisper-device',
        'cpu'
      ]
    })
  }
}

async function runGeneratorCommand({
  pythonPath,
  scriptPath,
  args,
  cwd
}: {
  pythonPath: string
  scriptPath: string
  args: string[]
  cwd?: string
}) {
  const result = await execFileAsync(pythonPath, [scriptPath, ...args], {
    cwd: cwd || process.cwd(),
    env: {
      ...process.env,
      PYTORCH_ENABLE_MPS_FALLBACK: '1'
    },
    maxBuffer: 1024 * 1024 * 20
  })

  if (result.stdout?.trim()) {
    console.info(result.stdout.trim())
  }
}

function normalizeGeneratorError(error: any) {
  const stderr = error?.stderr?.toString?.().trim()
  const stdout = error?.stdout?.toString?.().trim()

  return new Error(
    stderr ||
      stdout ||
      error?.message ||
      'Local article audio generation failed.'
  )
}

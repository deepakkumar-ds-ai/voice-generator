import * as ort from 'onnxruntime-web/wasm'
import phonemizerDataUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.data?url'
import phonemizerScriptUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.js?url'
import phonemizerWasmUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.wasm?url'
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

export type PiperHindiVoice = 'pratham' | 'priyamvada'

interface PiperVoiceConfig {
  audio: {
    sample_rate: number
  }
  espeak: {
    voice: string
  }
  inference: {
    noise_scale: number
    length_scale: number
    noise_w: number
  }
  phoneme_id_map: Record<string, number[]>
}

interface LoadedPiperVoice {
  voice: PiperHindiVoice
  config: PiperVoiceConfig
  session: ort.InferenceSession
}

interface DownloadProgress {
  loaded: number
  total: number | null
}

interface PiperPhonemizeModule {
  callMain(args: string[]): number
}

interface PiperPhonemizeOptions {
  locateFile(path: string): string
  print(message: string): void
  printErr(message: string): void
}

type PiperPhonemizeFactory = (options: PiperPhonemizeOptions) => Promise<PiperPhonemizeModule>

const MODEL_ROOT = 'https://huggingface.co/PravalX/piper-voices/resolve/main/hi/hi_IN'
const VOICE_PATHS: Record<PiperHindiVoice, string> = {
  pratham: 'pratham/medium/hi_IN-pratham-medium',
  priyamvada: 'priyamvada/medium/hi_IN-priyamvada-medium',
}

let phonemizerModule: PiperPhonemizeModule | null = null
let phonemizerPromise: Promise<PiperPhonemizeModule> | null = null
let phonemizerOutput: string[] = []
let phonemizerErrors: string[] = []
let loadedVoice: LoadedPiperVoice | null = null
let voiceLoadPromise: Promise<LoadedPiperVoice> | null = null
let voiceLoadPromiseVoice: PiperHindiVoice | null = null
let voiceDisposePromise: Promise<void> | null = null

ort.env.wasm.numThreads = 1
ort.env.wasm.wasmPaths = { wasm: ortWasmUrl }

function isPiperVoiceConfig(value: unknown): value is PiperVoiceConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<PiperVoiceConfig>
  return typeof config.audio?.sample_rate === 'number'
    && typeof config.espeak?.voice === 'string'
    && typeof config.inference?.noise_scale === 'number'
    && typeof config.inference?.length_scale === 'number'
    && typeof config.inference?.noise_w === 'number'
    && !!config.phoneme_id_map
    && typeof config.phoneme_id_map === 'object'
}

async function fetchModel(url: string, onProgress?: (progress: DownloadProgress) => void) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download Hindi voice model (${response.status}).`)

  const totalHeader = response.headers.get('content-length')
  const total = totalHeader ? Number(totalHeader) : null
  if (!response.body) {
    const data = await response.arrayBuffer()
    onProgress?.({ loaded: data.byteLength, total })
    return data
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.byteLength
      onProgress?.({ loaded, total })
    }
  }

  const model = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    model.set(chunk, offset)
    offset += chunk.byteLength
  }
  return model.buffer
}

async function getPhonemizer() {
  if (phonemizerModule) return phonemizerModule
  if (!phonemizerPromise) {
    phonemizerPromise = (async () => {
      const existingFactory = (window as Window & {
        createPiperPhonemize?: PiperPhonemizeFactory
      }).createPiperPhonemize

      if (!existingFactory) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = phonemizerScriptUrl
          script.async = true
          script.onload = () => {
            script.remove()
            resolve()
          }
          script.onerror = () => {
            script.remove()
            reject(new Error('Could not load the Hindi phonemizer runtime.'))
          }
          document.head.append(script)
        })
      }

      const factory = (window as Window & {
        createPiperPhonemize?: PiperPhonemizeFactory
      }).createPiperPhonemize
      if (!factory) throw new Error('The Hindi phonemizer runtime did not initialize.')

      return factory({
        locateFile: (path) => {
          if (path.endsWith('.wasm')) return phonemizerWasmUrl
          if (path.endsWith('.data')) return phonemizerDataUrl
          return path
        },
        print: (message) => phonemizerOutput.push(message),
        printErr: (message) => phonemizerErrors.push(message),
      })
    })()
  }

  try {
    phonemizerModule = await phonemizerPromise
    return phonemizerModule
  } catch (error) {
    phonemizerPromise = null
    throw error
  }
}

function readPhonemeIds(lines: string[]) {
  for (const line of lines) {
    try {
      const result: unknown = JSON.parse(line)
      const records = Array.isArray(result) ? result : [result]
      for (const record of records) {
        if (!record || typeof record !== 'object') continue
        const ids = (record as { phoneme_ids?: unknown }).phoneme_ids
        if (Array.isArray(ids) && ids.every((id) => Number.isInteger(id))) return ids as number[]
      }
    } catch {
      // The phonemizer may write non-JSON diagnostic lines to stdout.
    }
  }
  throw new Error(phonemizerErrors[phonemizerErrors.length - 1] || 'The Hindi phonemizer returned no phoneme IDs.')
}

function phonemize(text: string, language: string) {
  const module = phonemizerModule
  if (!module) throw new Error('The Hindi phonemizer runtime is not ready.')

  phonemizerOutput = []
  phonemizerErrors = []
  const exitCode = module.callMain([
    '-l',
    language,
    '--input',
    JSON.stringify([{ text }]),
    '--espeak_data',
    '/espeak-ng-data',
  ])
  if (exitCode !== 0) {
    throw new Error(phonemizerErrors[phonemizerErrors.length - 1] || 'Hindi text could not be phonemized.')
  }
  return readPhonemeIds(phonemizerOutput)
}

export async function loadPiperHindiVoice(
  voice: PiperHindiVoice,
  onProgress?: (progress: DownloadProgress) => void,
) {
  if (loadedVoice?.voice === voice) return loadedVoice
  if (voiceLoadPromise) {
    if (voiceLoadPromiseVoice === voice) return voiceLoadPromise
    await voiceLoadPromise.catch(() => undefined)
  }

  await disposePiperHindiVoice()
  voiceLoadPromiseVoice = voice
  const path = VOICE_PATHS[voice]
  const nextLoad = (async () => {
    const configResponse = await fetch(`${MODEL_ROOT}/${path}.onnx.json`)
    if (!configResponse.ok) throw new Error(`Could not download Hindi voice settings (${configResponse.status}).`)

    const configData: unknown = await configResponse.json()
    if (!isPiperVoiceConfig(configData)) throw new Error('The Hindi voice model has invalid settings.')
    const modelData = await fetchModel(`${MODEL_ROOT}/${path}.onnx`, onProgress)
    await getPhonemizer()
    const session = await ort.InferenceSession.create(modelData, {
      executionProviders: ['wasm'],
    })
    const voiceModel = { voice, config: configData, session }
    loadedVoice = voiceModel
    return voiceModel
  })()
  voiceLoadPromise = nextLoad

  try {
    return await nextLoad
  } catch (error) {
    voiceLoadPromise = null
    voiceLoadPromiseVoice = null
    throw error
  } finally {
    if (voiceLoadPromise === nextLoad) {
      voiceLoadPromise = null
      voiceLoadPromiseVoice = null
    }
  }
}

export async function synthesizePiperHindi(text: string, voice: LoadedPiperVoice) {
  const phonemeIds = phonemize(text, voice.config.espeak.voice)
  const startId = voice.config.phoneme_id_map['^']?.[0]
  const endId = voice.config.phoneme_id_map['$']?.[0]
  if (startId === undefined || endId === undefined) {
    throw new Error('The Hindi voice model is missing its phoneme boundary settings.')
  }

  const inputIds = [startId, ...phonemeIds, endId]
  const output = await voice.session.run({
    input: new ort.Tensor('int64', BigInt64Array.from(inputIds, BigInt), [1, inputIds.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.of(BigInt(inputIds.length)), [1]),
    scales: new ort.Tensor('float32', Float32Array.of(
      voice.config.inference.noise_scale,
      voice.config.inference.length_scale,
      voice.config.inference.noise_w,
    ), [3]),
  })

  const audio = output.output?.data
  if (!(audio instanceof Float32Array) || !audio.length) {
    throw new Error('The Hindi voice model did not produce any audio.')
  }
  return { audio, sampleRate: voice.config.audio.sample_rate }
}

export async function disposePiperHindiVoice() {
  const currentVoice = loadedVoice
  loadedVoice = null
  if (!currentVoice) {
    await voiceDisposePromise
    return
  }

  const releasePromise = currentVoice.session.release()
  voiceDisposePromise = releasePromise
  try {
    await releasePromise
  } finally {
    if (voiceDisposePromise === releasePromise) voiceDisposePromise = null
  }
}

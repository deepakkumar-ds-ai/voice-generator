import { useEffect, useRef, useState } from 'react'
import { Download, Sparkles } from 'lucide-react'
import { chunksToWavBlob } from 'pocket-tts-js'
import type { TextToAudioPipeline } from '@huggingface/transformers'
import { useI18n } from '../i18n'
import { containsDevanagariText, splitIntoSpeechChunks } from '../utils/text'
import {
  disposePiperHindiVoice,
  loadPiperHindiVoice,
  synthesizePiperHindi,
  type PiperHindiVoice,
} from '../utils/piperHindi'

const MODEL_ID = 'Xenova/mms-tts-hin'
const MAX_TEXT_LENGTH = 10_000
const MAX_CHUNK_LENGTH = 220
type HindiVoice = 'mms' | PiperHindiVoice

interface HindiSpeechGeneratorProps {
  text: string
  rate: number
  volume: number
}

interface GenerationProgress {
  completedChunks: number
  totalChunks: number
  audioSeconds: number
}

export function HindiSpeechGenerator({ text, rate, volume }: HindiSpeechGeneratorProps) {
  const { t } = useI18n()
  const synthesizerRef = useRef<TextToAudioPipeline | null>(null)
  const loadPromiseRef = useRef<Promise<TextToAudioPipeline> | null>(null)
  const lastModelProgressRef = useRef(-1)
  const [selectedVoice, setSelectedVoice] = useState<HindiVoice>('mms')
  const [loadingModel, setLoadingModel] = useState(false)
  const [modelProgress, setModelProgress] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    completedChunks: 0,
    totalChunks: 0,
    audioSeconds: 0,
  })
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')
  const hasHindiText = containsDevanagariText(text)

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  useEffect(() => () => {
    synthesizerRef.current?.dispose()
    void disposePiperHindiVoice()
  }, [])

  useEffect(() => {
    if (selectedVoice === 'mms') {
      void disposePiperHindiVoice()
      return
    }

    synthesizerRef.current?.dispose()
    synthesizerRef.current = null
  }, [selectedVoice])

  const loadModel = async () => {
    if (synthesizerRef.current) return synthesizerRef.current
    if (!loadPromiseRef.current) {
      setLoadingModel(true)
      setModelProgress(t('Preparing the Hindi speech model…'))
      lastModelProgressRef.current = -1
      loadPromiseRef.current = (async () => {
        const { pipeline } = await import('@huggingface/transformers')
        return pipeline('text-to-speech', MODEL_ID, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback: (progress) => {
            if (progress.status === 'progress_total') {
              const percent = Math.floor(progress.progress)
              if (percent !== lastModelProgressRef.current) {
                lastModelProgressRef.current = percent
                setModelProgress(`${t('Downloading Hindi model')}: ${percent}%`)
              }
            } else if (progress.status === 'initiate' || progress.status === 'download') {
              setModelProgress(t('Downloading Hindi model…'))
            }
          },
        })
      })()
    }

    const pendingLoad = loadPromiseRef.current
    try {
      const synthesizer = await pendingLoad
      synthesizerRef.current = synthesizer
      setModelProgress(t('Hindi model ready in your browser.'))
      return synthesizer
    } catch (loadError) {
      setModelProgress('')
      throw loadError
    } finally {
      if (loadPromiseRef.current === pendingLoad) loadPromiseRef.current = null
      setLoadingModel(false)
    }
  }

  const generate = async () => {
    const cleanText = text.trim()
    if (!hasHindiText || !cleanText || cleanText.length > MAX_TEXT_LENGTH || generating) return

    const textChunks = splitIntoSpeechChunks(cleanText, MAX_CHUNK_LENGTH)
    if (!textChunks.length) return

    setGenerating(true)
    setError('')
    setAudioUrl('')
    setGenerationProgress({ completedChunks: 0, totalChunks: textChunks.length, audioSeconds: 0 })

    try {
      let synthesizer: TextToAudioPipeline | null = null
      let piperVoice: Awaited<ReturnType<typeof loadPiperHindiVoice>> | null = null
      if (selectedVoice === 'mms') {
        await disposePiperHindiVoice()
        synthesizer = await loadModel()
      } else {
        synthesizerRef.current?.dispose()
        synthesizerRef.current = null
        setLoadingModel(true)
        setModelProgress(t('Preparing the Hindi speech model…'))
        try {
          piperVoice = await loadPiperHindiVoice(selectedVoice, ({ loaded, total }) => {
            const progressLabel = selectedVoice === 'pratham'
              ? t('Downloading Pratham voice model')
              : t('Downloading Priyamvada voice model')
            const progressText = total
              ? `${Math.floor(loaded / total * 100)}%`
              : `${(loaded / 1024 / 1024).toFixed(1)} MB`
            setModelProgress(`${progressLabel}: ${progressText}`)
          })
          setModelProgress(t('Hindi model ready in your browser.'))
        } catch (loadError) {
          setModelProgress('')
          throw loadError
        } finally {
          setLoadingModel(false)
        }
      }

      const audioChunks: Float32Array[] = []
      let sampleRate = piperVoice?.config.audio.sample_rate ?? 0
      let audioSeconds = 0

      for (let index = 0; index < textChunks.length; index += 1) {
        let audio: Float32Array
        let resultSampleRate: number
        if (piperVoice) {
          const result = await synthesizePiperHindi(textChunks[index], piperVoice)
          audio = result.audio
          resultSampleRate = result.sampleRate
        } else {
          if (!synthesizer) throw new Error(t('Hindi speech model is not ready.'))
          const result = await synthesizer(textChunks[index])
          audio = result.data
          resultSampleRate = result.sampling_rate
        }
        if (sampleRate && resultSampleRate !== sampleRate) {
          throw new Error(t('Hindi model returned inconsistent audio sample rates.'))
        }
        sampleRate = resultSampleRate
        if (index > 0) audioChunks.push(new Float32Array(Math.round(sampleRate * 0.18)))
        const audioCopy = audio.slice()
        if (volume !== 1) {
          for (let sample = 0; sample < audioCopy.length; sample += 1) audioCopy[sample] *= volume
        }
        audioChunks.push(audioCopy)
        audioSeconds += audioCopy.length / sampleRate
        if (index > 0) audioSeconds += 0.18
        setGenerationProgress({
          completedChunks: index + 1,
          totalChunks: textChunks.length,
          audioSeconds,
        })
      }

      const wav = chunksToWavBlob(audioChunks, Math.round(sampleRate * rate))
      setAudioUrl(URL.createObjectURL(wav))
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : t('Could not generate Hindi speech.'))
    } finally {
      setGenerating(false)
    }
  }

  if (!hasHindiText) return null

  const progressPercent = generationProgress.totalChunks
    ? Math.round(generationProgress.completedChunks / generationProgress.totalChunks * 100)
    : 0

  return (
    <div className="local-speech hindi-speech">
      <h3>{t('Generate Hindi audio')}</h3>
      <p className="field-note">{t('Generate and download Hindi speech locally as a WAV file.')}</p>
      <label className="local-voice-select">
        <span className="control-label">{t('Hindi voice')}</span>
        <select
          aria-label={t('Hindi voice')}
          value={selectedVoice}
          onChange={(event) => {
            const value = event.currentTarget.value
            if (value === 'mms' || value === 'pratham' || value === 'priyamvada') {
              setSelectedVoice(value)
            }
          }}
          disabled={loadingModel || generating}
        >
          <option value="mms">{t('MMS Hindi (lightweight)')}</option>
          <option value="pratham">{t('Pratham (male)')}</option>
          <option value="priyamvada">{t('Priyamvada (female)')}</option>
        </select>
      </label>
      <button
        className="primary-button clone-generate"
        type="button"
        onClick={() => void generate()}
        disabled={!text.trim() || text.trim().length > MAX_TEXT_LENGTH || generating || loadingModel}
      >
        <Sparkles size={16} />
        {loadingModel ? t('Loading Hindi model…') : generating ? t('Generating Hindi audio…') : t('Generate Hindi WAV')}
      </button>

      {modelProgress && (
        <p className="model-status" role="status" aria-live="polite">{modelProgress}</p>
      )}
      {generating && (
        <div className="generation-progress" role="status" aria-live="polite">
          <span>
            {t('Hindi audio generated so far')}: {formatAudioDuration(generationProgress.audioSeconds)}
            {' · '}{generationProgress.completedChunks}/{generationProgress.totalChunks} {t('text sections')}
          </span>
          <div
            className="generation-progress-track determinate"
            role="progressbar"
            aria-label={t('Hindi audio generation progress')}
            aria-valuemin={0}
            aria-valuemax={generationProgress.totalChunks}
            aria-valuenow={generationProgress.completedChunks}
          >
            <span className="generation-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}
      {error && <p className="clone-error" role="alert">{error}</p>}

      {audioUrl && (
        <div className="clone-result">
          <audio controls src={audioUrl}>{t('Your browser cannot play this audio.')}</audio>
          <a className="secondary-button clone-download" href={audioUrl} download="vocalfree-hindi.wav">
            <Download size={15} /> {t('Download Hindi WAV')}
          </a>
        </div>
      )}

      <p className="clone-footnote">
        {selectedVoice === 'mms'
          ? t('Hindi speech is generated on this device. The quantized model downloads on first use and is cached by your browser.')
          : t('Piper Hindi voices are generated on this device. The 64 MB model, 18 MB phonemizer, and ONNX runtime load on first use.')}
        {' '}
        <a
          href={selectedVoice === 'mms'
            ? 'https://huggingface.co/Xenova/mms-tts-hin'
            : 'https://huggingface.co/PravalX/piper-voices'}
          target="_blank"
          rel="noreferrer"
        >
          {t('Model attribution and license')}
        </a>
        {' · '}
        {selectedVoice === 'mms'
          ? t('CC BY-NC 4.0; non-commercial use only.')
          : t('The source lists a generic CC license; exact terms are unclear. Check before use.')}
      </p>
    </div>
  )
}

function formatAudioDuration(seconds: number) {
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60).toString().padStart(2, '0')
  const remainingSeconds = (wholeSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

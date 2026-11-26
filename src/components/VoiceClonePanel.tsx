import { useEffect, useRef, useState } from 'react'
import { Download, Mic2, Sparkles } from 'lucide-react'
import { chunksToWavBlob, PocketTTS } from 'pocket-tts-js'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const MAX_TEXT_LENGTH = 10_000
const MIN_REFERENCE_SECONDS = 2
const MAX_REFERENCE_SECONDS = 10

interface VoiceClonePanelProps {
  text: string
}

export function VoiceClonePanel({ text }: VoiceClonePanelProps) {
  const modelRef = useRef<PocketTTS | null>(null)
  const [referenceAudio, setReferenceAudio] = useState<File | null>(null)
  const [clonedVoice, setClonedVoice] = useState('')
  const [modelLoaded, setModelLoaded] = useState(false)
  const [loadingModel, setLoadingModel] = useState(false)
  const [modelProgress, setModelProgress] = useState('')
  const [preparingVoice, setPreparingVoice] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const modelReady = modelLoaded && modelRef.current?.ready === true

  useEffect(() => () => {
    modelRef.current?.destroy()
    modelRef.current = null
  }, [])

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  const loadModel = async () => {
    if (modelRef.current?.ready) return true
    if (loadingModel) return false

    modelRef.current?.destroy()
    setModelLoaded(false)
    setLoadingModel(true)
    setError('')
    setModelProgress('Starting browser model…')
    const model = new PocketTTS({
      language: 'english_2026-04',
      quantized: true,
      voiceCloning: true,
      cache: true,
    })
    modelRef.current = model
    let lastProgress = ''

    try {
      const bundle = await model.load((progress) => {
        if (progress.type === 'progress' && progress.total) {
          const percent = Math.floor((progress.loaded ?? 0) / progress.total * 100)
          const message = `${progress.label ?? 'Model files'}: ${percent}%${progress.fromCache ? ' (cached)' : ''}`
          if (message !== lastProgress) {
            lastProgress = message
            setModelProgress(message)
          }
        } else if (progress.status) {
          setModelProgress(progress.status)
        }
      })
      if (!bundle) throw new Error('The model did not finish loading.')
      setModelLoaded(true)
      setModelProgress('Model ready in your browser.')
      return true
    } catch (loadError) {
      model.destroy()
      if (modelRef.current === model) modelRef.current = null
      setModelProgress('')
      const message = loadError instanceof Error ? loadError.message : ''
      setError(message === 'Worker error'
        ? 'The browser worker could not load. Keep this site running on localhost or HTTPS, and check access to Hugging Face and jsDelivr.'
        : message || 'Could not load the browser voice model.')
      return false
    } finally {
      setLoadingModel(false)
    }
  }

  const handleFileChange = (file: File | undefined) => {
    setReferenceAudio(null)
    setClonedVoice('')
    setError('')
    setAudioUrl('')
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|webm|flac)$/i.test(file.name)) {
      setError('Choose an audio recording supported by your browser.')
      return
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError('The recording must be 25 MB or smaller.')
      return
    }
    setReferenceAudio(file)
  }

  const prepareVoice = async () => {
    if (!referenceAudio || !consent || preparingVoice) return

    setPreparingVoice(true)
    setError('')
    setAudioUrl('')
    let audioContext: AudioContext | null = null
    try {
      if (!modelRef.current?.ready && !(await loadModel())) return
      const model = modelRef.current
      if (!model?.ready) throw new Error('The browser model is not ready. Load it again and retry.')

      audioContext = new AudioContext()
      const decoded = await audioContext.decodeAudioData(await referenceAudio.arrayBuffer())
      if (decoded.duration < MIN_REFERENCE_SECONDS || decoded.duration > MAX_REFERENCE_SECONDS) {
        throw new Error(`Use a clear recording between ${MIN_REFERENCE_SECONDS} and ${MAX_REFERENCE_SECONDS} seconds long.`)
      }
      const voice = await model.cloneVoice(decoded.getChannelData(0).slice(), {
        inputSampleRate: decoded.sampleRate,
      })
      setClonedVoice(voice)
    } catch (cloneError) {
      setClonedVoice('')
      setError(cloneError instanceof Error ? cloneError.message : 'Could not prepare this voice recording.')
    } finally {
      if (audioContext && audioContext.state !== 'closed') await audioContext.close()
      setPreparingVoice(false)
    }
  }

  const generate = async () => {
    const model = modelRef.current
    const cleanText = text.trim()
    if (!model || !clonedVoice || !consent || !cleanText || generating) return
    if (cleanText.length > MAX_TEXT_LENGTH) {
      setError(`Text must be ${MAX_TEXT_LENGTH.toLocaleString()} characters or fewer.`)
      return
    }

    setGenerating(true)
    setError('')
    setAudioUrl('')
    const chunks: Float32Array[] = []
    try {
      await model.generate(cleanText, {
        voice: clonedVoice,
        onChunk: (audio) => chunks.push(audio.slice()),
      })
      if (!chunks.length) throw new Error('The model did not produce any audio.')
      setAudioUrl(URL.createObjectURL(chunksToWavBlob(chunks, model.sampleRate)))
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate cloned speech.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="clone-card" aria-labelledby="clone-heading">
      <div className="clone-heading">
        <span className="feature-icon"><Mic2 size={19} /></span>
        <div>
          <h2 id="clone-heading">Clone a voice in your browser</h2>
          <p>Prepare a voice recording, then generate English speech on this device.</p>
        </div>
      </div>

      <div className="model-status" role="status" aria-live="polite">
        <span className={`status-dot ${modelReady ? 'ready' : ''}`} />
        {modelProgress || 'Load the voice model before preparing a recording.'}
      </div>
      <button
        className="secondary-button clone-model-button"
        type="button"
        onClick={() => void loadModel()}
        disabled={modelReady || loadingModel}
      >
        {loadingModel ? 'Loading model…' : modelReady ? 'Model ready' : 'Download & load browser model'}
      </button>

      <label className="clone-upload">
        <span className="control-label">Reference voice (audio, 2–10 seconds, up to 25 MB)</span>
        <input
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
          disabled={loadingModel || preparingVoice || generating}
          onChange={(event) => handleFileChange(event.target.files?.[0])}
        />
        {referenceAudio && <span className="field-note">{referenceAudio.name}</span>}
      </label>

      <label className="consent-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked)
            if (!event.target.checked) setClonedVoice('')
          }}
        />
        <span>I own this voice or have the speaker’s permission to clone it.</span>
      </label>

      <button
        className="secondary-button clone-prepare"
        type="button"
        onClick={() => void prepareVoice()}
        disabled={!modelReady || loadingModel || !referenceAudio || !consent || preparingVoice}
      >
        <Mic2 size={15} />
        {preparingVoice ? 'Preparing voice on this device…' : clonedVoice ? 'Voice ready' : 'Prepare voice'}
      </button>

      {error && <p className="clone-error" role="alert">{error}</p>}

      <button
        className="primary-button clone-generate"
        type="button"
        onClick={() => void generate()}
        disabled={!clonedVoice || !consent || !text.trim() || text.trim().length > MAX_TEXT_LENGTH || generating}
      >
        <Sparkles size={16} />
        {generating ? 'Generating on this device…' : 'Generate cloned voice'}
      </button>

      {audioUrl && (
        <div className="clone-result">
          <audio controls src={audioUrl}>Your browser cannot play this audio.</audio>
          <a className="secondary-button clone-download" href={audioUrl} download="vocalfree-clone.wav">
            <Download size={15} /> Download WAV
          </a>
        </div>
      )}
      <p className="clone-footnote">
        Voice audio and text stay in your browser. The first model download is about 150 MB from Hugging Face and jsDelivr, then it is cached on this device. Only clone voices with permission.
      </p>
    </section>
  )
}

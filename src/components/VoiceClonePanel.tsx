import { useEffect, useRef, useState } from 'react'
import { Download, Mic2, Sparkles, Square } from 'lucide-react'
import { chunksToWavBlob, PocketTTS } from 'pocket-tts-js'
import { useI18n } from '../i18n'
import { containsDevanagariText } from '../utils/text'
import { HindiSpeechGenerator } from './HindiSpeechGenerator'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const MAX_TEXT_LENGTH = 10_000
const MIN_REFERENCE_DURATION_MS = 5_000
const MAX_REFERENCE_DURATION_MS = 60_000
const AUTO_STOP_RECORDING_MS = 59_000

interface VoiceClonePanelProps {
  text: string
  rate: number
  volume: number
}

export function VoiceClonePanel({ text, rate, volume }: VoiceClonePanelProps) {
  const { t } = useI18n()
  const modelRef = useRef<PocketTTS | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef(0)
  const recordingTimerRef = useRef<number | null>(null)
  const recordingTooLargeRef = useRef(false)
  const generatedAudioDurationRef = useRef(0)
  const reportedAudioSecondsRef = useRef(0)
  const [referenceAudio, setReferenceAudio] = useState<File | null>(null)
  const [clonedVoice, setClonedVoice] = useState('')
  const [modelLoaded, setModelLoaded] = useState(false)
  const [loadingModel, setLoadingModel] = useState(false)
  const [modelProgress, setModelProgress] = useState('')
  const [localVoices, setLocalVoices] = useState<string[]>([])
  const [localVoice, setLocalVoice] = useState('')
  const [generatingLocalSpeech, setGeneratingLocalSpeech] = useState(false)
  const [generatedAudioSeconds, setGeneratedAudioSeconds] = useState(0)
  const [localAudioUrl, setLocalAudioUrl] = useState('')
  const [preparingVoice, setPreparingVoice] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [recording, setRecording] = useState(false)
  const [startingRecording, setStartingRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const modelReady = modelLoaded && modelRef.current?.ready === true
  const hasUnsupportedScript = containsDevanagariText(text)

  useEffect(() => () => {
    modelRef.current?.destroy()
    modelRef.current = null
  }, [])

  useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current)
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  useEffect(() => () => {
    if (localAudioUrl) URL.revokeObjectURL(localAudioUrl)
  }, [localAudioUrl])

  const clearVoice = () => {
    setReferenceAudio(null)
    setClonedVoice('')
    setAudioUrl('')
  }

  const recordGeneratedChunk = (chunks: Float32Array[], audio: Float32Array, sampleRate: number) => {
    chunks.push(audio.slice())
    generatedAudioDurationRef.current += audio.length / sampleRate
    const seconds = Math.floor(generatedAudioDurationRef.current)
    if (seconds !== reportedAudioSecondsRef.current) {
      reportedAudioSecondsRef.current = seconds
      setGeneratedAudioSeconds(seconds)
    }
  }

  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(t('Voice recording is not supported in this browser. Try a current browser on localhost or HTTPS.'))
      return
    }

    clearVoice()
    setError('')
    setRecordingDuration(0)
    recordingChunksRef.current = []
    recordingTooLargeRef.current = false
    setStartingRecording(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recordingStartedAtRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (!event.data.size) return
        recordingChunksRef.current.push(event.data)
        const totalBytes = recordingChunksRef.current.reduce((total, chunk) => total + chunk.size, 0)
        if (totalBytes > MAX_AUDIO_BYTES) {
          recordingTooLargeRef.current = true
          setError(t('The recording reached the 25 MB limit. Please record a shorter sample.'))
          if (recorder.state !== 'inactive') recorder.stop()
        }
      }
      recorder.onstop = () => {
        if (recordingTimerRef.current !== null) {
          window.clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        const duration = Date.now() - recordingStartedAtRef.current
        setRecording(false)
        setRecordingDuration(duration)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        const chunks = recordingChunksRef.current
        recordingChunksRef.current = []

        if (recordingTooLargeRef.current) return
        if (duration <= MIN_REFERENCE_DURATION_MS) {
          setError(t('Record for more than 5 seconds before stopping.'))
          return
        }
        if (duration >= MAX_REFERENCE_DURATION_MS) {
          setError(t('The voice sample must be shorter than 60 seconds. Please record a new sample.'))
          return
        }

        const type = recorder.mimeType || chunks[0]?.type || 'audio/webm'
        const extension = type.includes('mp4') ? 'm4a' : 'webm'
        const file = new File(chunks, `voice-recording.${extension}`, { type })
        if (!file.size) {
          setError(t('The browser did not capture any audio. Check microphone access and try again.'))
          return
        }
        setReferenceAudio(file)
      }
      recorder.onerror = () => {
        setError(t('Recording stopped unexpectedly. Check microphone access and try again.'))
      }
      recorder.start(1000)
      setRecording(true)
      recordingTimerRef.current = window.setInterval(() => {
        const duration = Date.now() - recordingStartedAtRef.current
        setRecordingDuration(duration)
        if (duration >= AUTO_STOP_RECORDING_MS && recorder.state === 'recording') recorder.stop()
      }, 250)
    } catch (recordingError) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      recorderRef.current = null
      const name = recordingError instanceof DOMException ? recordingError.name : ''
      setError(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? t('Microphone permission was denied. Allow microphone access in your browser and try again.')
        : name === 'NotFoundError'
          ? t('No microphone was found. Connect a microphone or import an audio recording.')
          : recordingError instanceof Error
            ? recordingError.message
            : t('Could not start microphone recording.'))
    } finally {
      setStartingRecording(false)
    }
  }

  const stopRecording = () => {
    const duration = Date.now() - recordingStartedAtRef.current
    if (duration <= MIN_REFERENCE_DURATION_MS || duration >= MAX_REFERENCE_DURATION_MS) return
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const loadModel = async () => {
    if (modelRef.current?.ready) return true
    if (loadingModel) return false

    modelRef.current?.destroy()
    setModelLoaded(false)
    setLoadingModel(true)
    setError('')
    setModelProgress(t('Starting browser model…'))
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
          const message = `${t(progress.label ?? 'Model files')}: ${percent}%${progress.fromCache ? ' (cached)' : ''}`
          if (message !== lastProgress) {
            lastProgress = message
            setModelProgress(message)
          }
        } else if (progress.status) {
          setModelProgress(t(progress.status))
        }
      })
      if (!bundle) throw new Error('The model did not finish loading.')
      setLocalVoices(bundle.predefinedVoices)
      setLocalVoice((current) => bundle.predefinedVoices.includes(current) ? current : bundle.predefinedVoices[0] ?? '')
      setModelLoaded(true)
      setModelProgress(t('Model ready in your browser.'))
      return true
    } catch (loadError) {
      model.destroy()
      if (modelRef.current === model) modelRef.current = null
      setModelProgress('')
      const message = loadError instanceof Error ? loadError.message : ''
      setError(message === 'Worker error'
        ? t('The browser worker could not load. Keep this site running on localhost or HTTPS, and check access to Hugging Face and jsDelivr.')
        : t(message || 'Could not load the browser voice model.'))
      return false
    } finally {
      setLoadingModel(false)
    }
  }

  const handleFileChange = (file: File | undefined) => {
    clearVoice()
    setError('')
    setRecordingDuration(0)
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|webm|flac)$/i.test(file.name)) {
      setError(t('Choose an audio recording supported by your browser.'))
      return
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError(t('The recording must be 25 MB or smaller.'))
      return
    }
    setReferenceAudio(file)
  }

  const prepareVoice = async () => {
    if (!referenceAudio || !consent || preparingVoice || recording || startingRecording) return

    setPreparingVoice(true)
    setError('')
    setAudioUrl('')
    let audioContext: AudioContext | null = null
    try {
      audioContext = new AudioContext()
      const decoded = await audioContext.decodeAudioData(await referenceAudio.arrayBuffer())
      if (decoded.duration <= MIN_REFERENCE_DURATION_MS / 1000 || decoded.duration >= MAX_REFERENCE_DURATION_MS / 1000) {
        throw new Error(t('Choose or record a voice sample longer than 5 seconds and shorter than 60 seconds.'))
      }
      if (!modelRef.current?.ready && !(await loadModel())) return
      const model = modelRef.current
      if (!model?.ready) throw new Error(t('The browser model is not ready. Load it again and retry.'))

      const voice = await model.cloneVoice(decoded.getChannelData(0).slice(), {
        inputSampleRate: decoded.sampleRate,
      })
      setClonedVoice(voice)
    } catch (cloneError) {
      setClonedVoice('')
      setError(t(cloneError instanceof Error ? cloneError.message : 'Could not prepare this voice recording.'))
    } finally {
      if (audioContext && audioContext.state !== 'closed') await audioContext.close()
      setPreparingVoice(false)
    }
  }

  const generate = async () => {
    const model = modelRef.current
    const cleanText = text.trim()
    if (!model || !clonedVoice || !consent || !cleanText || generating) return
    if (containsDevanagariText(cleanText)) {
      setError(t('The local WAV model supports English only. To hear Hindi, use Listen with an installed Hindi voice.'))
      return
    }
    if (cleanText.length > MAX_TEXT_LENGTH) {
      setError(t('Text must be 10,000 characters or fewer.'))
      return
    }

    setGenerating(true)
    setError('')
    setAudioUrl('')
    generatedAudioDurationRef.current = 0
    reportedAudioSecondsRef.current = 0
    setGeneratedAudioSeconds(0)
    const chunks: Float32Array[] = []
    try {
      await model.generate(cleanText, {
        voice: clonedVoice,
        onChunk: (audio) => recordGeneratedChunk(chunks, audio, model.sampleRate),
      })
      if (!chunks.length) throw new Error(t('The model did not produce any audio.'))
      setAudioUrl(URL.createObjectURL(chunksToWavBlob(chunks, model.sampleRate)))
    } catch (generationError) {
      setError(t(generationError instanceof Error ? generationError.message : 'Could not generate cloned speech.'))
    } finally {
      setGenerating(false)
    }
  }

  const generateLocalSpeech = async () => {
    const model = modelRef.current
    const cleanText = text.trim()
    if (!model?.ready || !localVoice || !cleanText || loadingModel || preparingVoice || generating || generatingLocalSpeech || recording || startingRecording) return
    if (containsDevanagariText(cleanText)) {
      setError(t('The local WAV model supports English only. To hear Hindi, use Listen with an installed Hindi voice.'))
      return
    }
    if (cleanText.length > MAX_TEXT_LENGTH) {
      setError(t('Text must be 10,000 characters or fewer.'))
      return
    }

    setGeneratingLocalSpeech(true)
    setError('')
    setLocalAudioUrl('')
    generatedAudioDurationRef.current = 0
    reportedAudioSecondsRef.current = 0
    setGeneratedAudioSeconds(0)
    const chunks: Float32Array[] = []
    try {
      const voice = await model.loadVoice(localVoice)
      await model.generate(cleanText, {
        voice,
        onChunk: (audio) => recordGeneratedChunk(chunks, audio, model.sampleRate),
      })
      if (!chunks.length) throw new Error(t('The model did not produce any audio.'))
      const adjustedChunks = volume === 1
        ? chunks
        : chunks.map((chunk) => {
          const adjusted = chunk.slice()
          for (let index = 0; index < adjusted.length; index += 1) adjusted[index] *= volume
          return adjusted
        })
      const outputSampleRate = Math.round(model.sampleRate * rate)
      const wav = chunksToWavBlob(adjustedChunks, outputSampleRate)
      setLocalAudioUrl(URL.createObjectURL(wav))
    } catch (generationError) {
      setError(t(generationError instanceof Error ? generationError.message : 'Could not generate local speech.'))
    } finally {
      setGeneratingLocalSpeech(false)
    }
  }

  return (
    <section className="clone-card" aria-labelledby="clone-heading">
      <div className="clone-heading">
        <span className="feature-icon"><Mic2 size={19} /></span>
        <div>
          <h2 id="clone-heading">{t('Local voice tools')}</h2>
          <p>{t('Generate downloadable speech with a built-in voice or prepare a voice recording to clone.')}</p>
        </div>
      </div>

      <div className="model-status" role="status" aria-live="polite">
        <span className={`status-dot ${modelReady ? 'ready' : ''}`} />
        {modelProgress || t('Load the voice model before generating speech or preparing a recording.')}
      </div>
      {hasUnsupportedScript && (
        <p className="clone-language-warning" role="note">
          {t('Pocket TTS supports English only. Use the Hindi generator below for Devanagari text.')}
        </p>
      )}
      <button
        className="secondary-button clone-model-button"
        type="button"
        onClick={() => void loadModel()}
        disabled={modelReady || loadingModel || preparingVoice || generating || generatingLocalSpeech || recording || startingRecording}
      >
        {loadingModel ? t('Loading model…') : modelReady ? t('Model ready') : t('Download & load browser model')}
      </button>

      {error && <p className="clone-error" role="alert">{t(error)}</p>}

      <div className="local-speech">
        <h3>{t('Download speech audio')}</h3>
        <p className="field-note">{t('Choose a built-in English voice. Speech is generated locally as a WAV file without recording.')}</p>
        <label className="local-voice-select">
          <span className="control-label">{t('Local voice')}</span>
          <select
            value={localVoice}
            onChange={(event) => {
              setLocalVoice(event.target.value)
              setLocalAudioUrl('')
            }}
            disabled={!modelReady || preparingVoice || generating || generatingLocalSpeech}
          >
            {localVoices.length
              ? localVoices.map((voice) => <option key={voice} value={voice}>{voice}</option>)
              : <option value="">{t('Load the model to see available voices')}</option>}
          </select>
        </label>
        <button
          className="primary-button clone-generate"
          type="button"
          onClick={() => void generateLocalSpeech()}
          disabled={!modelReady || !localVoice || !text.trim() || text.trim().length > MAX_TEXT_LENGTH || hasUnsupportedScript || preparingVoice || generating || generatingLocalSpeech || loadingModel || recording || startingRecording}
        >
          <Sparkles size={16} />
          {generatingLocalSpeech ? t('Generating on this device…') : t('Generate WAV')}
        </button>
        {generatingLocalSpeech && <GenerationProgress seconds={generatedAudioSeconds} />}
        <p className="field-note local-speech-note">
          {t('The Speed and Volume settings in Voice & settings affect downloads. Changing speed also changes pitch; Pitch affects only browser playback.')}
        </p>
        {localAudioUrl && (
          <div className="clone-result">
            <audio controls src={localAudioUrl}>{t('Your browser cannot play this audio.')}</audio>
            <a className="secondary-button clone-download" href={localAudioUrl} download="vocalfree-speech.wav">
              <Download size={15} /> {t('Download WAV')}
            </a>
          </div>
        )}
      </div>

      <HindiSpeechGenerator text={text} rate={rate} volume={volume} />

      <div className="clone-divider" role="separator" />

      <h3 className="clone-section-title">{t('Clone a voice in your browser')}</h3>
      <div className="clone-recorder">
        <span className="control-label">{t('Record a reference voice (more than 5 and less than 60 seconds, up to 25 MB)')}</span>
        <button
          className={`secondary-button clone-record-button ${recording ? 'is-recording' : ''}`}
          type="button"
          onClick={recording ? stopRecording : () => void startRecording()}
          disabled={loadingModel || preparingVoice || generating || generatingLocalSpeech || startingRecording || (recording && (recordingDuration <= MIN_REFERENCE_DURATION_MS || recordingDuration >= MAX_REFERENCE_DURATION_MS))}
        >
          {recording ? <><Square size={15} fill="currentColor" /> {t('Stop recording')}</> : <><Mic2 size={15} /> {startingRecording ? t('Connecting microphone…') : t('Start recording')}</>}
        </button>
        {recording && (
          <span className="field-note recording-status" role="status" aria-live="polite">
            {t('Recording')}: {formatRecordingTime(recordingDuration)}
            {recordingDuration <= MIN_REFERENCE_DURATION_MS
              ? t(' — keep speaking for more than 5 seconds')
              : t(' — recording will stop before 60 seconds')}
          </span>
        )}
      </div>

      <label className="clone-upload">
        <span className="control-label">{t('Or import a reference recording (more than 5 and less than 60 seconds, up to 25 MB)')}</span>
        <input
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
          disabled={loadingModel || preparingVoice || generating || generatingLocalSpeech || recording || startingRecording}
          onChange={(event) => handleFileChange(event.target.files?.[0])}
        />
        {referenceAudio && (
          <span className="field-note">
            {referenceAudio.name}
            {recordingDuration > MIN_REFERENCE_DURATION_MS
              ? ` · ${formatRecordingTime(recordingDuration)}`
              : ` · ${t('must be longer than 5 and shorter than 60 seconds')}`}
          </span>
        )}
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
        <span>{t('I own this voice or have the speaker’s permission to clone it.')}</span>
      </label>

      <button
        className="secondary-button clone-prepare"
        type="button"
        onClick={() => void prepareVoice()}
        disabled={!modelReady || loadingModel || !referenceAudio || !consent || preparingVoice || generatingLocalSpeech || recording || startingRecording}
      >
        <Mic2 size={15} />
        {preparingVoice ? t('Preparing voice on this device…') : clonedVoice ? t('Voice ready') : t('Prepare voice')}
      </button>

      <button
        className="primary-button clone-generate"
        type="button"
        onClick={() => void generate()}
        disabled={!clonedVoice || !consent || !text.trim() || text.trim().length > MAX_TEXT_LENGTH || hasUnsupportedScript || generating || generatingLocalSpeech}
      >
        <Sparkles size={16} />
        {generating ? t('Generating on this device…') : t('Generate cloned voice')}
      </button>
      {generating && <GenerationProgress seconds={generatedAudioSeconds} />}

      {audioUrl && (
        <div className="clone-result">
          <audio controls src={audioUrl}>{t('Your browser cannot play this audio.')}</audio>
          <a className="secondary-button clone-download" href={audioUrl} download="vocalfree-clone.wav">
            <Download size={15} /> {t('Download WAV')}
          </a>
        </div>
      )}
      <p className="clone-footnote">
        {t('Voice audio and text stay in your browser. The first model download is about 150 MB from Hugging Face and jsDelivr, then it is cached on this device. Only clone voices with permission.')}
      </p>
    </section>
  )
}

function GenerationProgress({ seconds }: { seconds: number }) {
  const { t } = useI18n()
  return (
    <div className="generation-progress" role="status" aria-live="polite">
      <span>{t('Audio generated so far')}: {formatRecordingTime(seconds * 1000)}</span>
      <div className="generation-progress-track" role="progressbar" aria-label={t('Audio generation in progress')} />
    </div>
  )
}

function formatRecordingTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

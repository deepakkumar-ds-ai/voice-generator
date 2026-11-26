import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, AudioLines, CircleHelp, Headphones, LockKeyhole, Menu, X } from 'lucide-react'
import { HistoryPanel, type HistoryItem } from './components/HistoryPanel'
import { SpeechControls } from './components/SpeechControls'
import { TextEditor } from './components/TextEditor'
import { ThemeToggle } from './components/ThemeToggle'
import { VoiceClonePanel } from './components/VoiceClonePanel'
import { useSpeech } from './hooks/useSpeech'
import { SAMPLE_TEXT, prepareSpeechText } from './utils/text'

interface Preferences {
  dark: boolean
  voiceURI: string
  language: string
  rate: number
  pitch: number
  volume: number
}

const PREFERENCES_KEY = 'vocalfree-preferences'
const HISTORY_KEY = 'vocalfree-history'
const TEXT_KEY = 'vocalfree-draft'

const DEFAULT_PREFERENCES: Preferences = {
  dark: false,
  voiceURI: '',
  language: 'all',
  rate: 1,
  pitch: 1,
  volume: 1,
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(() => readStored(PREFERENCES_KEY, DEFAULT_PREFERENCES))
  const [text, setText] = useState(() => readStored(TEXT_KEY, ''))
  const [history, setHistory] = useState<HistoryItem[]>(() => readStored(HISTORY_KEY, []))
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [repeat, setRepeat] = useState(false)
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const currentTextRef = useRef(text)
  const repeatRef = useRef(repeat)
  const startRef = useRef<(text: string) => void>(() => undefined)

  useEffect(() => {
    currentTextRef.current = text
    repeatRef.current = repeat
  }, [text, repeat])

  const completeSpeech = useCallback(() => {
    if (repeatRef.current && currentTextRef.current.trim()) {
      startRef.current(currentTextRef.current)
    }
  }, [])
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceURI === preferences.voiceURI) ?? null,
    [voices, preferences.voiceURI],
  )
  const languages = useMemo(
    () => [...new Set(voices.map((voice) => voice.lang))].sort((a, b) => a.localeCompare(b)),
    [voices],
  )
  const speech = useSpeech({
    voice: selectedVoice,
    rate: preferences.rate,
    pitch: preferences.pitch,
    volume: preferences.volume,
    onComplete: completeSpeech,
  })

  useEffect(() => {
    startRef.current = speech.start
  }, [speech.start])

  const refreshVoices = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    const availableVoices = window.speechSynthesis.getVoices()
    setVoices(availableVoices)
    if (!preferences.voiceURI && availableVoices.length) {
      const defaultVoice = availableVoices.find((voice) => voice.default) ?? availableVoices[0]
      setPreferences((current) => ({ ...current, voiceURI: defaultVoice.voiceURI }))
    }
  }, [preferences.voiceURI])

  useEffect(() => {
    refreshVoices()
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
    const retry = window.setTimeout(refreshVoices, 500)
    return () => {
      window.clearTimeout(retry)
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices)
    }
  }, [refreshVoices])

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.dark ? 'dark' : 'light'
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {
      setNotice('Your browser could not save preferences or history locally. The app still works, but they may not be here next time.')
    }
  }, [preferences, history])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(TEXT_KEY, JSON.stringify(text))
      } catch {
        setNotice('Your browser could not save this draft locally. The text is still available until you leave the page.')
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [text])

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  const listen = () => {
    const cleanedText = prepareSpeechText(text)
    if (!cleanedText) {
      speech.setError('Add some text before you listen.')
      return
    }
    speech.start(cleanedText)
    setHistory((items) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: cleanedText, createdAt: Date.now() },
      ...items.filter((item) => item.text !== cleanedText),
    ].slice(0, 8))
  }

  const copyText = async () => {
    if (!text) {
      setNotice('There is no text to copy yet.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Text copied to clipboard.')
    } catch {
      setNotice('Clipboard access is unavailable. Select the text and copy it manually.')
    }
  }

  const pasteText = async () => {
    try {
      const pastedText = await navigator.clipboard.readText()
      if (!pastedText) {
        setNotice('Your clipboard is empty.')
        return
      }
      setText((current) => current ? `${current}${current.endsWith('\n') ? '' : '\n'}${pastedText}` : pastedText)
      setNotice('Text pasted.')
    } catch {
      setNotice('Clipboard access was denied. Paste directly into the text box instead.')
    }
  }

  const toggleTheme = () => updatePreference('dark', !preferences.dark)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        if (speech.status === 'idle') listen()
      } else if (event.key === 'Escape' && speech.status !== 'idle') {
        speech.stop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="VocalFree home">
          <span className="brand-mark"><AudioLines size={21} strokeWidth={2.2} /></span>
          <span>vocal<span>free</span></span>
          <span className="free-badge">FREE</span>
        </a>
        <nav className={`main-nav ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
          <a href="#home" onClick={() => setMobileMenuOpen(false)}>Home</a>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
        </nav>
        <div className="header-actions">
          <span className="free-promise"><span /> Free forever</span>
          <ThemeToggle dark={preferences.dark} onToggle={toggleTheme} />
          <button className="mobile-menu-button" type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <span className="eyebrow"><span className="eyebrow-line" /> YOUR WORDS, OUT LOUD</span>
          <h1>Give your words<br /><span>a voice.</span></h1>
          <p>Turn text into speech with the voices on your device.<br className="desktop-break" /> Free to use, private by design, and always ready to listen.</p>
          <a className="hero-link" href="#workspace">Start listening <ArrowDown size={15} /></a>
          <div className="hero-decoration" aria-hidden="true">
            {[12, 21, 32, 18, 38, 24, 45, 28, 16, 36, 22, 42, 18, 30, 13, 26, 40, 20, 33, 15, 27, 38, 17, 29].map((height, index) => (
              <span key={index} style={{ height: `${height}px` }} />
            ))}
          </div>
        </section>

        <section id="workspace" className="workspace" aria-label="Text to speech workspace">
          <div className="workspace-main">
            <TextEditor
              text={text}
              onTextChange={setText}
              onPaste={() => void pasteText()}
              onCopy={() => void copyText()}
              onClear={() => { setText(''); speech.setError('') }}
              onSample={() => { setText(SAMPLE_TEXT); setNotice('Sample text added.') }}
            />
            <VoiceClonePanel text={text} />
            {(speech.error || notice || !speechSupported) && (
              <div className={`notice ${speech.error || !speechSupported ? 'notice-error' : ''}`} role={speech.error || !speechSupported ? 'alert' : 'status'}>
                <CircleHelp size={17} aria-hidden="true" />
                <span>{speech.error || notice || 'Speech synthesis is not supported in this browser. Try a current browser with Web Speech API support.'}</span>
                <button type="button" className="notice-dismiss" onClick={() => { speech.setError(''); setNotice('') }} aria-label="Dismiss message"><X size={15} /></button>
              </div>
            )}
            <div className="workspace-footnote">
              <LockKeyhole size={14} />
              <span>Your text and voice sample stay in your browser; model files download from Hugging Face and jsDelivr.</span>
            </div>
          </div>
          <aside className="workspace-sidebar">
            <SpeechControls
              status={speech.status}
              voices={voices}
              selectedVoice={selectedVoice}
              onVoiceChange={(voice) => setPreferences((current) => ({
                ...current,
                voiceURI: voice?.voiceURI ?? '',
                language: voice?.lang ?? current.language,
              }))}
              language={preferences.language}
              languages={languages}
              onLanguageChange={(language) => {
                const languageVoice = voices.find((voice) => voice.lang === language)
                setPreferences((current) => ({
                  ...current,
                  language,
                  voiceURI: language === 'all' ? current.voiceURI : languageVoice?.voiceURI ?? '',
                }))
              }}
              rate={preferences.rate}
              pitch={preferences.pitch}
              volume={preferences.volume}
              onRateChange={(value) => updatePreference('rate', value)}
              onPitchChange={(value) => updatePreference('pitch', value)}
              onVolumeChange={(value) => updatePreference('volume', value)}
              onListen={listen}
              onPause={speech.pause}
              onResume={speech.resume}
              onStop={speech.stop}
              repeat={repeat}
              onRepeatChange={setRepeat}
              hasText={Boolean(text.trim())}
            />
            <HistoryPanel
              items={history}
              onSelect={(value) => { setText(value); speech.setError('') }}
              onClear={() => setHistory([])}
            />
          </aside>
        </section>

        <section id="features" className="feature-section">
          <div className="section-intro">
            <span className="eyebrow"><span className="eyebrow-line" /> SIMPLE BY NATURE</span>
            <h2>Everything you need.<br /><span>Nothing you don’t.</span></h2>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-icon"><Headphones size={20} /></span>
              <h3>Listen your way</h3>
              <p>Choose from voices installed on your device. Adjust the pace, pitch, and volume until it feels right.</p>
            </article>
            <article className="feature-card">
              <span className="feature-icon"><LockKeyhole size={20} /></span>
              <h3>Private by default</h3>
              <p>Standard speech runs in your browser; voice cloning runs on your local device. Text and recordings are not sent to a cloud service.</p>
            </article>
            <article className="feature-card">
              <span className="feature-icon"><AudioLines size={20} /></span>
              <h3>Clone voices on-device</h3>
              <p>Prepare a short voice recording and generate a WAV directly in your browser. Your sample and text stay on your device.</p>
            </article>
          </div>
        </section>

        <section id="about" className="about-strip">
          <div className="about-icon"><CircleHelp size={20} /></div>
          <div>
            <h2>A quick note about voices</h2>
            <p>Standard listening uses your browser’s built-in speech synthesis; voice selection and playback depend on your device. To create a WAV file with a cloned voice, load the optional browser model. Model files download once; voice samples and text stay on your device.</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-mark"><AudioLines size={18} /></span>
          <span>vocal<span>free</span></span>
        </a>
        <p>Free speech, made simple.</p>
        <span className="footer-right">No sign-up. No subscription. Just your voice.</span>
      </footer>
    </div>
  )
}

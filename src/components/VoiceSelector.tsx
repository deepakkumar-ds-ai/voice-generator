import { ChevronDown, Mic2 } from 'lucide-react'

interface VoiceSelectorProps {
  voices: SpeechSynthesisVoice[]
  selectedVoice: SpeechSynthesisVoice | null
  onSelect: (voice: SpeechSynthesisVoice | null) => void
  language: string
  languages: string[]
  onLanguageChange: (language: string) => void
}

export function VoiceSelector({ voices, selectedVoice, onSelect, language, languages, onLanguageChange }: VoiceSelectorProps) {
  const filteredVoices = language === 'all' ? voices : voices.filter((voice) => voice.lang === language)

  return (
    <div className="voice-fields">
      <label className="control-field">
        <span className="control-label">Language</span>
        <span className="select-wrap">
          <select aria-label="Speech language" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
            <option value="all">All available languages</option>
            {languages.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </label>
      <label className="control-field">
        <span className="control-label">Voice</span>
        <span className="select-wrap">
          <Mic2 size={16} aria-hidden="true" />
          <select
            aria-label="Speech voice"
            value={filteredVoices.some((voice) => voice.voiceURI === selectedVoice?.voiceURI) ? selectedVoice?.voiceURI : ''}
            onChange={(event) => onSelect(filteredVoices.find((voice) => voice.voiceURI === event.target.value) ?? null)}
          >
            <option value="">Default voice</option>
            {filteredVoices.map((voice) => (
              <option key={`${voice.voiceURI}-${voice.lang}`} value={voice.voiceURI}>
                {voice.name} · {voice.lang}{voice.default ? ' · Default' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
        {voices.length === 0 && <span className="field-note">Waiting for voices from your device…</span>}
        {voices.length > 0 && filteredVoices.length === 0 && <span className="field-note">No voices available for this language.</span>}
      </label>
    </div>
  )
}

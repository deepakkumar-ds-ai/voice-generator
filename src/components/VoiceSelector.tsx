import { ChevronDown, Mic2 } from 'lucide-react'
import { useI18n } from '../i18n'

interface VoiceSelectorProps {
  voices: SpeechSynthesisVoice[]
  selectedVoice: SpeechSynthesisVoice | null
  onSelect: (voice: SpeechSynthesisVoice | null) => void
  language: string
  languages: string[]
  onLanguageChange: (language: string) => void
}

export function VoiceSelector({ voices, selectedVoice, onSelect, language, languages, onLanguageChange }: VoiceSelectorProps) {
  const { t } = useI18n()
  const filteredVoices = language === 'all' ? voices : voices.filter((voice) => voice.lang === language)

  return (
    <div className="voice-fields">
      <label className="control-field">
        <span className="control-label">{t('Language')}</span>
        <span className="select-wrap">
          <select aria-label={t('Speech language')} value={language} onChange={(event) => onLanguageChange(event.target.value)}>
            <option value="all">{t('All available languages')}</option>
            {languages.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </label>
      <label className="control-field">
        <span className="control-label">{t('Voice')}</span>
        <span className="select-wrap">
          <Mic2 size={16} aria-hidden="true" />
          <select
            aria-label={t('Speech voice')}
            value={filteredVoices.some((voice) => voice.voiceURI === selectedVoice?.voiceURI) ? selectedVoice?.voiceURI : ''}
            onChange={(event) => onSelect(filteredVoices.find((voice) => voice.voiceURI === event.target.value) ?? null)}
          >
            <option value="">{t('Default voice')}</option>
            {filteredVoices.map((voice) => (
              <option key={`${voice.voiceURI}-${voice.lang}`} value={voice.voiceURI}>
                {voice.name} · {voice.lang}{voice.default ? ` · ${t('Default')}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
        {voices.length === 0 && <span className="field-note">{t('Waiting for voices from your device…')}</span>}
        {voices.length > 0 && filteredVoices.length === 0 && <span className="field-note">{t('No voices available for this language.')}</span>}
      </label>
    </div>
  )
}

import { Pause, Play, RotateCw, Square } from 'lucide-react'
import type { SpeechStatus } from '../hooks/useSpeech'
import { VoiceSelector } from './VoiceSelector'

interface SpeechControlsProps {
  status: SpeechStatus
  voices: SpeechSynthesisVoice[]
  selectedVoice: SpeechSynthesisVoice | null
  onVoiceChange: (voice: SpeechSynthesisVoice | null) => void
  language: string
  languages: string[]
  onLanguageChange: (language: string) => void
  rate: number
  pitch: number
  volume: number
  onRateChange: (value: number) => void
  onPitchChange: (value: number) => void
  onVolumeChange: (value: number) => void
  onListen: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  repeat: boolean
  onRepeatChange: (enabled: boolean) => void
  hasText: boolean
}

export function SpeechControls(props: SpeechControlsProps) {
  const isActive = props.status !== 'idle'

  return (
    <section className="controls-card" aria-label="Speech settings and controls">
      <div className="controls-heading">
        <div>
          <h2>Voice &amp; settings</h2>
          <p>Make it sound the way you like.</p>
        </div>
        <span className={`status-pill ${props.status}`}>
          <span className="status-dot" />
          {props.status === 'speaking' ? 'Speaking' : props.status === 'paused' ? 'Paused' : 'Ready'}
        </span>
      </div>

      <VoiceSelector
        voices={props.voices}
        selectedVoice={props.selectedVoice}
        onSelect={props.onVoiceChange}
        language={props.language}
        languages={props.languages}
        onLanguageChange={props.onLanguageChange}
      />

      <div className="sliders">
        <RangeSetting
          id="speed"
          label="Speed"
          value={props.rate}
          min={0.5}
          max={2}
          step={0.1}
          display={`${props.rate.toFixed(1)}×`}
          onChange={props.onRateChange}
        />
        <RangeSetting
          id="pitch"
          label="Pitch"
          value={props.pitch}
          min={0}
          max={2}
          step={0.1}
          display={props.pitch.toFixed(1)}
          onChange={props.onPitchChange}
        />
        <RangeSetting
          id="volume"
          label="Volume"
          value={props.volume}
          min={0}
          max={1}
          step={0.05}
          display={`${Math.round(props.volume * 100)}%`}
          onChange={props.onVolumeChange}
        />
      </div>

      <div className="playback-row">
        <button
          className="primary-button"
          type="button"
          onClick={isActive ? props.onStop : props.onListen}
          disabled={!props.hasText && !isActive}
        >
          {isActive ? <><Square size={16} fill="currentColor" /> Stop</> : <><Play size={17} fill="currentColor" /> Listen</>}
        </button>
        {props.status === 'paused' ? (
          <button className="secondary-button" type="button" onClick={props.onResume}>
            <Play size={16} fill="currentColor" /> Resume
          </button>
        ) : (
          <button className="secondary-button" type="button" onClick={props.onPause} disabled={props.status !== 'speaking'}>
            <Pause size={16} fill="currentColor" /> Pause
          </button>
        )}
        <button
          className={`icon-button repeat-button ${props.repeat ? 'selected' : ''}`}
          type="button"
          onClick={() => props.onRepeatChange(!props.repeat)}
          aria-pressed={props.repeat}
          aria-label={props.repeat ? 'Turn repeat off' : 'Repeat playback'}
          title={props.repeat ? 'Repeat is on' : 'Repeat'}
        >
          <RotateCw size={17} />
        </button>
      </div>
      <p className="keyboard-hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to listen <span>·</span> <kbd>Esc</kbd> to stop</p>
    </section>
  )
}

interface RangeSettingProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}

function RangeSetting({ id, label, value, min, max, step, display, onChange }: RangeSettingProps) {
  return (
    <label className="range-setting" htmlFor={id}>
      <span className="range-heading"><span>{label}</span><span className="range-value">{display}</span></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

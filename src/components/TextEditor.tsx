import { Clipboard, Copy, RotateCcw, Sparkles } from 'lucide-react'
import { countWords } from '../utils/text'
import { useI18n } from '../i18n'

interface TextEditorProps {
  text: string
  onTextChange: (text: string) => void
  onPaste: () => void
  onCopy: () => void
  onClear: () => void
  onSample: () => void
}

export function TextEditor({ text, onTextChange, onPaste, onCopy, onClear, onSample }: TextEditorProps) {
  const { locale, t } = useI18n()
  const numberLocale = locale === 'hi' ? 'hi-IN' : 'en-US'

  return (
    <section className="editor-card" aria-labelledby="editor-heading">
      <div className="editor-topline">
        <div>
          <h2 id="editor-heading">{t('Your text')}</h2>
          <p>{t('Write or paste anything you’d like to hear.')}</p>
        </div>
        <span className="privacy-chip"><span className="privacy-dot" /> {t('Stays on this device')}</span>
      </div>
      <label className="sr-only" htmlFor="speech-text">{t('Text to convert to speech')}</label>
      <textarea
        id="speech-text"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={t('Paste or type your text here...')}
        spellCheck="true"
      />
      <div className="editor-footer">
        <div className="text-count" aria-live="polite">
          <span>{text.length.toLocaleString(numberLocale)} {t('characters')}</span>
          <span className="count-divider">·</span>
          <span>{countWords(text).toLocaleString(numberLocale)} {t('words')}</span>
        </div>
        <div className="editor-actions">
          <button className="text-button" type="button" onClick={onSample} title={t('Insert sample text')}>
            <Sparkles size={15} /> {t('Sample')}
          </button>
          <button className="text-button" type="button" onClick={onPaste} title={t('Paste from clipboard')}>
            <Clipboard size={15} /> {t('Paste')}
          </button>
          <button className="icon-button subtle-button" type="button" onClick={onCopy} aria-label={t('Copy text')} title={t('Copy text')}>
            <Copy size={16} />
          </button>
          <button className="icon-button subtle-button" type="button" onClick={onClear} aria-label={t('Clear text')} title={t('Clear text')}>
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}

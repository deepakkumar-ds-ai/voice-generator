import { Clipboard, Copy, RotateCcw, Sparkles } from 'lucide-react'
import { countWords } from '../utils/text'

interface TextEditorProps {
  text: string
  onTextChange: (text: string) => void
  onPaste: () => void
  onCopy: () => void
  onClear: () => void
  onSample: () => void
}

export function TextEditor({ text, onTextChange, onPaste, onCopy, onClear, onSample }: TextEditorProps) {
  return (
    <section className="editor-card" aria-labelledby="editor-heading">
      <div className="editor-topline">
        <div>
          <h2 id="editor-heading">Your text</h2>
          <p>Write or paste anything you’d like to hear.</p>
        </div>
        <span className="privacy-chip"><span className="privacy-dot" /> Stays on this device</span>
      </div>
      <label className="sr-only" htmlFor="speech-text">Text to convert to speech</label>
      <textarea
        id="speech-text"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="Paste or type your text here..."
        spellCheck="true"
      />
      <div className="editor-footer">
        <div className="text-count" aria-live="polite">
          <span>{text.length.toLocaleString()} characters</span>
          <span className="count-divider">·</span>
          <span>{countWords(text).toLocaleString()} words</span>
        </div>
        <div className="editor-actions">
          <button className="text-button" type="button" onClick={onSample} title="Insert sample text">
            <Sparkles size={15} /> Sample
          </button>
          <button className="text-button" type="button" onClick={onPaste} title="Paste from clipboard">
            <Clipboard size={15} /> Paste
          </button>
          <button className="icon-button subtle-button" type="button" onClick={onCopy} aria-label="Copy text" title="Copy text">
            <Copy size={16} />
          </button>
          <button className="icon-button subtle-button" type="button" onClick={onClear} aria-label="Clear text" title="Clear text">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}

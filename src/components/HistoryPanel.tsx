import { Clock3, Trash2 } from 'lucide-react'

export interface HistoryItem {
  id: string
  text: string
  createdAt: number
}

interface HistoryPanelProps {
  items: HistoryItem[]
  onSelect: (text: string) => void
  onClear: () => void
}

export function HistoryPanel({ items, onSelect, onClear }: HistoryPanelProps) {
  return (
    <section className="history-card" aria-labelledby="history-heading">
      <div className="section-title-row">
        <div className="section-title-icon"><Clock3 size={17} /></div>
        <div className="section-title-copy">
          <h2 id="history-heading">Recent text</h2>
          <p>Saved only in your browser</p>
        </div>
        {items.length > 0 && (
          <button className="icon-button clear-history" type="button" onClick={onClear} aria-label="Clear recent text" title="Clear history">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {items.length ? (
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="history-item" onClick={() => onSelect(item.text)}>
                <span>{item.text}</span>
                <time dateTime={new Date(item.createdAt).toISOString()}>
                  {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </time>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-history">Texts you listen to will appear here for easy access.</p>
      )}
    </section>
  )
}

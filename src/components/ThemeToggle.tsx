import { Moon, Sun } from 'lucide-react'
import { useI18n } from '../i18n'

interface ThemeToggleProps {
  dark: boolean
  onToggle: () => void
}

export function ThemeToggle({ dark, onToggle }: ThemeToggleProps) {
  const { t } = useI18n()

  return (
    <button className="theme-toggle" type="button" onClick={onToggle} aria-label={t(dark ? 'Switch to light theme' : 'Switch to dark theme')}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

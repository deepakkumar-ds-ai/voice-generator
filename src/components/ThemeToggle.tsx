import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
  dark: boolean
  onToggle: () => void
}

export function ThemeToggle({ dark, onToggle }: ThemeToggleProps) {
  return (
    <button className="theme-toggle" type="button" onClick={onToggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

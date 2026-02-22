import { useTheme } from '../hooks/useTheme.js'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button className="chip" onClick={toggleTheme} type="button">
      <span style={{ fontSize: '0.75rem' }}>{theme === 'dark' ? '◐' : '●'}</span>
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}

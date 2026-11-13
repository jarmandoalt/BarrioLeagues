import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const ThemeContext = createContext(null)

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => (
    window.localStorage.getItem('barrioleagues-theme')
    || window.localStorage.getItem('partidos-theme')
    || 'light'
  ))

  useEffect(() => {
    document.documentElement.classList.toggle('app-dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('barrioleagues-theme', theme)
  }, [theme])

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

const ThemeToggle = ({ placement = 'global' }) => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('ThemeToggle debe usarse dentro de ThemeProvider')
  const { theme, toggleTheme } = context
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={`app-theme-toggle app-theme-toggle-${placement}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      aria-pressed={isDark}
      title={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
      {placement === 'navigation' && <span className="sr-only">{isDark ? 'Modo claro' : 'Modo oscuro'}</span>}
    </button>
  )
}

export default ThemeToggle

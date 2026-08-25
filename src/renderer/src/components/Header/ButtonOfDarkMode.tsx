import { useEffect, useState } from "react"
import DarkMode from "../icons/DarkMode"
import LightMode from "../icons/lightMode"

type Theme = "dark" | "light"

function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }
}

export default function ButtonOfDarkMode() {
  const [theme, setTheme] = useState<Theme>("light")

  // 1. Sincronizar la clase HTML de Tailwind y localStorage en cada cambio de estado
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  // 2. Cargar tema inicial y escuchar eventos del Main Process (o fallback Web)
  useEffect(() => {
    const api = window.electronAPI

    if (!api) {
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const savedTheme = localStorage.getItem("theme") as Theme | null
      const initial = savedTheme === "dark" || savedTheme === "light" 
        ? savedTheme 
        : (isSystemDark ? "dark" : "light")
      
      setTheme(initial)
      return
    }

    // Tema inicial en Electron
    api.getInitialTheme().then((initialTheme) => {
      setTheme(initialTheme)
    })

    // Escuchar actualizaciones dinámicas desde Electron
    const unsubscribe = api.onThemeChanged((isDarkFromMain) => {
      setTheme(isDarkFromMain ? "dark" : "light")
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // 3. Cambiar el tema al hacer clic
  const changeThemeMode = async () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark"

    if (window.electronAPI) {
      const isDark = await window.electronAPI.setTheme(nextTheme)
      setTheme(isDark ? "dark" : "light")
    } else {
      setTheme(nextTheme)
    }
  }

  return (
    <button
      onClick={changeThemeMode}
      type="button"
      aria-label="Alternar modo oscuro"
      className="flex items-center justify-center p-2 rounded-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
    >
      {theme === "dark" ? (
        <LightMode className="text-yellow-400" />
      ) : (
        <DarkMode className="text-slate-700" />
      )}
    </button>
  )
}
import { useEffect, useState } from "react"
import DarkMode from "../icons/DarkMode"
import LightMode from "../icons/lightMode"

type Theme = "light" | "dark"

function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }
}

export default function ButtonOfDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })

  // Sincronizar clases de Tailwind
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  useEffect(() => {
    // 1. Si no existe Electron, salimos temprano
    if (!window.electron?.ipcRenderer) return

    const handleThemeChanged = (_event: unknown, isDarkFromMenu: boolean) => {
      setTheme(isDarkFromMenu ? "dark" : "light")
    }

    // 2. Escuchamos el evento
    window.electron.ipcRenderer.on('theme-changed', handleThemeChanged)

    // 3. Función de limpieza (ahora está en el flujo principal del useEffect)
    return () => {
      window.electron.ipcRenderer.removeListener('theme-changed', handleThemeChanged)
    }
  }, [])

  const changeThemeMode = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"))
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
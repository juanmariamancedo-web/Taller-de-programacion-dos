import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Función para escuchar el cambio de tema desde el menú nativo
  onThemeChanged: (callback: (isDark: boolean) => void) => {
    const subscription = (_event: unknown, isDark: boolean) => callback(isDark)
    ipcRenderer.on('theme-changed', subscription)

    // Retornamos una función para limpiar el listener al desmontar el componente
    return () => {
      ipcRenderer.removeListener('theme-changed', subscription)
    }
  }
})
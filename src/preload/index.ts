import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { ThemeSource } from '../main/domain/types/electron-env'

const api = {
  setTheme: (theme: ThemeSource): Promise<boolean> => 
    ipcRenderer.invoke('theme:set', theme),

  getInitialTheme: (): Promise<'dark' | 'light'> => 
    ipcRenderer.invoke('theme:get-initial'),

  onThemeChanged: (callback: (isDark: boolean) => void): (() => void) => {
    const subscription = (_event: IpcRendererEvent, isDark: boolean) => callback(isDark)
    ipcRenderer.on('theme-changed', subscription)
    
    return () => {
      ipcRenderer.removeListener('theme-changed', subscription)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error('Error al exponer electronAPI en Preload:', error)
  }
} else {
  // @ts-ignore (Fallback para desarrollo sin aislación de contexto)
  window.electronAPI = api
}
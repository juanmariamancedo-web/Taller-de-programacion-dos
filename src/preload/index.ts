import { contextBridge, ipcRenderer } from 'electron'
import {
  ThemeSource,
  Credentials,
  AuthResponse,
  SearchParams,
  ProvinceOption,
  CreateClientInput,
  CreateClientResponse,
  UpdateClientInput,
  UpdateClientResponse,
  ClientListResponse,
  DeleteClientResponse
} from '../main/domain/types/electron-env'

const api = {
  login: (credentials: Credentials): Promise<AuthResponse> =>
    ipcRenderer.invoke('auth:login', credentials),
  getSession: () => ipcRenderer.invoke('auth:get-session'),
  getDashboardData: () => ipcRenderer.invoke("dashboard:getData"),
  getOrders: (params: SearchParams) => ipcRenderer.invoke('orders:getOrders', params),
  getUsers: (params: SearchParams) => ipcRenderer.invoke('users:getUsers', params),
  getProvinces: (): Promise<ProvinceOption[]> => ipcRenderer.invoke('provinces:get-all'),
  createClient: (input: CreateClientInput): Promise<CreateClientResponse> =>
    ipcRenderer.invoke('clients:create', input),
  updateClient: (input: UpdateClientInput): Promise<UpdateClientResponse> =>
    ipcRenderer.invoke('clients:update', input),
  getClients: (params: SearchParams): Promise<ClientListResponse> =>
    ipcRenderer.invoke('clients:get-all', params),
  deleteClient: (id: string): Promise<DeleteClientResponse> =>
    ipcRenderer.invoke('clients:delete', id),
  logout: () => ipcRenderer.invoke('auth:logout'),
  setTheme: (theme: ThemeSource): Promise<boolean> =>
    ipcRenderer.invoke('theme:set', theme),

  getInitialTheme: (): Promise<'dark' | 'light'> => ipcRenderer.invoke('theme:get-initial'),

  onThemeChanged: (callback: (isDark: boolean) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      isDark: boolean
    ): void => callback(isDark)

    ipcRenderer.on('theme-changed', subscription)
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
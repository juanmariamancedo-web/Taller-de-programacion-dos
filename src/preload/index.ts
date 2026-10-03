import { contextBridge, ipcRenderer } from 'electron'
import {
  ThemeSource,
  Credentials,
  AuthResponse,
  CreateUserInput,
  UpdateUserInput,
  CreateUserResponse,
  UpdateUserResponse,
  DeleteUserResponse,
  SearchParams,
  ProvinceOption,
  CreateClientInput,
  CreateClientResponse,
  UpdateClientInput,
  UpdateClientResponse,
  ClientListResponse,
  DeleteClientResponse,
  ToggleClientStatusInput,
  ToggleClientStatusResponse,
  RolesResponse,
  ProductsResponse,
  ProductCategoriesResponse,
  ProductInput,
  ProductMutationResponse,
  ProductStockInput,
  ProductStatusInput,
  UpdateProductInput,
  Unsubscribe, 
  CreateOrderPayload, 
  CreateOrderResponse,
  UpdateOrderPayload, 
  UpdateProfileInput
} from '../main/domain/types/electron-env'

const api = {
  login: (credentials: Credentials): Promise<AuthResponse> =>
    ipcRenderer.invoke('auth:login', credentials),
  getSession: () => ipcRenderer.invoke('auth:get-session'),
  getDashboardData: () => ipcRenderer.invoke('dashboard:getData'),
  getOrders: (searchParams?: SearchParams) => 
    ipcRenderer.invoke('orders:getOrders', searchParams),
  createOrder: (payload: CreateOrderPayload) =>
    ipcRenderer.invoke('orders:create', payload),
  updateOrder: (payload: UpdateOrderPayload) =>
    ipcRenderer.invoke('orders:update', payload),

  // --- MÓDULO DE USUARIOS ---
  getUsers: (params: SearchParams) => ipcRenderer.invoke('users:getUsers', params),
  createUser: (input: CreateUserInput): Promise<CreateUserResponse> =>
    ipcRenderer.invoke('users:create', input),
  updateUser: (input: UpdateUserInput): Promise<UpdateUserResponse> =>
    ipcRenderer.invoke('users:update', input),
  deleteUser: (id: number | bigint): Promise<DeleteUserResponse> =>
    ipcRenderer.invoke('users:delete', id),
  getRoles: (): Promise<RolesResponse> =>
    ipcRenderer.invoke('users:getRoles'),
  updateProfile: (input: UpdateProfileInput) =>
    ipcRenderer.invoke('users:update-profile', input),

  // --- MÓDULO DE CLIENTES Y DIRECCIONES ---
  getProvinces: (): Promise<ProvinceOption[]> => ipcRenderer.invoke('provinces:get-all'),
  createClient: (input: CreateClientInput): Promise<CreateClientResponse> =>
    ipcRenderer.invoke('clients:create', input),
  updateClient: (input: UpdateClientInput): Promise<UpdateClientResponse> =>
    ipcRenderer.invoke('clients:update', input),
  getClients: (params: SearchParams): Promise<ClientListResponse> =>
    ipcRenderer.invoke('clients:get-all', params),
  deleteClient: (id: string): Promise<DeleteClientResponse> =>
    ipcRenderer.invoke('clients:delete', id),
  setClientStatus: (input: ToggleClientStatusInput): Promise<ToggleClientStatusResponse> =>
    ipcRenderer.invoke('clients:set-status', input),
  getAddresses: (clientId?: number | bigint, searchParams?: SearchParams) =>
    ipcRenderer.invoke('address:getAddresses', clientId, searchParams),

  // --- MÓDULO DE PRODUCTOS ---
  getProducts: (params: SearchParams): Promise<ProductsResponse> =>
    ipcRenderer.invoke('products:getProducts', params),
  getProductCategories: (): Promise<ProductCategoriesResponse> =>
    ipcRenderer.invoke('products:get-categories'),
  createProduct: (input: ProductInput): Promise<ProductMutationResponse> =>
    ipcRenderer.invoke('products:create', input),
  updateProduct: (input: UpdateProductInput): Promise<ProductMutationResponse> =>
    ipcRenderer.invoke('products:update', input),
  setProductStatus: (input: ProductStatusInput): Promise<ProductMutationResponse> =>
    ipcRenderer.invoke('products:set-status', input),
  updateProductStock: (input: ProductStockInput): Promise<ProductMutationResponse> =>
    ipcRenderer.invoke('products:update-stock', input),

  // --- SISTEMA Y SESIÓN ---
  logout: () => ipcRenderer.invoke('auth:logout'),
  setTheme: (theme: ThemeSource): Promise<boolean> =>
    ipcRenderer.invoke('theme:set', theme),
  getInitialTheme: (): Promise<'dark' | 'light'> => 
    ipcRenderer.invoke('theme:get-initial'),
  onThemeChanged: (callback: (isDark: boolean) => void): Unsubscribe => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      isDark: boolean
    ): void => callback(isDark)

    ipcRenderer.on('theme-changed', subscription)

    return () => {
      ipcRenderer.removeListener('theme-changed', subscription)
    }
  }, 
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error('Error al exponer electronAPI en Preload:', error)
  }
} else {
  // @ts-ignore
  window.electronAPI = api
}
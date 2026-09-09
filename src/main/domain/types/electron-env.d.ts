import { Prisma } from '../../infrastructure/db/generated/client/client'

// electron-env.d.ts
export type ThemeSource = 'system' | 'dark' | 'light'
export type Theme = 'dark' | 'light'

export interface Credentials {
  username: string
  password: string
}

export interface AuthResponse {
  success: boolean
  token?: string
  user?: {
    id: string
    username: string
    isActive: boolean
  }
  message?: string
}

export interface SearchParams {
  search: string
  page: number
  sort: string
}

export interface OrderState {
  id: bigint
  name: string
}

export type OrderWithState = Prisma.OrderGetPayload<{
  include: { currentState: true }
}>

export interface OrderResponse {
  success: boolean
  data?: OrderWithState[]
  message?: string
}

export type UserWithRole = Prisma.UserGetPayload<{
  include: { role: true }
}>

export interface UserResponse {
  success: boolean
  data?: UserWithRole[]
  message?: string
}

export interface ProvinceOption {
  id: string
  name: string
}

export interface CreateClientInput {
  name: string
  lastname: string
  cuil: string
  email: string
  province: string
  city: string
  postalCode: string
  street: string
  number: number
}

export interface CreateClientResponse {
  success: boolean
  data?: { id: string }
  error?: string
}

export interface ClientListItem {
  id: string
  name: string
  lastname: string
  cuil: string
  email: string
  isActive: boolean
  address?: {
    postalCode: string
    city: string
    province: string
  }
}

export interface ClientListResponse {
  success: boolean
  data?: ClientListItem[]
  total?: number
  error?: string
}

// Tipo explícito para la función de desuscripción
export type Unsubscribe = () => void

export interface IElectronAPI {
  // Invokes (Promesas)
  setTheme: (theme: ThemeSource) => Promise<boolean>
  getInitialTheme: () => Promise<Theme>
  getOrders: (searchParams: SearchParams) => Promise<OrderResponse>
  getUsers: (searchParams: SearchParams) => Promise<UserResponse>
  getProvinces: () => Promise<ProvinceOption[]>
  createClient: (input: CreateClientInput) => Promise<CreateClientResponse>
  getClients: (searchParams: SearchParams) => Promise<ClientListResponse>

  // Suscripción: recibe un callback y retorna la función de desuscripción
  onThemeChanged: (callback: (isDark: boolean) => void) => Unsubscribe
  login: (credentials: Credentials) => Promise<AuthResponse>
  logout: () => Promise<{ success: boolean }>
  getSession: () => Promise<{
    id: bigint
    username: string
    isActive: boolean
  } | null>
}

// Extensión global del objeto Window
declare global {
  interface Window {
    electronAPI?: IElectronAPI
  }
}
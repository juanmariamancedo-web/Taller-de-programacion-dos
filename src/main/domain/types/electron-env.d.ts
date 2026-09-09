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
  include: { currentState: true; client: true }
}>

export interface OrderResponse {
  success: boolean
  data?: OrderWithState[]
  totalPages: number
  message?: string
}

export type UserWithRole = Prisma.UserGetPayload<{
  include: { role: true }
}>

export interface UserResponse {
  success: boolean
  data?: UserWithRole[]
  totalPages: number
  message?: string
}

export interface ProvinceOption {
  id: string
  name: string
}

// Client Types
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

export interface DeleteClientResponse {
  success: boolean
  data?: { id: string }
  error?: string
}

// Dashboard Types
export interface TopProduct {
  id: bigint
  name: string
  totalSold: number
}

export interface DashboardData {
  pendingOrders: number
  deliveredOrders: number
  averageTicket: number
  registeredClients: number
  lastOrders?: OrderWithState[]
  topProducts?: TopProduct[]
}

export interface DashboardDataResponse {
  success: boolean
  data?: DashboardData
  message?: string
}

// Tipo explícito para la función de desuscripción
export type Unsubscribe = () => void

export interface IElectronAPI {
  // Invokes (Promesas)
  setTheme: (theme: ThemeSource) => Promise<boolean>
  getInitialTheme: () => Promise<Theme>

  getDashboardData: () => Promise<DashboardDataResponse>
  getOrders: (searchParams: SearchParams) => Promise<OrderResponse>
  getUsers: (searchParams: SearchParams) => Promise<UserResponse>
  getProvinces: () => Promise<ProvinceOption[]>
  createClient: (input: CreateClientInput) => Promise<CreateClientResponse>
  getClients: (searchParams: SearchParams) => Promise<ClientListResponse>
  deleteClient: (id: string) => Promise<DeleteClientResponse>

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
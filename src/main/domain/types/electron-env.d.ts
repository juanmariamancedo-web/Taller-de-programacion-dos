import { Order, Prisma, User } from '../../infrastructure/db/generated/client/client'

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
  include: { currentState: true, client: true }
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
  message?: string
}

export interface ProvinceOption {
  id: string
  name: string
}

export interface TopProduct {
  id: bigint;
  name: string;
  totalSold: number;
}

export interface DashboardData {
  pendingOrders: number,
  deliveredOrders: number,
  averageTicket: number,
  registeredClients: number,
  lastOrders?: OrderWithState[],
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

  getDashboardData: ()=> Promise<DashboardDataResponse>
  getOrders: (searchParams: SearchParams) => Promise<OrderResponse>
  getUsers: (searchParams: SearchParams) => Promise<UserResponse>
  getProvinces: () => Promise<ProvinceOption[]>

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
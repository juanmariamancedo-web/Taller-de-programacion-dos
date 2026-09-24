import { Prisma } from '../../infrastructure/db/generated/client/client'

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
    roleId?: number
    roleName?: string
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
  message?: string
  totalPages?: number
}

export interface TopProduct {
  id: bigint
  name: string
  totalSold: number
}

export interface DashboardData {
  registeredClients: number
  pendingOrders: number
  deliveredOrders: number
  averageTicket: number
  lastOrders: Array<Prisma.OrderGetPayload<{
    include: { currentState: true; client: true }
  }>>
  topProducts: Array<TopProduct>
}

export interface DashboardDataResponse {
  success: boolean
  data?: DashboardData
  message?: string
}

export type UserWithRole = Prisma.UserGetPayload<{
  include: { role: true }
}>

export interface UserResponse {
  success: boolean
  data?: UserWithRole[]
  message?: string
  totalPages?: number
}

export type AddressWithCityAndClient = Prisma.AddressGetPayload<{
  include: { city: true; client: true }
}>

export interface AddressResponse {
  success: boolean
  data?: AddressWithCityAndClient[]
  message?: string
  totalPages: number
}

export interface RolesResponse {
  success: boolean
  data?: Prisma.UserRoleGetPayload<{}>
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

export interface UpdateClientInput extends CreateClientInput {
  id: string
}

export interface UpdateClientResponse {
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
    street: string
    number: number
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

export type Product = Prisma.ProductGetPayload<{}>
export type ItemOrder = Prisma.ItemOrderGetPayload<{}>

export interface ProductsResponse {
  success: boolean
  data?: Product[]
  message?: string
  totalPages: number
}

export interface ToggleClientStatusInput {
  id: string
  isActive: boolean
}

export interface ToggleClientStatusResponse {
  success: boolean
  data?: { id: string; isActive: boolean }
  error?: string
}

export type Unsubscribe = () => void

export interface IElectronAPI {
  setTheme: (theme: ThemeSource) => Promise<boolean>
  getInitialTheme: () => Promise<Theme>
  getDashboardData: () => Promise<DashboardDataResponse>
  getOrders: (searchParams: SearchParams, userId?: number) => Promise<OrderResponse>
  getUsers: (searchParams: SearchParams) => Promise<UserResponse>
  getProvinces: () => Promise<ProvinceOption[]>
  createClient: (input: CreateClientInput) => Promise<CreateClientResponse>
  updateClient: (input: UpdateClientInput) => Promise<UpdateClientResponse>
  getClients: (searchParams: SearchParams) => Promise<ClientListResponse>
  deleteClient: (id: string) => Promise<DeleteClientResponse>
  setClientStatus: (input: ToggleClientStatusInput) => Promise<ToggleClientStatusResponse>
  onThemeChanged: (callback: (isDark: boolean) => void) => Unsubscribe
  login: (credentials: Credentials) => Promise<AuthResponse>
  logout: () => Promise<{ success: boolean }>
  getSession: () => Promise<{
    id: bigint
    username: string
    isActive: boolean
    roleId: number
    roleName: string
  } | null>
  getRoles: () => Promise<RolesResponse>
  getAddresses: (clientId?: number | bigint, searchParams?: SearchParams) => Promise<AddressResponse>
  getProducts: (searchParams: SearchParams) => Promise<ProductsResponse>
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI
  }
}
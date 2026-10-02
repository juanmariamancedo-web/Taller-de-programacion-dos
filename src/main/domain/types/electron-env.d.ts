import { Prisma } from '../../infrastructure/db/generated/client/client'

export type ThemeSource = 'system' | 'dark' | 'light'
export type Theme = 'dark' | 'light'

export interface Credentials {
  username: string
  password: string
}

// --- TIPOS DE USUARIO ---
export interface CreateUserInput {
  username: string
  roleId: number
  password: string
  isActive: boolean
}

export interface UpdateUserInput {
  id: number | bigint
  username: string
  roleId: number
  password?: string
  isActive: boolean
}

export interface CreateUserResponse {
  success: boolean
  data?: { id: string }
  error?: string
}

export interface UpdateUserResponse {
  success: boolean
  message?: string
  error?: string
}

export interface DeleteUserResponse {
  success: boolean
  message?: string
  error?: string
}

export interface UserListItem {
  id: number | bigint
  username: string
  isActive: boolean
  roleId: number
  role?: {
    id: number
    name: string
  }
}

export type UserWithRole = Prisma.UserGetPayload<{
  include: { role: true }
}>

export interface UserResponse {
  success: boolean
  data?: UserListItem[]
  message?: string
  totalPages?: number
}

// --- TIPOS DE AUTENTICACIÓN Y SESIÓN ---
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
  includeInactive?: boolean
}

// --- TIPOS DE ORDENES ---
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

export interface OrderItemInput {
  productId: number
  quantity: number
  unitPrice: number
}

export interface CreateOrderPayload {
  clientId: number
  sellerId?: number
  items: OrderItemInput[]
  total: number
  notes?: string
}

export interface CreateOrderResponse {
  success: boolean
  orderId?: number
  message?: string
}

export interface UpdateOrderPayload {
  id: number | bigint
  clientId: number
  sellerId: number
  items: OrderItemInput[]
  total: number
  currentStateId?: number
}

export interface OrderMutationResponse {
  success: boolean
  orderId?: number
  message?: string
}

// --- DASHBOARD ---
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

// --- DIRECCIONES Y PROVINCIAS ---
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
  data?: Prisma.UserRoleGetPayload<{}>[]
  message?: string
}

export interface ProvinceOption {
  id: string
  name: string
}

// --- CLIENTES ---
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

export interface ToggleClientStatusInput {
  id: string
  isActive: boolean
}

export interface ToggleClientStatusResponse {
  success: boolean
  data?: { id: string; isActive: boolean }
  error?: string
}

// --- PRODUCTOS ---
export type Product = Prisma.ProductGetPayload<{}>
export type ItemOrder = Prisma.ItemOrderGetPayload<{}>

export interface ProductsResponse {
  success: boolean
  data?: ProductListItem[]
  message?: string
  totalPages: number
  totalCount: number
  currentPage: number
}

export interface ProductListItem {
  id: string
  name: string
  price: number
  stock: number
  lowStock: number
  image: string
  isActive: boolean
  categoryId: string
}

export interface ProductCategory {
  id: string
  name: string
}

export interface ProductInput {
  name: string
  price: number
  stock: number
  lowStock: number
  image: string
  isActive: boolean
  categoryId: string
}

export interface UpdateProductInput extends ProductInput {
  id: string
}

export interface ProductMutationResponse {
  success: boolean
  data?: { id: string }
  message?: string
}

export interface ProductStatusInput {
  id: string
  isActive: boolean
}

export interface ProductStockInput {
  id: string
  stock: number
}

export interface ProductCategoriesResponse {
  success: boolean
  data?: ProductCategory[]
  message?: string
}

export interface UpdateProfileInput {
  userId: number | string
  username: string
  prevPassword?: string
  newPassword?: string
}

export type Unsubscribe = () => void

// --- INTERFAZ GLOBAL IPC (ELECTRON API) ---
export interface IElectronAPI {
  setTheme: (theme: ThemeSource) => Promise<boolean>
  getInitialTheme: () => Promise<Theme>
  getDashboardData: () => Promise<DashboardDataResponse>
  
  // Usuarios
  getUsers: (searchParams: SearchParams) => Promise<UserResponse>
  createUser: (input: CreateUserInput) => Promise<CreateUserResponse>
  updateUser: (input: UpdateUserInput) => Promise<UpdateUserResponse>
  deleteUser: (id: number | bigint) => Promise<DeleteUserResponse>
  getRoles: () => Promise<RolesResponse>
  updateProfile: (input: UpdateProfileInput) => Promise<ProfileResponse>

  // Órdenes
  getOrders: (searchParams: SearchParams, userId?: number) => Promise<OrderResponse>
  createOrder: (payload: CreateOrderPayload) => Promise<CreateOrderResponse>
  updateOrder: (payload: UpdateOrderPayload) => Promise<OrderMutationResponse>

  // Clientes y Direcciones
  getProvinces: () => Promise<ProvinceOption[]>
  createClient: (input: CreateClientInput) => Promise<CreateClientResponse>
  updateClient: (input: UpdateClientInput) => Promise<UpdateClientResponse>
  getClients: (searchParams: SearchParams) => Promise<ClientListResponse>
  deleteClient: (id: string) => Promise<DeleteClientResponse>
  setClientStatus: (input: ToggleClientStatusInput) => Promise<ToggleClientStatusResponse>
  getAddresses: (clientId?: number | bigint, searchParams?: SearchParams) => Promise<AddressResponse>

  // Productos
  getProducts: (searchParams: SearchParams) => Promise<ProductsResponse>
  getProductCategories: () => Promise<ProductCategoriesResponse>
  createProduct: (input: ProductInput) => Promise<ProductMutationResponse>
  updateProduct: (input: UpdateProductInput) => Promise<ProductMutationResponse>
  setProductStatus: (input: ProductStatusInput) => Promise<ProductMutationResponse>
  updateProductStock: (input: ProductStockInput) => Promise<ProductMutationResponse>

  // Autenticación y Sesión
  login: (credentials: Credentials) => Promise<AuthResponse>
  logout: () => Promise<{ success: boolean }>
  getSession: () => Promise<{
    id: bigint
    username: string
    isActive: boolean
    roleId: number
    roleName: string
  } | null>

  onThemeChanged: (callback: (isDark: boolean) => void) => Unsubscribe
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI
  }
}
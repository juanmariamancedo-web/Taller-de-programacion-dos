import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Tab } from '../../../../main/domain/types/Tab'
import type { ClientListItem, OrderWithState, UserListItem } from '../../../../main/domain/types/electron-env'

export interface Session {
  id: string; 
  username: string;
  isActive: boolean;
  roleId: number;
  roleName: string;
}

export interface AppState {
  search: string;
  sort: string;
  currentTab: Tab;
  page: number;
  session: Session | null | undefined;
  loadingSession: boolean;
  clientToEdit: ClientListItem | null;
  orderToEdit: OrderWithState | null;
  userToEdit: UserListItem | null;
  globalAlert: string | null;
  
  // Filtros adicionales
  orderStateFilter: string;
  userStatusFilter: string;
}

const initialState: AppState = {
  search: '',
  sort: 'asc',
  currentTab: 'dashboard',
  page: 1,
  session: null,
  loadingSession: true, 
  clientToEdit: null,
  orderToEdit: null,
  userToEdit: null,
  globalAlert: null, 
  
  // Inicializamos los filtros vacíos (muestra todos)
  orderStateFilter: '',
  userStatusFilter: '',
}

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload
      state.page = 1 // Al buscar, volvemos a la primera página
    },
    setSort: (state, action: PayloadAction<string>) => {
      state.sort = action.payload
    },
    setCurrentTab: (state, action: PayloadAction<Tab>) => {
      state.currentTab = action.payload
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload
    },
    
    // --- Filtros ---
    setOrderStateFilter: (state, action: PayloadAction<string>) => {
      state.orderStateFilter = action.payload
      state.page = 1 // Al filtrar, volvemos a la primera página
    },
    setUserStatusFilter: (state, action: PayloadAction<string>) => {
      state.userStatusFilter = action.payload
      state.page = 1
    },

    setClientToEdit: (state, action: PayloadAction<ClientListItem | null>) => {
      state.clientToEdit = action.payload
    },
    setOrderToEdit: (state, action: PayloadAction<OrderWithState | null>) => {
      state.orderToEdit = action.payload
    },
    setUserToEdit: (state, action: PayloadAction<UserListItem | null>) => {
      state.userToEdit = action.payload
    },
    // --- Reducer de Alerta Global ---
    setGlobalAlert: (state, action: PayloadAction<string | null>) => {
      state.globalAlert = action.payload
    },
    // --- Reducers de Sesión ---
    setSession: (state, action: PayloadAction<Session | null | undefined>) => {
      state.session = action.payload
      state.loadingSession = false
    },
    setLoadingSession: (state, action: PayloadAction<boolean>) => {
      state.loadingSession = action.payload
    },
    logoutSession: (state) => {
      state.session = null
      state.loadingSession = false
    },
  },
})

export const { 
  setSearch, 
  setSort, 
  setCurrentTab, 
  setPage, 
  setOrderStateFilter,
  setUserStatusFilter,
  setClientToEdit,
  setOrderToEdit,
  setUserToEdit,
  setGlobalAlert,
  setSession, 
  setLoadingSession,
  logoutSession 
} = appSlice.actions

export default appSlice.reducer
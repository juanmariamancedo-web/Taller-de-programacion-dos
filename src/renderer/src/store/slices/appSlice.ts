import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Tab } from '../../../../main/domain/types/Tab'

export interface Session {
  id: string; 
  username: string;
  isActive: boolean;
}

export interface AppState {
  search: string;
  sort: string;
  currentTab: Tab;
  page: number;
  session: Session | null | undefined;
  loadingSession: boolean;
}

const initialState: AppState = {
  search: '',
  sort: 'asc',
  currentTab: 'dashboard',
  page: 1,
  session: null,
  loadingSession: true, 
}

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload
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
  setSession, 
  setLoadingSession, 
  logoutSession 
} = appSlice.actions

export default appSlice.reducer
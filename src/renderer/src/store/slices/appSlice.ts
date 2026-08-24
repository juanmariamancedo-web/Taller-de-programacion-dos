import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Tab } from '../../../../main/domain/types/Tab'

export interface AppState {
  search: string
  sort: string
  currentTab: Tab
}

const initialState: AppState = {
  search: '',
  sort: 'asc',
  currentTab: 'dashboard', // Asigna tu valor inicial de Tab
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
  },
})

export const { setSearch, setSort, setCurrentTab } = appSlice.actions
export default appSlice.reducer
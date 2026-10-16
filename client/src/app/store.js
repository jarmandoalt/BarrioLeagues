import { configureStore } from '@reduxjs/toolkit'
import leagueReducer from '../features/league/leagueSlice'

export const store = configureStore({
  reducer: {
    league: leagueReducer,
  },
})

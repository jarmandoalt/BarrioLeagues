import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import {
  getStandings,
  getTeams,
  getMatches,
  getStats,
} from '../../services/leagueApi'

const initialState = {
  standings: [],
  teams: [],
  matches: [],
  stats: {
    goleadores: [],
    porteros: [],
    tarjetasRojas: [],
    tarjetasAmarillas: [],
  },
  loading: false,
  error: null,
}

export const fetchLeagueData = createAsyncThunk(
  'league/fetchLeagueData',
  async (slug, { rejectWithValue }) => {
    try {
      const [standings, teams, matches, stats] = await Promise.all([
        getStandings(slug),
        getTeams(slug),
        getMatches(slug),
        getStats(slug),
      ])

      return { standings, teams, matches, stats }
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

const leagueSlice = createSlice({
  name: 'league',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeagueData.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLeagueData.fulfilled, (state, action) => {
        state.loading = false
        state.standings = action.payload.standings
        state.teams = action.payload.teams
        state.matches = action.payload.matches
        state.stats = action.payload.stats
      })
      .addCase(fetchLeagueData.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Error cargando datos'
      })
  },
})

export default leagueSlice.reducer

export const selectLeague = (state) => state.league
export const selectStandings = (state) => state.league.standings
export const selectTeams = (state) => state.league.teams
export const selectMatches = (state) => state.league.matches
export const selectStats = (state) => state.league.stats

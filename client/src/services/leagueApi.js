import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
})

const leagueParams = (slug) => (slug ? { params: { slug } } : undefined)

export const getStandings = (slug) => api.get('/standings', leagueParams(slug)).then((res) => res.data)
export const getTeams = (slug) => api.get('/equipos', leagueParams(slug)).then((res) => res.data)
export const getMatches = (slug) => api.get('/partidos', leagueParams(slug)).then((res) => res.data)
export const getPendingRefereeMatches = (slug) => api.get(`/ligas/${slug}/arbitros/partidos-pendientes`).then((res) => res.data)
export const verifyRefereeMatch = (slug, matchId, idPartido) => api.post(`/ligas/${slug}/arbitros/verificar-partido`, { matchId, idPartido }).then((res) => res.data)
export const submitRefereeReport = (slug, matchId, accessToken, report) => api.post(`/ligas/${slug}/arbitros/${matchId}/reporte`, report, { headers: { Authorization: `Bearer ${accessToken}` } }).then((res) => res.data)
export const createMatch = (match) => api.post('/partidos', match).then((res) => res.data)
export const updateMatch = (id, match) => api.put(`/partidos/${id}`, match).then((res) => res.data)
export const generateLeagueMatches = (slug, asignar) => api.post(`/ligas/${slug}/partidos/generar`, { asignar }).then((res) => res.data)
export const getStats = (slug) => api.get('/estadisticas', leagueParams(slug)).then((res) => res.data)
export const createTeam = (team) => api.post('/equipos', team).then((res) => res.data)
export const updateTeam = (id, team) => api.put(`/equipos/${id}`, team).then((res) => res.data)
export const createLeague = (league) => api.post('/ligas', league).then((res) => res.data)
export const getLeagueBySlug = (slug) => api.get(`/ligas/${slug}`).then((res) => res.data)
export const updateLeague = (slug, league) => api.put(`/ligas/${slug}`, league).then((res) => res.data)
export const advanceLeagueJornadaWithWhatsApp = (slug, jornada, actualizacionJornada) => api.post(`/ligas/${slug}/avanzar-jornada-whatsapp`, { jornada, actualizacionJornada }).then((res) => res.data)
export const getAdminSession = () => api.get('/admin/session').then((res) => res.data)
export const loginAdmin = (username, password) => api.post('/admin/login', { username, password }).then((res) => res.data)
export const loginLeagueAdmin = (slug, username, password) => api.post(`/ligas/${slug}/admin/login`, { username, password }).then((res) => res.data)
export const changeLeagueAdminPassword = (slug, password) => api.post(`/ligas/${slug}/admin/password`, { password }).then((res) => res.data)
export const resetLeagueAdminPasswordBySuperAdmin = (slug, slugConfirmation, adminPassword) => api.post(`/admin/ligas/${slug}/reset-password`, { slugConfirmation, adminPassword }).then((res) => res.data)
export const getLeagueAdminContact = (slug) => api.get(`/ligas/${slug}/admin-contact`).then((res) => res.data)
export const logoutAdmin = () => api.post('/admin/logout')
export const getLeagues = () => api.get('/ligas').then((res) => res.data)
export const createPlayer = (player) => api.post('/jugadores', player).then((res) => res.data)
export const getPlayers = (teamId) => api.get('/jugadores', { params: { equipo_id: teamId } }).then((res) => res.data)
export const updatePlayer = (id, player) => api.put(`/jugadores/${id}`, player).then((res) => res.data)
export const getReferees = (slug) => api.get('/arbitros', leagueParams(slug)).then((res) => res.data)
export const createReferee = (referee) => api.post('/arbitros', referee).then((res) => res.data)
export const updateReferee = (id, referee) => api.put(`/arbitros/${id}`, referee).then((res) => res.data)
export const getCourts = (slug) => api.get('/canchas', leagueParams(slug)).then((res) => res.data)
export const createCourt = (court) => api.post('/canchas', court).then((res) => res.data)
export const updateCourt = (id, court) => api.put(`/canchas/${id}`, court).then((res) => res.data)


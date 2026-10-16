import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap'
import LeagueHeader from '../components/LeagueHeader'
import TeamGrid from '../components/TeamGrid'
import EquipoDetalle from '../components/EquipoDetalle'
import { useAdminAuth } from '../components/AdminAuthContext'
import FloatingNotifications from '../components/FloatingNotifications'
import { advanceLeagueJornadaWithWhatsApp, createCourt, createMatch, createPlayer, createReferee, createTeam, generateLeagueMatches, getCourts, getLeagueAdminContact, getLeagueBySlug, getMatches, getPlayers, getReferees, getTeams, updateCourt, updateLeague, updateMatch, updatePlayer, updateReferee, updateTeam } from '../services/leagueApi'
import '../index.css'

const initialForm = {
  nombre: '',
  nombreCorto: '',
  dtNombre: '',
  dtWhatsapp: '',
  colorPrimario: '#1f6feb',
  colorSecundario: '#ffffff',
  imagen: '',
  pj: 0,
  pg: 0,
  pe: 0,
  pp: 0,
  gf: 0,
  gc: 0,
  racha: '',
}

const initialPlayerForm = {
  numero: 1,
  nombre_corto: '',
  nombre_completo: '',
  posicion: '',
  foto_url: '',
  estado: 'activo',
}

const initialMatchForm = {
  idPartido: '',
  arbitro_id: '',
  jornada: 1,
  fecha: '',
  hora: '',
  equipoLocal_id: '',
  equipoVisitante_id: '',
  marcadorLocal: 0,
  marcadorVisitante: 0,
  estado: 'programado',
  cancha_id: '',
  eventos: [],
}

const emptyEvent = { equipo_id: '', tipo: 'GOL', jugador_numero: 1, minuto: 1 }

const initialRefereeForm = { nombre: '', telefono: '', estado: 'activo' }
const initialCourtForm = { nombre: '', estado: 'activa', horarios: [] }
const emptyCourtSchedule = { dia: 'lunes', horaInicio: '' }
const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const hasCourtScheduleConflict = (schedules, durationMinutes) => schedules.some((schedule, index) => {
  if (!schedule.horaInicio) return false
  const [hours, minutes] = schedule.horaInicio.split(':').map(Number)
  const startMinutes = (hours * 60) + minutes
  return schedules.slice(index + 1).some((otherSchedule) => {
    if (schedule.dia !== otherSchedule.dia || !otherSchedule.horaInicio) return false
    const [otherHours, otherMinutes] = otherSchedule.horaInicio.split(':').map(Number)
    const otherStartMinutes = (otherHours * 60) + otherMinutes
    return Math.abs(startMinutes - otherStartMinutes) < durationMinutes
  })
})

const getNextMatchId = (matches) => {
  const usedIds = new Set(matches.map((match) => match.idPartido))
  for (let number = 100000; number <= 999999; number += 1) {
    const id = String(number)
    if (new Set(id).size === 6 && !usedIds.has(id)) return id
  }
  return ''
}

const hasPendingAssignment = (match) => !match.fecha || !match.hora || !match.cancha_id || !match.arbitro_id
const groupMatchesByJornada = (list) => [...list.reduce((map, match) => map.set(match.jornada, [...(map.get(match.jornada) || []), match]), new Map())].sort((a, b) => a[0] - b[0])
const getTotalJornadas = (league, teams) => {
  const rounds = teams.length % 2 === 0 ? Math.max(teams.length - 1, 0) : teams.length
  return league?.formatoTorneo === 'todos-vs-todos-ida-y-vuelta' ? rounds * 2 : rounds
}
const getJornadaOptions = (league, teams, current) => {
  const total = getTotalJornadas(league, teams)
  const first = (league?.jornada ?? 1) + 1
  const options = Array.from({ length: Math.max(total - first + 1, 0) }, (_, index) => first + index)
  return current && !options.includes(current) ? [current, ...options] : options
}
const formatJornada = (value) => Number(value) === 0 ? 'Pre-temporada' : `Jornada ${value}`
const weekdayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const LeagueAdmin = () => {
  const { logout } = useAdminAuth()
  const { slug, codigo } = useParams()
  const navigate = useNavigate()
  const [league, setLeague] = useState(null)
  const [teams, setTeams] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [playerForm, setPlayerForm] = useState(initialPlayerForm)
  const [showPlayerForm, setShowPlayerForm] = useState(false)
  const [viewedTeam, setViewedTeam] = useState(null)
  const [viewedTeamForm, setViewedTeamForm] = useState(initialForm)
  const [teamPlayers, setTeamPlayers] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [editingViewedTeam, setEditingViewedTeam] = useState(false)
  const [matchForm, setMatchForm] = useState(initialMatchForm)
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [showAutoConfirm, setShowAutoConfirm] = useState(false)
  const [showAutoAssign, setShowAutoAssign] = useState(false)
  const [autoAssign, setAutoAssign] = useState({ arbitro: true, cancha: true, horario: true })
  const [referees, setReferees] = useState([])
  const [refereeForm, setRefereeForm] = useState(initialRefereeForm)
  const [showRefereeForm, setShowRefereeForm] = useState(false)
  const [matches, setMatches] = useState([])
  const [activeSection, setActiveSection] = useState('equipos')
  const [editingMatch, setEditingMatch] = useState(null)
  const [editingReferee, setEditingReferee] = useState(null)
    const [courts, setCourts] = useState([])
    const [courtForm, setCourtForm] = useState(initialCourtForm)
    const [showCourtForm, setShowCourtForm] = useState(false)
    const [editingCourt, setEditingCourt] = useState(null)
    const [courtFormError, setCourtFormError] = useState('')
  const [showSettingsForm, setShowSettingsForm] = useState(false)
  const [showAdvanceConfirmation, setShowAdvanceConfirmation] = useState(false)
  const [showMessageSimulation, setShowMessageSimulation] = useState(false)
  const [simulatedMessages, setSimulatedMessages] = useState([])
  const [settingsForm, setSettingsForm] = useState({ jornada: 1, actualizacionJornada: 'lunes', email: '', duracionPartido: 60, formatoTorneo: 'todos-vs-todos-una-vuelta', avisoPartidosDia: 'lunes', avisoPartidosHora: '09:00' })
  const lastScheduleAlert = useRef('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const [leagueData, teamsData, refereeData, matchData, courtData, adminContact] = await Promise.all([getLeagueBySlug(slug), getTeams(slug), getReferees(slug), getMatches(slug), getCourts(slug), getLeagueAdminContact(slug)])
        setLeague(leagueData)
        setSettingsForm({ jornada: leagueData.jornada ?? 1, actualizacionJornada: leagueData.actualizacionJornada || 'lunes', email: adminContact.email || '', duracionPartido: leagueData.duracionPartido || 60, formatoTorneo: leagueData.formatoTorneo || 'todos-vs-todos-una-vuelta', avisoPartidosDia: leagueData.avisoPartidosDia || 'lunes', avisoPartidosHora: leagueData.avisoPartidosHora || '09:00' })
        setTeams(teamsData)
        setReferees(refereeData)
        setMatches(matchData)
        setCourts(courtData)
      } catch (error) {
        setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo cargar la liga.' })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [slug])

  useEffect(() => {
    if (!league || !settingsForm.avisoPartidosDia || !settingsForm.avisoPartidosHora) return undefined

    const checkScheduledAlert = () => {
      const now = new Date()
      const currentDay = weekdays[now.getDay()]
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const dateKey = `${slug}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}:${settingsForm.avisoPartidosDia}:${settingsForm.avisoPartidosHora}`

      if (currentDay !== settingsForm.avisoPartidosDia || currentTime !== settingsForm.avisoPartidosHora || lastScheduleAlert.current === dateKey) return

      lastScheduleAlert.current = dateKey
      setStatus({ type: 'success', message: `Alerta de prueba: llegó el horario configurado para avisar los partidos de ${league.nombre}.` })
    }

    checkScheduledAlert()
    const intervalId = window.setInterval(checkScheduledAlert, 15000)
    return () => window.clearInterval(intervalId)
  }, [league, settingsForm.avisoPartidosDia, settingsForm.avisoPartidosHora, slug])

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const updatePlayerField = (field, value) => setPlayerForm((current) => ({ ...current, [field]: value }))
  const updateViewedTeamField = (field, value) => setViewedTeamForm((current) => ({ ...current, [field]: value }))
  const getCourtTimeOptions = (courtList, form) => {
    const court = courtList.find((item) => item._id === form.cancha_id)
    const day = form.fecha ? weekdayNames[new Date(`${form.fecha}T00:00`).getDay()] : null
    const times = (court?.horarios || []).filter((slot) => !day || slot.dia === day).map((slot) => slot.horaInicio)
    return [...new Set([...times, ...(form.hora ? [form.hora] : [])])].sort()
  }
  const updateMatchField = (field, value) => setMatchForm((current) => ({ ...current, [field]: value }))
  const updateRefereeField = (field, value) => setRefereeForm((current) => ({ ...current, [field]: value }))
  const updateCourtField = (field, value) => setCourtForm((current) => ({ ...current, [field]: value }))
  const addCourtSchedule = () => {
    setCourtFormError('')
    setCourtForm((current) => ({ ...current, horarios: [...current.horarios, { ...emptyCourtSchedule }] }))
  }
  const updateCourtSchedule = (index, field, value) => {
    setCourtFormError('')
    setCourtForm((current) => ({ ...current, horarios: current.horarios.map((schedule, scheduleIndex) => scheduleIndex === index ? { ...schedule, [field]: value } : schedule) }))
  }
  const removeCourtSchedule = (index) => {
    setCourtFormError('')
    setCourtForm((current) => ({ ...current, horarios: current.horarios.filter((_, scheduleIndex) => scheduleIndex !== index) }))
  }
  const updateSettingsField = (field, value) => setSettingsForm((current) => ({ ...current, [field]: value }))
  const updateEventField = (index, field, value) => setMatchForm((current) => ({ ...current, eventos: current.eventos.map((eventItem, eventIndex) => eventIndex === index ? { ...eventItem, [field]: value } : eventItem) }))

  const handleMatchSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const payload = {
        ...matchForm,
        liga_id: slug,
        jornada: Number(matchForm.jornada),
        arbitro_id: matchForm.arbitro_id || null,
        cancha_id: matchForm.cancha_id || null,
        fecha: matchForm.fecha && matchForm.hora ? new Date(`${matchForm.fecha}T${matchForm.hora}`).toISOString() : null,
        hora: matchForm.hora || null,
        marcadorLocal: Number(matchForm.marcadorLocal),
        marcadorVisitante: Number(matchForm.marcadorVisitante),
        eventos: matchForm.eventos.map((eventItem) => ({ ...eventItem, jugador_numero: Number(eventItem.jugador_numero), minuto: Number(eventItem.minuto) })),
      }
      if (editingMatch) await updateMatch(editingMatch._id, payload)
      else await createMatch(payload)
      setMatches(await getMatches(slug))
      setMatchForm(initialMatchForm)
      setEditingMatch(null)
      setShowMatchForm(false)
      setStatus({ type: 'success', message: editingMatch ? 'Partido actualizado correctamente.' : 'Partido creado correctamente.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo crear el partido.' })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateMatches = async () => {
    setShowAutoAssign(false)
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const { count } = await generateLeagueMatches(slug, autoAssign)
      setMatches(await getMatches(slug))
      setStatus({
        type: count ? 'success' : 'error',
        message: count
          ? `Se generaron ${count} partido(s) automáticamente.`
          : 'No hay partidos pendientes por generar para el formato y la jornada actuales.',
      })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudieron generar los partidos automáticamente.' })
    } finally {
      setSaving(false)
    }
  }

  const handleRefereeSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const payload = { ...refereeForm, liga_id: slug }
      const referee = editingReferee ? await updateReferee(editingReferee._id, payload) : await createReferee(payload)
      setReferees((current) => editingReferee ? current.map((item) => item._id === referee._id ? referee : item) : [...current, referee].sort((first, second) => first.nombre.localeCompare(second.nombre)))
      setRefereeForm(initialRefereeForm)
      setEditingReferee(null)
      setShowRefereeForm(false)
      setStatus({ type: 'success', message: editingReferee ? 'Árbitro actualizado correctamente.' : 'Árbitro creado correctamente.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo crear el árbitro.' })
    } finally {
      setSaving(false)
    }
  }

  const handleCourtSubmit = async (event) => {
    event.preventDefault()
    if (hasCourtScheduleConflict(courtForm.horarios, league.duracionPartido || 60)) return

    setSaving(true)
    setCourtFormError('')
    setStatus({ type: '', message: '' })
    try {
      const payload = { ...courtForm, liga_id: slug  }
      const court = editingCourt ? await updateCourt(editingCourt._id, payload) : await createCourt(payload)
      setCourts((current) => editingCourt ? current.map((item) => item._id === court._id ? court : item) : [...current, court].sort((first, second) => first.nombre.localeCompare(second.nombre)))
      setCourtForm(initialCourtForm)
      setEditingCourt(null)
      setShowCourtForm(false)
      setStatus({ type: 'success', message: editingCourt ? 'Cancha actualizada correctamente.' : 'Cancha creada correctamente.' })
    } catch (error) {
      setCourtFormError(error.response?.data?.message || 'No se pudo guardar la cancha.')
    } finally {
      setSaving(false)
    }
  }

  const handleSettingsSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const updatedLeague = await updateLeague(slug, {
        jornada: Number(settingsForm.jornada),
        actualizacionJornada: settingsForm.actualizacionJornada,
        duracionPartido: Number(settingsForm.duracionPartido),
        formatoTorneo: settingsForm.formatoTorneo,
        avisoPartidosDia: settingsForm.avisoPartidosDia,
        avisoPartidosHora: settingsForm.avisoPartidosHora,
        dueno: { ...league.dueno, email: settingsForm.email.trim().toLowerCase() },
      })
      setLeague(updatedLeague)
      setSettingsForm((current) => ({ ...current, jornada: updatedLeague.jornada, actualizacionJornada: updatedLeague.actualizacionJornada, duracionPartido: updatedLeague.duracionPartido, formatoTorneo: updatedLeague.formatoTorneo, avisoPartidosDia: updatedLeague.avisoPartidosDia, avisoPartidosHora: updatedLeague.avisoPartidosHora }))
      setShowSettingsForm(false)
      setShowAdvanceConfirmation(false)
      setStatus({ type: 'success', message: 'Configuración de jornada actualizada.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo actualizar la configuración.' })
    } finally {
      setSaving(false)
    }
  }

  const handleAdvanceJornada = async () => {
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      const nextJornada = Number(settingsForm.jornada) + 1
      const { league: updatedLeague, notifications } = await advanceLeagueJornadaWithWhatsApp(
        slug,
        nextJornada,
        settingsForm.actualizacionJornada,
      )
      setLeague(updatedLeague)
      setSettingsForm((current) => ({ ...current, jornada: updatedLeague.jornada, actualizacionJornada: updatedLeague.actualizacionJornada }))
      setShowSettingsForm(false)
      setShowAdvanceConfirmation(false)
      setSimulatedMessages(notifications.map((notification) => ({
        id: notification.id,
        type: notification.role,
        name: notification.name,
        phone: notification.phone,
        fixture: notification.fixture,
        message: notification.message,
        status: notification.status,
        error: notification.error,
        messageId: notification.messageId,
      })))
      setShowMessageSimulation(true)
      const sentCount = notifications.filter((notification) => notification.status !== 'failed').length
      const failedCount = notifications.length - sentCount
      setStatus({
        type: failedCount ? 'error' : 'success',
        message: `Jornada ${updatedLeague.jornada} avanzada. WhatsApp aceptó ${sentCount} aviso(s); fallidos: ${failedCount}.`,
      })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo avanzar la jornada.' })
    } finally {
      setSaving(false)
    }
  }

  const openMatchEditor = (match = null) => {
    setStatus({ type: '', message: '' })
    setEditingMatch(match)
    if (match) {
      const matchDate = match.fecha ? new Date(match.fecha) : null
      setMatchForm({
        idPartido: match.idPartido,
        arbitro_id: match.arbitro_id?._id || match.arbitro_id || '',
        cancha_id: match.cancha_id?._id || match.cancha_id || '',
        jornada: match.jornada,
        fecha: matchDate ? `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, '0')}-${String(matchDate.getDate()).padStart(2, '0')}` : '',
        hora: matchDate ? (match.hora || `${String(matchDate.getHours()).padStart(2, '0')}:${String(matchDate.getMinutes()).padStart(2, '0')}`) : '',
        equipoLocal_id: match.equipoLocal_id._id || match.equipoLocal_id,
        equipoVisitante_id: match.equipoVisitante_id._id || match.equipoVisitante_id,
        marcadorLocal: match.marcadorLocal,
        marcadorVisitante: match.marcadorVisitante,
        estado: match.estado,
        eventos: match.eventos || [],
      })
    } else {
      setMatchForm({ ...initialMatchForm, jornada: Math.max((league?.jornada ?? 0) + 1, 1), idPartido: getNextMatchId(matches) })
    }
    setShowMatchForm(true)
  }

  const openRefereeEditor = (referee = null) => {
    setEditingReferee(referee)
    setRefereeForm(referee ? { nombre: referee.nombre, telefono: referee.telefono, estado: referee.estado } : initialRefereeForm)
    setShowRefereeForm(true)
  }

  const openCourtEditor = (court = null) => {
    setEditingCourt(court)
    setCourtForm(court ? { nombre: court.nombre, estado: court.estado, horarios: (court.horarios || []).map((schedule) => ({ ...schedule })) } : initialCourtForm)
    setCourtFormError('')
    setShowCourtForm(true)
  }

  const openTeamDetails = async (team) => {
    setViewedTeam(team)
    setEditingViewedTeam(false)
    setViewedTeamForm({ nombre: team.nombre, nombreCorto: team.nombreCorto, dtNombre: team.dt.nombre, dtWhatsapp: team.dt.whatsapp, colorPrimario: team.colorPrimario || '#1f6feb', colorSecundario: team.colorSecundario || '#ffffff', imagen: team.imagen || '', ...team.stats, racha: team.racha.join('') })
    setTeamPlayers(await getPlayers(team._id))
  }

  useEffect(() => {
    const routedTeam = codigo && teams.find((team) => team.nombreCorto.toUpperCase() === codigo.toUpperCase())
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    if (routedTeam) openTeamDetails(routedTeam)
  }, [codigo, teams.length])

  const handleTeamUpdate = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const updated = await updateTeam(viewedTeam._id, {
        ligaId: slug,
        nombre: viewedTeamForm.nombre.trim(),
        nombreCorto: viewedTeamForm.nombreCorto.trim().toUpperCase(),
        dt: { nombre: viewedTeamForm.dtNombre.trim(), whatsapp: viewedTeamForm.dtWhatsapp.trim() },
        colorPrimario: viewedTeamForm.colorPrimario,
        colorSecundario: viewedTeamForm.colorSecundario,
        imagen: viewedTeamForm.imagen.trim(),
        stats: Object.fromEntries(['pj', 'pg', 'pe', 'pp', 'gf', 'gc'].map((key) => [key, Number(viewedTeamForm[key])])),
        racha: viewedTeamForm.racha.toUpperCase().replace(/[^GEP]/g, '').split(''),
      })
      setViewedTeam(updated)
      setTeams((current) => current.map((team) => (team._id === updated._id ? updated : team)))
      setStatus({ type: 'success', message: 'Información del equipo actualizada.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo actualizar el equipo.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: '', message: '' })

    try {
      const team = await createTeam({
        ligaId: slug,
        nombre: form.nombre.trim(),
        nombreCorto: form.nombreCorto.trim().toUpperCase(),
        dt: { nombre: form.dtNombre.trim(), whatsapp: form.dtWhatsapp.trim() },
        colorPrimario: form.colorPrimario,
        colorSecundario: form.colorSecundario,
        imagen: form.imagen.trim(),
        stats: Object.fromEntries(['pj', 'pg', 'pe', 'pp', 'gf', 'gc'].map((key) => [key, Number(form[key])])),
        racha: form.racha.toUpperCase().replace(/[^GEP]/g, '').split(''),
      })
      setTeams((current) => [...current, team])
      setForm(initialForm)
      setShowTeamForm(false)
      setStatus({ type: 'success', message: 'Equipo creado correctamente en esta liga.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo crear el equipo.' })
    } finally {
      setSaving(false)
    }
  }

  const handlePlayerSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: '', message: '' })

    try {
      const payload = {
        equipo_id: selectedTeam._id,
        numero: Number(playerForm.numero),
        nombre_corto: playerForm.nombre_corto.trim(),
        nombre_completo: playerForm.nombre_completo.trim(),
        posicion: playerForm.posicion.trim(),
        foto_url: playerForm.foto_url.trim(),
        estado: playerForm.estado,
      }
      const savedPlayer = selectedPlayer ? await updatePlayer(selectedPlayer._id, payload) : await createPlayer(payload)
      setTeamPlayers((current) => selectedPlayer ? current.map((player) => (player._id === savedPlayer._id ? savedPlayer : player)) : [...current, savedPlayer])
      setShowPlayerForm(false)
      setSelectedTeam(null)
      setSelectedPlayer(null)
      setPlayerForm(initialPlayerForm)
      setStatus({ type: 'success', message: selectedPlayer ? 'Jugador actualizado correctamente.' : `Jugador agregado a ${selectedTeam.nombre}.` })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo crear el jugador.' })
    } finally {
      setSaving(false)
    }
  }

  const canManageMatches = teams.length >= 2 && referees.length >= 1 && courts.length >= 1

  if (loading) return <div className="loading-state">Cargando administración...</div>

  if (!league) {
    return <main className="league-page-state"><h1>Liga no disponible</h1><p>{status.message}</p><Link to="/admin">Volver al panel general</Link></main>
  }

  return (
    <div className="dashboard-shell admin-shell">
      <FloatingNotifications notifications={[
        status.message && { id: 'league-status', type: status.type, message: status.message },
        courtFormError && { id: 'court-error', type: 'error', message: courtFormError },
        hasCourtScheduleConflict(courtForm.horarios, league.duracionPartido || 60) && { id: 'court-schedule-conflict', type: 'error', message: `No se pueden empalmar partidos el mismo día a esa hora. La duración configurada es de ${league.duracionPartido || 60} minutos.` },
      ]} />
      <LeagueHeader league={league}>
        <Button variant="outline-danger" size="sm" onClick={logout}>Cerrar sesión</Button>
      </LeagueHeader>

      <main className="admin-main">
        <div className="admin-heading-row">
          <div>
            <p className="admin-eyebrow">Administración de liga</p>
            {/* <h1 className="admin-title">{league.nombre}</h1> */}
          </div>
          <Button variant="outline-secondary" onClick={() => setShowSettingsForm(true)}>Configuración</Button>
        </div>

        <Modal show={showSettingsForm} onHide={() => { setShowSettingsForm(false); setShowAdvanceConfirmation(false) }} centered>
          <Modal.Header closeButton><Modal.Title>Configuración de jornada</Modal.Title></Modal.Header>
          <Modal.Body>
            <form className="player-modal-form" onSubmit={handleSettingsSubmit}>
              <label>Jornada<input required type="number" min="0" value={settingsForm.jornada} onChange={(event) => updateSettingsField('jornada', event.target.value)} /></label>
                            <label>Correo de recuperación<input required type="email" autoComplete="email" value={settingsForm.email} onChange={(event) => updateSettingsField('email', event.target.value)} /></label>
              <label>Duración del partido (minutos)<input required type="number" min="10" max="240" step="1" value={settingsForm.duracionPartido} onChange={(event) => updateSettingsField('duracionPartido', event.target.value)} /></label>
                            <label>Formato de torneo<select value={settingsForm.formatoTorneo} onChange={(event) => updateSettingsField('formatoTorneo', event.target.value)}><option value="todos-vs-todos-una-vuelta">Todos vs Todos una sola vuelta</option><option value="todos-vs-todos-ida-y-vuelta">Todos vs todos ida y vuelta</option></select></label>
              <div className="settings-day-row">
                <label>Actualización de jornada<select value={settingsForm.actualizacionJornada} onChange={(event) => updateSettingsField('actualizacionJornada', event.target.value)}><option value="domingo">Domingo</option><option value="lunes">Lunes</option><option value="martes">Martes</option><option value="miércoles">Miércoles</option><option value="jueves">Jueves</option><option value="viernes">Viernes</option><option value="sábado">Sábado</option></select></label>
                <Button variant="outline-primary" type="button" onClick={() => setShowAdvanceConfirmation(true)} disabled={saving || showAdvanceConfirmation}>{saving ? 'Avanzando...' : 'Avanzar jornada'}</Button>
              </div>
              <label>Día para enviar avisos de partidos<select value={settingsForm.avisoPartidosDia} onChange={(event) => updateSettingsField('avisoPartidosDia', event.target.value)}><option value="domingo">Domingo</option><option value="lunes">Lunes</option><option value="martes">Martes</option><option value="miércoles">Miércoles</option><option value="jueves">Jueves</option><option value="viernes">Viernes</option><option value="sábado">Sábado</option></select></label>
              <label>Hora para enviar avisos<input required type="time" value={settingsForm.avisoPartidosHora} onChange={(event) => updateSettingsField('avisoPartidosHora', event.target.value)} /></label>
              {showAdvanceConfirmation && <div className="advance-confirmation" role="alert">
                <p>Al adelantar la jornada se enviarán por WhatsApp los detalles de los partidos pendientes a los árbitros y contactos DT de ambos equipos. ¿Deseas continuar?</p>
                <div className="advance-confirmation-actions">
                  <Button variant="outline-secondary" type="button" onClick={() => setShowAdvanceConfirmation(false)} disabled={saving}>Cancelar</Button>
                  <Button variant="danger" type="button" onClick={handleAdvanceJornada} disabled={saving}>{saving ? 'Avanzando y enviando...' : 'Confirmar avance'}</Button>
                </div>
              </div>}
              <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
            </form>
          </Modal.Body>
        </Modal>

        <Modal show={showMessageSimulation} onHide={() => setShowMessageSimulation(false)} centered size="lg">
          <Modal.Header closeButton><Modal.Title>Simulación de mensajes · {formatJornada(league.jornada)}</Modal.Title></Modal.Header>
          <Modal.Body>
            <p className="simulation-disclaimer">La API oficial aceptó los avisos marcados como enviados. La aceptación no garantiza que el destinatario ya los haya recibido.</p>
            {simulatedMessages.length === 0
              ? <p className="empty-players">No hay partidos pendientes en esta jornada.</p>
              : <div className="simulated-message-list">{simulatedMessages.map((item) => <article className="simulated-message" key={item.id}>
                <div><strong>{item.fixture}</strong><p className="simulated-recipient">{item.type}: {item.name} · {item.phone || 'Sin teléfono registrado'} · {item.status === 'failed' ? 'Falló' : `Aceptado: ${item.status}`}</p></div>
                <p className="simulated-message-text">{item.message}</p>
                {item.error && <p className="simulated-send-error">{item.error}</p>}
              </article>)}</div>}
          </Modal.Body>
          <Modal.Footer><Button variant="secondary" onClick={() => setShowMessageSimulation(false)}>Cerrar</Button></Modal.Footer>
        </Modal>
          <div className="admin-section-tabs"><Button variant={activeSection === 'equipos' ? 'primary' : 'outline-primary'} onClick={() => setActiveSection('equipos')}>Equipos</Button><Button variant={activeSection === 'arbitros' ? 'primary' : 'outline-primary'} onClick={() => setActiveSection('arbitros')}>Árbitros</Button><Button variant={activeSection === 'canchas' ? 'primary' : 'outline-primary'} onClick={() => setActiveSection('canchas')}>Canchas</Button><OverlayTrigger placement="top" overlay={canManageMatches ? <span /> : <Tooltip id="partidos-requisitos">Se ocupan mínimo 2 equipos, un árbitro y una cancha</Tooltip>}><span className="d-inline-block" tabIndex={canManageMatches ? -1 : 0}><Button variant={activeSection === 'partidos' ? 'primary' : 'outline-primary'} disabled={!canManageMatches} style={canManageMatches ? undefined : { pointerEvents: 'none' }} onClick={() => setActiveSection('partidos')}>Partidos</Button></span></OverlayTrigger></div>
       
        <section className="league-admin-scoped-list">
          {activeSection === 'equipos' && <><div className="list-heading"><Button variant="primary" onClick={() => { setForm(initialForm); setShowTeamForm(true) }}>Crear equipo</Button></div>{teams.length === 0 && <p className="empty-players">Todavía no hay equipos registrados.</p>}<TeamGrid teams={teams} onView={(team) => navigate(`/${slug}/equipo/${team.nombreCorto}`)} /></>}
          {activeSection === 'arbitros' && <><div className="list-heading"><Button variant="primary" onClick={() => openRefereeEditor()}>Añadir árbitro</Button></div>{referees.length === 0 && <p className="empty-players">Todavía no hay árbitros registrados.</p>}{referees.map((referee) => <article className="league-team-row" key={referee._id}><span><strong>{referee.nombre}</strong><small>{referee.telefono} · {referee.estado}</small></span><Button variant="outline-primary" onClick={() => openRefereeEditor(referee)}>Editar</Button></article>)}</>}
          {activeSection === 'partidos' && <><div className="list-heading"><div className="league-card-actions"><Button variant="primary" onClick={() => openMatchEditor()}>Crear partido</Button><Button variant="outline-primary" onClick={() => setShowAutoConfirm(true)} disabled={saving}>{saving ? 'Generando...' : 'Crear partidos automáticamente'}</Button></div></div>{matches.length === 0 && <p className="empty-players">Todavía no hay partidos registrados.</p>}{groupMatchesByJornada(matches).map(([jornada, jornadaMatches]) => <details className="jornada-group" key={jornada}><summary>{jornadaMatches.some(hasPendingAssignment) && <span className="pending-dot" title="Hay datos por asignar" />}Jornada {jornada}<small> &nbsp;&nbsp; {jornadaMatches.length} partidos</small></summary>{jornadaMatches.map((match) => <article className="match-row" key={match._id}><div className="match-row-main"><div className="match-row-teams">{[match.equipoLocal_id, match.equipoVisitante_id].map((ref, idx) => { const team = teams.find((item) => item._id === (ref?._id || ref)) || ref; return [idx === 1 && <strong key="vs" className="match-row-vs">VS</strong>, <span key={team._id} className="match-row-team" style={{ backgroundColor: team.colorPrimario || '#1e293b' }}>{team.imagen ? <img src={team.imagen} alt="" className="match-row-shield" /> : <span className="match-row-shield match-row-shield-empty" style={{ backgroundColor: team.colorSecundario || '#475569' }} />}{team.nombre}</span>] })}</div><div className="match-row-meta"><span className="match-row-estado">{match.estado}</span><span className="match-row-chip">🕒 {match.marcadorLocal} - {match.marcadorVisitante}</span><span>📅 {match.fecha ? new Date(match.fecha).toLocaleDateString() : <span className="pending-text">Fecha por asignar</span>}{match.hora ? ` • ${match.hora}` : ''}</span><span>📍 {match.cancha_id?.nombre || <span className="pending-text">Cancha por asignar</span>}</span>{match.arbitro_id?.nombre ? <span>🧑‍⚖️ {match.arbitro_id.nombre}</span> : <span className="match-row-warn">⚠ Árbitro por asignar</span>}</div></div><Button variant="primary" className="match-row-edit" onClick={() => openMatchEditor(match)}>✏️ Editar</Button></article>)}</details>)}</>}
          {activeSection === 'canchas' && <><div className="list-heading"><Button variant="primary" onClick={() => openCourtEditor()}>Crear cancha</Button></div>{courts.length === 0 && <p className="empty-players">Todavía no hay canchas registradas.</p>}{courts.map((court) => <article className="league-team-row" key={court._id}><span><strong>{court.nombre}</strong><small>{court.estado} · {(court.horarios || []).length} horario(s)</small></span><Button variant="outline-primary" onClick={() => openCourtEditor(court)}>Editar</Button></article>)}</>}
        </section>

        <Modal show={showCourtForm} onHide={() => setShowCourtForm(false)} centered>
          <Modal.Header closeButton><Modal.Title>{editingCourt ? 'Editar cancha' : 'Crear cancha'} en {league.nombre}</Modal.Title></Modal.Header>
          <Modal.Body>
            <form className="player-modal-form" onSubmit={handleCourtSubmit}>
              <label>Nombre<input required value={courtForm.nombre} onChange={(event) => updateCourtField('nombre', event.target.value)} placeholder="La Purísima 1" /></label>
              <label>Estado<select value={courtForm.estado} onChange={(event) => updateCourtField('estado', event.target.value)}><option value="activa">Activa</option><option value="inactiva">Inactiva</option></select></label>
              <div className="court-schedules">
                <div className="court-schedules-heading"><strong>Horarios</strong><Button variant="outline-primary" size="sm" type="button" onClick={addCourtSchedule}>Agregar horario</Button></div>
                {courtForm.horarios.length === 0 && <p className="empty-players">Esta cancha todavía no tiene horarios.</p>}
                {courtForm.horarios.map((schedule, index) => <div className="court-schedule-row" key={`court-schedule-${index}`}>
                  <label>Día<select value={schedule.dia} onChange={(event) => updateCourtSchedule(index, 'dia', event.target.value)}><option value="lunes">Lunes</option><option value="martes">Martes</option><option value="miércoles">Miércoles</option><option value="jueves">Jueves</option><option value="viernes">Viernes</option><option value="sábado">Sábado</option><option value="domingo">Domingo</option></select></label>
                  <label>Hora<input required type="time" value={schedule.horaInicio} onChange={(event) => updateCourtSchedule(index, 'horaInicio', event.target.value)} /></label>
                  <Button variant="outline-danger" size="sm" type="button" aria-label={`Quitar horario ${index + 1}`} onClick={() => removeCourtSchedule(index)}>Quitar</Button>
                </div>)}
              </div>
              <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : editingCourt ? 'Actualizar cancha' : 'Guardar cancha'}</Button>
            </form>
          </Modal.Body>
        </Modal>

        <Modal show={showTeamForm} onHide={() => setShowTeamForm(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Crear equipo en /{league.slug}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <form className="team-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>Nombre<input required value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} /></label>
                <label>Nombre corto<input required maxLength="5" value={form.nombreCorto} onChange={(event) => updateField('nombreCorto', event.target.value)} /></label>
                <label>Nombre del DT<input required value={form.dtNombre} onChange={(event) => updateField('dtNombre', event.target.value)} /></label>
                <label>WhatsApp del DT<input required value={form.dtWhatsapp} onChange={(event) => updateField('dtWhatsapp', event.target.value)} /></label>
                <label>Color principal<input type="color" value={form.colorPrimario} onChange={(event) => updateField('colorPrimario', event.target.value)} /></label>
                <label>Color secundario<input type="color" value={form.colorSecundario} onChange={(event) => updateField('colorSecundario', event.target.value)} /></label>
                <label>Imagen (URL)<input type="url" placeholder="https://..." value={form.imagen} onChange={(event) => updateField('imagen', event.target.value)} /></label>
                <label>Racha<input placeholder="GGGEG" pattern="[GgEePp]*" value={form.racha} onChange={(event) => updateField('racha', event.target.value)} /></label>
              </div>
              <div className="form-section"><h2>Estadísticas iniciales</h2><div className="stats-form-grid">{['pj', 'pg', 'pe', 'pp', 'gf', 'gc'].map((key) => <label key={key}>{key.toUpperCase()}<input type="number" min="0" value={form[key]} onChange={(event) => updateField(key, event.target.value)} /></label>)}<label>DG<input type="number" readOnly value={Number(form.gf) - Number(form.gc)} /></label><label>PTS<input type="number" readOnly value={(Number(form.pg) * 3) + Number(form.pe)} /></label></div></div>
              <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar equipo'}</Button>
            </form>
          </Modal.Body>
        </Modal>

        <Modal show={showAutoConfirm} onHide={() => setShowAutoConfirm(false)} centered>
          <Modal.Header closeButton><Modal.Title>Crear partidos automáticamente</Modal.Title></Modal.Header>
          <Modal.Body>
            <p>La liga cuenta actualmente con:</p>
            <ul>
              <li><strong>Equipos:</strong> {teams.length}</li>
              <li><strong>Árbitros:</strong> {referees.length}</li>
              <li><strong>Canchas:</strong> {courts.length}
                {courts.length > 0 && <ul>{courts.map((court) => <li key={court._id}>{court.nombre}: {(court.horarios || []).length === 0 ? 'sin horarios' : court.horarios.map((slot) => `${slot.dia} ${slot.horaInicio}`).join(', ')}</li>)}</ul>}
              </li>
            </ul>
            <p>Los partidos se crearán con estos datos. ¿Desea continuar?</p>
            <div className="league-card-actions"><Button variant="outline-secondary" onClick={() => setShowAutoConfirm(false)}>Cancelar</Button><Button variant="primary" onClick={() => { setShowAutoConfirm(false); setShowAutoAssign(true) }}>Sí</Button></div>
          </Modal.Body>
        </Modal>

        <Modal show={showAutoAssign} onHide={() => setShowAutoAssign(false)} centered>
          <Modal.Header closeButton><Modal.Title>Asignar automáticamente</Modal.Title></Modal.Header>
          <Modal.Body>
            <p>Selecciona qué se asignará de forma automática. Lo que no selecciones quedará pendiente para editarlo en cada partido.</p>
            {[['arbitro', 'Árbitro'], ['cancha', 'Cancha'], ['horario', 'Horario']].map(([key, label]) => <label className="auto-assign-option" key={key}><input type="checkbox" checked={autoAssign[key]} onChange={(event) => setAutoAssign((current) => ({ ...current, [key]: event.target.checked }))} /> {label}</label>)}
            <div className="league-card-actions"><Button variant="outline-secondary" onClick={() => setShowAutoAssign(false)}>Cancelar</Button><Button variant="primary" onClick={handleGenerateMatches} disabled={saving}>Crear partidos</Button></div>
          </Modal.Body>
        </Modal>

        <Modal show={showMatchForm} onHide={() => setShowMatchForm(false)} centered size="lg" dialogClassName="match-modal">
 
          <Modal.Body>
            <div className="match-card">
              <span className="match-card-round">Jornada {matchForm.jornada}</span>
              <div className="match-card-banner">
                {[['equipoLocal_id', 'Equipo local'], ['equipoVisitante_id', 'Equipo visitante']].map(([field, fallback], index) => {
                  const team = teams.find((item) => item._id === matchForm[field])
                  const side = (
                    <div className="match-card-side" key={field} style={{ backgroundColor: team?.colorPrimario || '#1e293b', borderBottomColor: team?.colorSecundario || '#475569' }}>
                      {team?.imagen ? <img className="match-card-shield" src={team.imagen} alt={`Escudo de ${team.nombre}`} /> : <span className="match-card-shield match-card-shield-empty" style={{ backgroundColor: team?.colorSecundario || '#475569' }} />}
                      <span className="match-card-team">{team?.nombre || fallback}</span>
                    </div>
                  )
                  return index === 0 ? [side, <span className="match-card-vs" key="vs">VS</span>] : side
                })}
              </div>
              <span className={`match-card-badge match-card-badge-${matchForm.estado}`}>{{ programado: 'Pendiente', finalizado: 'Finalizado', suspendido: 'Suspendido', en_curso: 'En curso' }[matchForm.estado] || 'Pendiente'}</span>
            </div>
            <h3 className="match-card-editable-title">Datos editables</h3>
            <form className="team-form" onSubmit={handleMatchSubmit}>
              <div className="match-form-grid">
                <div className="match-form-row match-form-row-three">
                  {!editingMatch && <label>Jornada<select required value={matchForm.jornada} onChange={(event) => updateMatchField('jornada', event.target.value)}>{getJornadaOptions(league, teams, null).map((number) => <option key={number} value={number}>Jornada {number}</option>)}</select><small>Se generarán {getTotalJornadas(league, teams)} jornadas en total</small></label>}
                  <label><span className="fl"><i className="fi fi-ref">👤</i>Árbitro</span><select value={matchForm.arbitro_id} onChange={(event) => updateMatchField('arbitro_id', event.target.value)}><option value="">Selecciona árbitro</option>{referees.filter((referee) => referee.estado === 'activo').map((referee) => <option key={referee._id} value={referee._id}>{referee.nombre} · {referee.telefono}</option>)}</select></label>
                  <label><span className="fl fl-court"><i className="fi fi-court">📍</i>Cancha</span><select value={matchForm.cancha_id} onChange={(event) => setMatchForm((current) => ({ ...current, cancha_id: event.target.value, hora: '' }))}><option value="">Selecciona cancha</option>{courts.filter((court) => court.estado === 'activa').map((court) => <option key={court._id} value={court._id}>{court.nombre}</option>)}</select></label>
                </div>
                <div className="match-form-row match-form-row-three">
                  <label><span className="fl fl-date"><i className="fi fi-date">📅</i>Fecha</span><input type="date" disabled={!matchForm.cancha_id} value={matchForm.fecha} onChange={(event) => updateMatchField('fecha', event.target.value)} /></label>
                  <label><span className="fl fl-time"><i className="fi fi-time">🕒</i>Hora</span><input type="time" value={matchForm.hora} onChange={(event) => updateMatchField('hora', event.target.value)} /></label>
                  {!editingMatch && <label>Estado<select value={matchForm.estado} onChange={(event) => updateMatchField('estado', event.target.value)}><option value="programado">Pendiente</option><option value="finalizado">Finalizado</option><option value="suspendido">Suspendido</option></select></label>}
                </div>
                {!editingMatch && <div className="match-form-row match-form-row-two">
                  <label>Equipo local<select required disabled={Boolean(editingMatch)} value={matchForm.equipoLocal_id} onChange={(event) => updateMatchField('equipoLocal_id', event.target.value)}><option value="">Selecciona equipo</option>{teams.filter((team) => team._id !== matchForm.equipoVisitante_id).map((team) => <option key={team._id} value={team._id}>{team.nombre}</option>)}</select></label>
                  <label>Equipo visitante<select required disabled={Boolean(editingMatch)} value={matchForm.equipoVisitante_id} onChange={(event) => updateMatchField('equipoVisitante_id', event.target.value)}><option value="">Selecciona equipo</option>{teams.filter((team) => team._id !== matchForm.equipoLocal_id).map((team) => <option key={team._id} value={team._id}>{team.nombre}</option>)}</select></label>
                </div>}
                {!['programado', 'suspendido'].includes(matchForm.estado) && <div className="match-form-row match-form-row-two">
                  <label>Marcador local<input type="number" min="0" value={matchForm.marcadorLocal} onChange={(event) => updateMatchField('marcadorLocal', event.target.value)} /></label>
                  <label>Marcador visitante<input type="number" min="0" value={matchForm.marcadorVisitante} onChange={(event) => updateMatchField('marcadorVisitante', event.target.value)} /></label>
                </div>}
              </div>
              {!['programado', 'suspendido'].includes(matchForm.estado) && <div className="form-section"><div className="form-section-heading"><h2>Eventos</h2><Button type="button" variant="outline-secondary" onClick={() => setMatchForm((current) => ({ ...current, eventos: [...current.eventos, { ...emptyEvent, equipo_id: current.equipoLocal_id }] }))}>Agregar evento</Button></div>
                {matchForm.eventos.map((eventItem, index) => <div className="player-form-row" key={`match-event-${index}`}><label>Equipo<select required value={eventItem.equipo_id} onChange={(event) => updateEventField(index, 'equipo_id', event.target.value)}><option value="">Equipo</option>{teams.map((team) => <option key={team._id} value={team._id}>{team.nombre}</option>)}</select></label><label>Tipo<select value={eventItem.tipo} onChange={(event) => updateEventField(index, 'tipo', event.target.value)}><option value="GOL">GOL</option><option value="TA">TA</option><option value="TR">TR</option></select></label><label>Jugador<input required type="number" min="1" max="99" value={eventItem.jugador_numero} onChange={(event) => updateEventField(index, 'jugador_numero', event.target.value)} /></label><label>Minuto<input required type="number" min="0" max="120" value={eventItem.minuto} onChange={(event) => updateEventField(index, 'minuto', event.target.value)} /></label></div>)}
              </div>}
              <div className="match-submit"><Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : editingMatch ? '🔄 Actualizar partido' : 'Guardar partido'}</Button></div>
            </form>
          </Modal.Body>
        </Modal>

        <Modal show={showRefereeForm} onHide={() => setShowRefereeForm(false)} centered>
          <Modal.Header closeButton><Modal.Title>{editingReferee ? 'Editar árbitro' : 'Añadir árbitro'} a {league.nombre}</Modal.Title></Modal.Header>
          <Modal.Body>
            <form className="player-modal-form" onSubmit={handleRefereeSubmit}>
              <label>Nombre<input required value={refereeForm.nombre} onChange={(event) => updateRefereeField('nombre', event.target.value)} /></label>
              <label>Teléfono<input required type="tel" value={refereeForm.telefono} onChange={(event) => updateRefereeField('telefono', event.target.value)} /></label>
              <label>Estado<select value={refereeForm.estado} onChange={(event) => updateRefereeField('estado', event.target.value)}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
              <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : editingReferee ? 'Actualizar árbitro' : 'Guardar árbitro'}</Button>
            </form>
          </Modal.Body>
        </Modal>

        <Modal show={Boolean(viewedTeam)} onHide={() => { setViewedTeam(null); if (codigo) navigate(`/${slug}/admin`) }} fullscreen>
          <Modal.Header closeButton>
            <Modal.Title>{viewedTeam ? `${viewedTeam.nombre} · Información del equipo` : 'Equipo'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {viewedTeam && <>
              {!editingViewedTeam && <EquipoDetalle
                equipo={viewedTeam}
                jugadores={teamPlayers}
                onEditar={() => setEditingViewedTeam(true)}
                onAgregarJugador={() => { setSelectedTeam(viewedTeam); setSelectedPlayer(null); setPlayerForm(initialPlayerForm); setShowPlayerForm(true) }}
                onEditarJugador={(player) => { setSelectedTeam(viewedTeam); setSelectedPlayer(player); setPlayerForm(player); setShowPlayerForm(true) }}
              />}
              {editingViewedTeam && <form className="team-form" onSubmit={handleTeamUpdate}>
                <div className="form-grid">
                  <label>Nombre<input required value={viewedTeamForm.nombre} onChange={(event) => updateViewedTeamField('nombre', event.target.value)} /></label>
                  <label>Nombre corto<input required maxLength="5" value={viewedTeamForm.nombreCorto} onChange={(event) => updateViewedTeamField('nombreCorto', event.target.value)} /></label>
                  <label>Nombre del DT<input required value={viewedTeamForm.dtNombre} onChange={(event) => updateViewedTeamField('dtNombre', event.target.value)} /></label>
                  <label>WhatsApp del DT<input required value={viewedTeamForm.dtWhatsapp} onChange={(event) => updateViewedTeamField('dtWhatsapp', event.target.value)} /></label>
                  <label>Color principal<input type="color" value={viewedTeamForm.colorPrimario} onChange={(event) => updateViewedTeamField('colorPrimario', event.target.value)} /></label>
                  <label>Color secundario<input type="color" value={viewedTeamForm.colorSecundario} onChange={(event) => updateViewedTeamField('colorSecundario', event.target.value)} /></label>
                  <label>Imagen (URL)<input type="url" placeholder="https://..." value={viewedTeamForm.imagen} onChange={(event) => updateViewedTeamField('imagen', event.target.value)} /></label>
                  <label>Racha<input pattern="[GgEePp]*" value={viewedTeamForm.racha} onChange={(event) => updateViewedTeamField('racha', event.target.value)} /></label>
                </div>
                <div className="form-section"><h2>Estadísticas</h2><div className="stats-form-grid">{['pj', 'pg', 'pe', 'pp', 'gf', 'gc'].map((key) => <label key={key}>{key.toUpperCase()}<input type="number" min="0" value={viewedTeamForm[key]} onChange={(event) => updateViewedTeamField(key, event.target.value)} /></label>)}<label>DG<input readOnly value={Number(viewedTeamForm.gf) - Number(viewedTeamForm.gc)} /></label><label>PTS<input readOnly value={(Number(viewedTeamForm.pg) * 3) + Number(viewedTeamForm.pe)} /></label></div></div>
                <div className="league-card-actions"><Button variant="outline-secondary" type="button" onClick={() => setEditingViewedTeam(false)}>Cancelar</Button><Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar equipo'}</Button></div>
              </form>}
              {editingViewedTeam && <div className="league-admin-scoped-list player-list-in-modal"><h2>Jugadores</h2>{teamPlayers.length === 0 && <p className="empty-players">No hay jugadores registrados.</p>}{teamPlayers.map((player) => <div className="league-team-row" key={player._id}><span><strong>#{player.numero} {player.nombre_corto}</strong><small>{player.nombre_completo} · {player.posicion} · {player.estado}</small></span></div>)}</div>}
            </>}
          </Modal.Body>
        </Modal>

        <Modal show={showPlayerForm} onHide={() => setShowPlayerForm(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>{selectedPlayer ? 'Editar jugador' : selectedTeam ? `Nuevo jugador · ${selectedTeam.nombre}` : 'Nuevo jugador'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <form className="player-modal-form" onSubmit={handlePlayerSubmit}>
              <label>Número<input required type="number" min="1" max="99" value={playerForm.numero} onChange={(event) => updatePlayerField('numero', event.target.value)} /></label>
              <label>Nombre corto<input required value={playerForm.nombre_corto} onChange={(event) => updatePlayerField('nombre_corto', event.target.value)} /></label>
              <label>Nombre completo<input required value={playerForm.nombre_completo} onChange={(event) => updatePlayerField('nombre_completo', event.target.value)} /></label>
              <label>Posición<select required value={playerForm.posicion} onChange={(event) => updatePlayerField('posicion', event.target.value)}><option value="">Selecciona posición</option><option value="POR">POR</option><option value="DEF">DEF</option><option value="MED">MED</option><option value="DEL">DEL</option></select></label>
              <label>Foto URL (opcional)<input value={playerForm.foto_url} onChange={(event) => updatePlayerField('foto_url', event.target.value)} /></label>
              <label>Estado<select value={playerForm.estado} onChange={(event) => updatePlayerField('estado', event.target.value)}><option value="activo">Activo</option><option value="suspendido">Suspendido</option></select></label>
              <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar jugador'}</Button>
            </form>
          </Modal.Body>
        </Modal>
      </main>
    </div>
  )
}

export default LeagueAdmin





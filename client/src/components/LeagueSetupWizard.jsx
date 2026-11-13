import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import FloatingNotifications from './FloatingNotifications'
import {
  completeLeagueWizard,
  createWizardCourt,
  createWizardReferee,
  createWizardTeam,
  getCourts,
  getLeagueBySlug,
  getReferees,
  getTeams,
  saveLeagueWizardConfig,
  saveLeagueWizardProgress,
} from '../services/leagueApi'
import '../index.css'

const weekdays = [
  ['lunes', 'Lunes'],
  ['martes', 'Martes'],
  ['miércoles', 'Miércoles'],
  ['jueves', 'Jueves'],
  ['viernes', 'Viernes'],
  ['sábado', 'Sábado'],
  ['domingo', 'Domingo'],
]
const formatLabels = {
  TIPO_1: 'Ida y vuelta',
  TIPO_2: 'Una vuelta',
  TIPO_3: 'Ida y vuelta + liguilla de 8',
  TIPO_4: 'Una vuelta + liguilla de 8',
}
const formatNames = {
  TIPO_1: 'Ida y vuelta',
  TIPO_2: 'Una vuelta',
  TIPO_3: 'Ida y vuelta + liguilla de 8',
  TIPO_4: 'Una vuelta + liguilla de 8',
}
const toLocalDateString = (date) => {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`
}
const nextSunday = () => {
  const date = new Date()
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7 || 7))
  return toLocalDateString(date)
}
const initialConfig = () => ({
  formatoLiga: 'TIPO_2',
  duracionPartidoMin: 60,
  diasJuego: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
  cambioDeJornada: 'lunes',
  diaEntregaInfo: { dia: 'miércoles', hora: '20:00' },
  fechaInicioLiga: nextSunday(),
  tipoInicioLiga: 'desde_cero',
})
const colorPalette = [
  '#111827', '#374151', '#6b7280', '#ffffff',
  '#7f1d1d', '#dc2626', '#f97316', '#f59e0b',
  '#facc15', '#84cc16', '#16a34a', '#0f766e',
  '#06b6d4', '#0284c7', '#1f6feb', '#1d4ed8',
  '#3730a3', '#7c3aed', '#a855f7', '#db2777',
  '#be185d', '#92400e', '#a16207', '#64748b',
]
const initialTeam = {
  nombre: '',
  nombreCorto: '',
  dtNombre: '',
  dtWhatsapp: '',
  colorPrimario: '#1f6feb',
  colorSecundario: '#ffffff',
  imagen: '',
}
const initialReferee = { nombre: '', whatsapp: '' }
const getDayForDate = (value) => {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  return weekdays[(new Date(year, month - 1, day).getDay() + 6) % 7][0]
}
const addDaysToDateString = (value, days) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10)
}
const getNextJourneyDate = (startDate, gameDays, changeDay) => {
  const normalizedChangeDay = normalizeChangeDay(changeDay)
  if (!weekdays.some(([day]) => day === normalizedChangeDay) || gameDays.length === 0) {
    return addDaysToDateString(startDate, 7)
  }
  let daysUntilChange = 1
  while (getDayForDate(addDaysToDateString(startDate, daysUntilChange)) !== normalizedChangeDay) {
    daysUntilChange += 1
  }
  return addDaysToDateString(startDate, daysUntilChange)
}
const getToday = () => toLocalDateString(new Date())
const hasScheduleConflict = (schedules, duration) => schedules.some((schedule, index) => {
  if (!schedule.horaInicio) return false
  const [hours, minutes] = schedule.horaInicio.split(':').map(Number)
  const start = hours * 60 + minutes
  return schedules.slice(index + 1).some((other) => {
    if (schedule.dia !== other.dia || !other.horaInicio) return false
    const [otherHours, otherMinutes] = other.horaInicio.split(':').map(Number)
    return Math.abs(start - (otherHours * 60 + otherMinutes)) < duration
  })
})
const getScheduleConflictIndex = (schedules, duration) => {
  let lastConflict = -1
  schedules.forEach((schedule, index) => {
    if (!schedule.horaInicio) return
    const [hours, minutes] = schedule.horaInicio.split(':').map(Number)
    const start = hours * 60 + minutes
    const hasConflict = schedules.slice(0, index).some((previous) => {
      if (previous.dia !== schedule.dia || !previous.horaInicio) return false
      const [previousHours, previousMinutes] = previous.horaInicio.split(':').map(Number)
      return Math.abs(start - (previousHours * 60 + previousMinutes)) < duration
    })
    if (hasConflict) lastConflict = index
  })
  return lastConflict
}
const getDaySlots = (court, day, duration) => {
  const startTimes = (court.horarios || [])
    .filter((schedule) => schedule.dia === day && /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.horaInicio || ''))
    .map((schedule) => Number(schedule.horaInicio.slice(0, 2)) * 60 + Number(schedule.horaInicio.slice(3, 5)))
    .sort((first, second) => first - second)
  let count = 0
  let nextAvailable = -1
  startTimes.forEach((start) => {
    if (start < nextAvailable) return
    count += 1
    nextAvailable = start + duration
  })
  return count
}
const getJourneySlots = (courts, startDate, endDate, duration) => {
  let slots = 0
  let dayCount = 0
  for (let date = startDate; date < endDate; date = addDaysToDateString(date, 1)) {
    const day = getDayForDate(date)
    slots += courts.reduce((total, court) => total + getDaySlots(court, day, duration), 0)
    dayCount += 1
  }
  return { slots, dayCount }
}
const normalizeChangeDay = (day) => ({
  cada_lunes: 'lunes',
  al_terminar_partidos: 'lunes',
}[day] || day)
const ColorPicker = ({ label, value, onChange, disabled }) => (
  <div className="wizard-color-picker">
    <span className="wizard-color-label">{label}</span>
    <div className="wizard-color-swatches" role="group" aria-label={label}>
      {colorPalette.map((color) => <button
        key={color}
        className={`wizard-color-swatch${value.toLowerCase() === color ? ' selected' : ''}`}
        type="button"
        title={color}
        aria-label={`${label}: ${color}`}
        aria-pressed={value.toLowerCase() === color}
        style={{ '--swatch-color': color }}
        onClick={() => onChange(color)}
        disabled={disabled}
      />)}
    </div>
    <label className="wizard-hex-field">Código hexadecimal
      <input type="text" value={value} pattern="#[0-9a-fA-F]{6}" maxLength={7} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-label={`${label} hexadecimal`} />
    </label>
  </div>
)
const getMaxStep = ({ configured, teamCount, courtCount, refereeCount }) => {
  if (!configured) return 1
  if (teamCount < 4) return 2
  if (courtCount < 1) return 3
  if (refereeCount < 1) return 4
  return 5
}

const WizardLayout = ({ onComplete }) => {
  const { slug } = useParams()
  const storageKey = `league-setup-wizard:${slug}`
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState(initialConfig)
  const [teamForm, setTeamForm] = useState(initialTeam)
  const [courtName, setCourtName] = useState('')
  const [schedules, setSchedules] = useState([{ dia: 'domingo', horaInicio: '18:00' }])
  const [refereeForm, setRefereeForm] = useState(initialReferee)
  const [teams, setTeams] = useState([])
  const [courts, setCourts] = useState([])
  const [referees, setReferees] = useState([])
  const [generationMode, setGenerationMode] = useState('automatico')
  const [hydrated, setHydrated] = useState(false)
  const [conflictScheduleIndex, setConflictScheduleIndex] = useState(-1)
  const [errorStep, setErrorStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const updateConfig = (field, value) => {
    setConfig((current) => ({ ...current, [field]: value }))
    if (field === 'diasJuego' && value.length) {
      setSchedules((current) => current.map((schedule) => (
        value.includes(schedule.dia) ? schedule : { ...schedule, dia: value[0] }
      )))
    }
  }
  const updateTeam = (field, value) => setTeamForm((current) => ({ ...current, [field]: value }))
  const updateReferee = (field, value) => setRefereeForm((current) => ({ ...current, [field]: value }))
  const updateSchedule = (index, field, value) => {
    setConflictScheduleIndex(-1)
    setSchedules((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
  }
  const selectedWeekday = getDayForDate(config.fechaInicioLiga)
  const matchesPerRound = Math.floor(teams.length / 2)
  const regularRounds = teams.length
    ? teams.length % 2 === 0 ? teams.length - 1 : teams.length
    : 0
  const totalJornadas = regularRounds * (['TIPO_1', 'TIPO_3'].includes(config.formatoLiga) ? 2 : 1)
  const totalRegularMatches = matchesPerRound * regularRounds
  const activeCourts = courts.filter((court) => court.estado === 'activa')
  const nextJourneyDate = config.fechaInicioLiga
    ? getNextJourneyDate(config.fechaInicioLiga, config.diasJuego, config.cambioDeJornada)
    : ''
  const { slots: availableSlots, dayCount: journeyWindowDays } = config.fechaInicioLiga
    ? getJourneySlots(activeCourts, config.fechaInicioLiga, nextJourneyDate, Number(config.duracionPartidoMin))
    : { slots: 0, dayCount: 0 }
  const journeyWindowLabel = config.fechaInicioLiga && nextJourneyDate
    ? `${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${config.fechaInicioLiga}T12:00:00`))}–${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${addDaysToDateString(nextJourneyDate, -1)}T12:00:00`))}`
    : ''
  const playoffFormat = ['TIPO_3', 'TIPO_4'].includes(config.formatoLiga)
  const summaryDate = config.fechaInicioLiga
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${config.fechaInicioLiga}T12:00:00`))
    : ''
  const dateWarning = config.fechaInicioLiga && config.fechaInicioLiga < getToday()
    ? 'La fecha de inicio no puede estar en el pasado.'
    : config.fechaInicioLiga && !config.diasJuego.includes(selectedWeekday)
      ? 'La fecha de inicio debe coincidir con uno de los días de juego seleccionados.'
      : ''
  const canScheduleJornada = availableSlots >= matchesPerRound
  const wizardNotifications = [
    error && {
      id: 'wizard-error',
      type: 'error',
      message: error,
      ...(errorStep > 0 ? { action: { label: `Ir al paso ${errorStep}`, onClick: () => goToStep(errorStep) } } : {}),
    },
    notice && { id: 'wizard-success', type: 'success', message: notice },
    dateWarning && step === 1 && {
      id: 'wizard-date-warning',
      type: 'warning',
      message: dateWarning,
    },
    step === 5 && teams.length < 4 && {
      id: 'wizard-teams-warning',
      type: 'warning',
      message: 'Faltan equipos. Registra al menos 4.',
      action: { label: 'Ir al paso 2', onClick: () => goToStep(2) },
    },
    step === 5 && playoffFormat && teams.length < 8 && {
      id: 'wizard-playoffs-warning',
      type: 'warning',
      message: 'La liguilla requiere al menos 8 equipos.',
      action: { label: 'Ir al paso 2', onClick: () => goToStep(2) },
    },
    step === 5 && courts.length < 1 && {
      id: 'wizard-courts-warning',
      type: 'warning',
      message: 'Registra al menos una cancha.',
      action: { label: 'Ir al paso 3', onClick: () => goToStep(3) },
    },
    step === 5 && referees.length < 1 && {
      id: 'wizard-referees-warning',
      type: 'warning',
      message: 'Registra al menos un árbitro.',
      action: { label: 'Ir al paso 4', onClick: () => goToStep(4) },
    },
    step === 5 && {
      id: 'wizard-capacity',
      type: canScheduleJornada ? 'success' : 'warning',
      message: canScheduleJornada
        ? `Capacidad de Jornada 1 (${journeyWindowLabel}): ${availableSlots} horarios distribuidos en los días de juego; se necesitan ${matchesPerRound}.`
        : `Para Jornada 1 (${journeyWindowLabel || 'periodo inicial'}) se necesitan ${matchesPerRound} horarios y hay ${availableSlots} disponibles en ${journeyWindowDays} días. Revisa las canchas y sus horarios del paso 3.`,
      ...(!canScheduleJornada ? {
        action: {
          label: 'Revisar canchas',
          onClick: () => goToStep(3),
        },
      } : {}),
    },
  ]

  useEffect(() => {
    let active = true
    const loadWizard = async () => {
      try {
        const [league, savedTeams, savedCourts, savedReferees] = await Promise.all([
          getLeagueBySlug(slug),
          getTeams(slug),
          getCourts(slug),
          getReferees(slug),
        ])
        if (!active) return
        setTeams(savedTeams)
        setCourts(savedCourts)
        setReferees(savedReferees)

        let draft = null
        try {
          const stored = window.localStorage.getItem(storageKey)
          draft = stored ? JSON.parse(stored) : null
        } catch {
          setError('No se pudo leer el progreso guardado en este navegador.')
        }
        if (draft?.config) {
          setConfig((current) => ({
            ...current,
            ...draft.config,
            cambioDeJornada: normalizeChangeDay(draft.config.cambioDeJornada),
            diasJuego: draft.config.diasJuego?.length ? draft.config.diasJuego : current.diasJuego,
          }))
          if (draft.teamForm) setTeamForm(draft.teamForm)
          if (draft.courtName) setCourtName(draft.courtName)
          if (draft.schedules?.length) setSchedules(draft.schedules)
          if (draft.refereeForm) setRefereeForm(draft.refereeForm)
          if (draft.generationMode) setGenerationMode(draft.generationMode)
        }
        else if (league.config?.formatoLiga) {
          setConfig((current) => ({
            ...current,
            formatoLiga: league.config.formatoLiga,
            duracionPartidoMin: league.config.duracionPartidoMin,
            diasJuego: league.config.diasJuego,
            cambioDeJornada: normalizeChangeDay(league.config.cambioDeJornada),
            diaEntregaInfo: league.config.diaEntregaInfo,
            fechaInicioLiga: league.config.fechaInicioLiga,
            tipoInicioLiga: league.config.tipoInicioLiga || 'desde_cero',
          }))
          setSchedules([{ dia: league.config.diasJuego?.[0] || 'lunes', horaInicio: '' }])
        }
        const maxStep = getMaxStep({
          configured: Boolean(league.config?.fechaInicioLiga),
          teamCount: savedTeams.length,
          courtCount: savedCourts.length,
          refereeCount: savedReferees.length,
        })
        const savedStep = draft?.step || league.config?.pasoWizard || 1
        setStep(Math.max(1, Math.min(savedStep, maxStep)))
        setHydrated(true)
      } catch (loadError) {
        if (active) {
          setError(loadError.response?.data?.message || 'No se pudo cargar la configuración inicial de la liga.')
          setHydrated(true)
        }
      }
    }
    loadWizard()
    return () => { active = false }
  }, [slug, storageKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ step, config, teamForm, courtName, schedules, refereeForm, generationMode }))
    } catch {
      window.setTimeout(() => setError('No se pudo guardar el progreso del asistente en este navegador.'), 0)
    }
  }, [step, config, teamForm, courtName, schedules, refereeForm, generationMode, storageKey, hydrated])

  const moveToStep = async (nextStep) => {
    await saveLeagueWizardProgress(slug, nextStep)
    setStep(nextStep)
    setError('')
    setErrorStep(0)
    setNotice('')
  }

  const goToStep = async (nextStep) => {
    setSaving(true)
    try {
      await moveToStep(nextStep)
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'No se pudo guardar el progreso del asistente.')
    } finally {
      setSaving(false)
    }
  }

  const handleStepOne = async (event) => {
    event.preventDefault()
    setError('')
    if (dateWarning) return setError(dateWarning)
    if (!config.diasJuego.length) return setError('Selecciona al menos un día de juego.')
    if (config.tipoInicioLiga !== 'desde_cero') return setError('La opción de liga ya empezada estará disponible próximamente.')
    setSaving(true)
    try {
      await saveLeagueWizardConfig(slug, config)
      await moveToStep(2)
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'No se pudo guardar la configuración del torneo.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateTeam = async (event) => {
    event.preventDefault()
    if (teams.length >= 24) return setError('Una liga puede tener como máximo 24 equipos.')
    setSaving(true)
    setError('')
    try {
      const team = await createWizardTeam(slug, {
        nombre: teamForm.nombre.trim(),
        nombreCorto: teamForm.nombreCorto.trim().toUpperCase(),
        dt: { nombre: teamForm.dtNombre.trim(), whatsapp: teamForm.dtWhatsapp.trim() },
        colorPrimario: teamForm.colorPrimario,
        colorSecundario: teamForm.colorSecundario,
        imagen: teamForm.imagen.trim(),
      })
      setTeams((current) => [...current, team].sort((first, second) => first.nombre.localeCompare(second.nombre)))
      setTeamForm(initialTeam)
      setNotice('Equipo agregado.')
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'No se pudo agregar el equipo.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCourt = async (event) => {
    event.preventDefault()
    setError('')
    if (!schedules.length || schedules.some((schedule) => !schedule.horaInicio)) return setError('Agrega al menos un horario completo.')
    const conflictIndex = getScheduleConflictIndex(schedules, Number(config.duracionPartidoMin))
    if (hasScheduleConflict(schedules, Number(config.duracionPartidoMin))) {
      setConflictScheduleIndex(conflictIndex)
      setError(`El horario ${schedules[conflictIndex].horaInicio} se empalma con otro horario de esta cancha.`)
      return
    }
    setConflictScheduleIndex(-1)
    setSaving(true)
    try {
      const court = await createWizardCourt(slug, { nombre: courtName.trim(), horarios: schedules })
      setCourts((current) => [...current, court].sort((first, second) => first.nombre.localeCompare(second.nombre)))
      setCourtName('')
      setSchedules([{ dia: config.diasJuego[0] || 'lunes', horaInicio: '' }])
      setNotice('Cancha agregada.')
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'No se pudo agregar la cancha.')
      setConflictScheduleIndex(Number.isInteger(saveError.response?.data?.conflictIndex)
        ? saveError.response.data.conflictIndex
        : -1)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateReferee = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const referee = await createWizardReferee(slug, {
        nombre: refereeForm.nombre.trim(),
        whatsapp: refereeForm.whatsapp.trim(),
      })
      setReferees((current) => [...current, referee].sort((first, second) => first.nombre.localeCompare(second.nombre)))
      setRefereeForm(initialReferee)
      setNotice('Árbitro agregado.')
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'No se pudo agregar el árbitro.')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    setError('')
    try {
      const result = await completeLeagueWizard(slug, generationMode)
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        setError('La liga quedó configurada, pero no se pudo borrar el borrador local del asistente.')
      }
      setNotice(`Se generó el calendario de fase regular con ${result.count} partidos en ${result.totalJornadas} jornadas.`)
      onComplete()
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'No se pudo generar el calendario.')
      setErrorStep(saveError.response?.data?.step || 0)
    } finally {
      setSaving(false)
    }
  }

  const handleNextResourceStep = async (minimum, nextStep, message) => {
    if (minimum) {
      setError(message)
      return
    }
    setSaving(true)
    try {
      await moveToStep(nextStep)
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'No se pudo guardar el progreso del asistente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="admin-access-shell">
      <section className="admin-access-panel wizard-panel">
        <FloatingNotifications notifications={wizardNotifications} />
        <p className="admin-eyebrow">Liga /{slug}</p>
        <h1>Configura tu liga</h1>
        <p className="wizard-progress-label">Paso {step} de 5</p>
        <div className="wizard-progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="5" aria-valuenow={step}>
          <span style={{ width: `${step * 20}%` }} />
        </div>
        {step === 1 && <form className="admin-access-form" onSubmit={handleStepOne}>
          <h2>Paso 1 · Configuración del torneo</h2>
          <label>Formato de liga
            <select value={config.formatoLiga} onChange={(event) => updateConfig('formatoLiga', event.target.value)} disabled={saving}>
              {Object.entries(formatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {playoffFormat && <p className="wizard-help">Liguilla: 1 vs 8, 2 vs 7, 3 vs 6 y 4 vs 5 a ida y vuelta. En cuartos y semifinal pasa la mejor posición de tabla en caso de empate; la final se define en tiempo extra y penales.</p>}
          <label>Duración del partido (minutos)
            <input required type="number" min="10" max="240" step="1" value={config.duracionPartidoMin} onChange={(event) => updateConfig('duracionPartidoMin', Number(event.target.value))} disabled={saving} />
          </label>
          <fieldset className="wizard-day-picker">
            <legend>Días de juego</legend>
            {weekdays.map(([value, label]) => <label key={value}>
              <input type="checkbox" checked={config.diasJuego.includes(value)} onChange={(event) => updateConfig('diasJuego', event.target.checked
                ? [...config.diasJuego, value]
                : config.diasJuego.filter((day) => day !== value))} disabled={saving} />
              {label}
            </label>)}
          </fieldset>
          <label>Cambio de jornada
            <select value={config.cambioDeJornada} onChange={(event) => updateConfig('cambioDeJornada', event.target.value)} disabled={saving}>
              {weekdays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="wizard-inline-fields">
            <label>Día para enviar información a DTs
              <select value={config.diaEntregaInfo.dia} onChange={(event) => updateConfig('diaEntregaInfo', { ...config.diaEntregaInfo, dia: event.target.value })} disabled={saving}>
                {weekdays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Hora
              <input required type="time" value={config.diaEntregaInfo.hora} onChange={(event) => updateConfig('diaEntregaInfo', { ...config.diaEntregaInfo, hora: event.target.value })} disabled={saving} />
            </label>
          </div>
          <div className="wizard-inline-fields">
            <label>¿Qué día inicia la liga? / Fecha J1
              <input required type="date" min={getToday()} value={config.fechaInicioLiga} onChange={(event) => updateConfig('fechaInicioLiga', event.target.value)} disabled={saving} />
            </label>
          </div>
          <fieldset className="wizard-radio-picker">
            <legend>Tipo de inicio</legend>
            <label><input type="radio" name="tipoInicioLiga" value="desde_cero" checked={config.tipoInicioLiga === 'desde_cero'} onChange={() => updateConfig('tipoInicioLiga', 'desde_cero')} />Desde cero</label>
            <label><input type="radio" name="tipoInicioLiga" value="liga_ya_empezada" checked={false} onChange={() => { updateConfig('tipoInicioLiga', 'desde_cero'); setNotice('Liga ya empezada: Próximamente. Se mantiene la opción Desde cero.') }} />Liga ya empezada <span>Próximamente</span></label>
          </fieldset>
          <button className="admin-primary-button" type="submit" disabled={saving || Boolean(dateWarning) || !config.diasJuego.length}>{saving ? 'Guardando...' : 'Siguiente'}</button>
        </form>}

        {step === 2 && <section className="wizard-step">
          <h2>Paso 2 · Equipos</h2>
          <p className="wizard-count">Llevas {teams.length}/24 equipos</p>
          <form className="admin-access-form" onSubmit={handleCreateTeam}>
            <label>Nombre del equipo<input required maxLength={80} value={teamForm.nombre} onChange={(event) => updateTeam('nombre', event.target.value)} disabled={saving || teams.length >= 24} /></label>
            <label>Nombre corto (máximo 5 caracteres)<input required maxLength={5} value={teamForm.nombreCorto} onChange={(event) => updateTeam('nombreCorto', event.target.value)} disabled={saving || teams.length >= 24} /></label>
            <label>Nombre del DT o capitán<input required value={teamForm.dtNombre} onChange={(event) => updateTeam('dtNombre', event.target.value)} disabled={saving || teams.length >= 24} /></label>
            <label>WhatsApp de contacto<input required type="tel" value={teamForm.dtWhatsapp} onChange={(event) => updateTeam('dtWhatsapp', event.target.value)} disabled={saving || teams.length >= 24} /></label>
            <div className="wizard-inline-fields">
              <ColorPicker label="Color primario" value={teamForm.colorPrimario} onChange={(value) => updateTeam('colorPrimario', value)} disabled={saving} />
              <ColorPicker label="Color secundario" value={teamForm.colorSecundario} onChange={(value) => updateTeam('colorSecundario', value)} disabled={saving} />
            </div>
            <label>Imagen (URL)<input type="url" value={teamForm.imagen} onChange={(event) => updateTeam('imagen', event.target.value)} disabled={saving || teams.length >= 24} /></label>
            <button className="admin-secondary-button" type="submit" disabled={saving || teams.length >= 24}>{saving ? 'Guardando...' : 'Agregar equipo'}</button>
          </form>
          <ul className="wizard-resource-list">{teams.map((team) => <li key={team._id}>{team.nombre} <small>({team.nombreCorto})</small></li>)}</ul>
          <div className="wizard-actions">
            <button className="admin-secondary-button" type="button" onClick={() => goToStep(1)} disabled={saving}>Anterior</button>
            <button className="admin-primary-button" type="button" onClick={() => handleNextResourceStep(teams.length < 4, 3, 'Registra al menos 4 equipos para continuar.')} disabled={saving || teams.length < 4}>Siguiente</button>
          </div>
        </section>}

        {step === 3 && <section className="wizard-step">
          <h2>Paso 3 · Canchas</h2>
          <p>Registra horarios en los días seleccionados: {config.diasJuego.map((day) => weekdays.find(([value]) => value === day)?.[1]).join(', ')}.</p>
          <form className="admin-access-form" onSubmit={handleCreateCourt}>
            <label>Nombre de la cancha<input required value={courtName} onChange={(event) => setCourtName(event.target.value)} disabled={saving} /></label>
            {schedules.map((schedule, index) => <div className={`wizard-inline-fields wizard-schedule-row${conflictScheduleIndex === index ? ' conflict' : ''}`} key={`schedule-${index}`}>
              <label>Día
                <select value={schedule.dia} onChange={(event) => updateSchedule(index, 'dia', event.target.value)} disabled={saving}>
                  {config.diasJuego.map((day) => <option key={day} value={day}>{weekdays.find(([value]) => value === day)?.[1]}</option>)}
                </select>
              </label>
              <label>Horario disponible<input required type="time" value={schedule.horaInicio} onChange={(event) => updateSchedule(index, 'horaInicio', event.target.value)} disabled={saving} /></label>
              {schedules.length > 1 &&               <button className="admin-secondary-button" type="button" onClick={() => { setConflictScheduleIndex(-1); setSchedules((current) => current.filter((_, itemIndex) => itemIndex !== index)) }} disabled={saving}>Quitar</button>}
            </div>)}
            <button className="admin-secondary-button" type="button" onClick={() => setSchedules((current) => [...current, { dia: config.diasJuego[0] || 'lunes', horaInicio: '' }])} disabled={saving}>Agregar horario</button>
            <button className="admin-secondary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Agregar cancha'}</button>
          </form>
          <ul className="wizard-resource-list">{courts.map((court) => <li key={court._id}>{court.nombre} <small>{court.horarios.map((slot) => `${slot.dia} ${slot.horaInicio}`).join(' · ')}</small></li>)}</ul>
          <div className="wizard-actions">
            <button className="admin-secondary-button" type="button" onClick={() => goToStep(2)} disabled={saving}>Anterior</button>
            <button className="admin-primary-button" type="button" onClick={() => handleNextResourceStep(courts.length < 1, 4, 'Registra al menos una cancha para continuar.')} disabled={saving || courts.length < 1}>Siguiente</button>
          </div>
        </section>}

        {step === 4 && <section className="wizard-step">
          <h2>Paso 4 · Árbitros</h2>
          <form className="admin-access-form" onSubmit={handleCreateReferee}>
            <label>Nombre del árbitro<input required value={refereeForm.nombre} onChange={(event) => updateReferee('nombre', event.target.value)} disabled={saving} /></label>
            <label>WhatsApp<input required type="tel" value={refereeForm.whatsapp} onChange={(event) => updateReferee('whatsapp', event.target.value)} disabled={saving} /></label>
            <button className="admin-secondary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Agregar árbitro'}</button>
          </form>
          <ul className="wizard-resource-list">{referees.map((referee) => <li key={referee._id}>{referee.nombre} <small>{referee.telefono}</small></li>)}</ul>
          <div className="wizard-actions">
            <button className="admin-secondary-button" type="button" onClick={() => goToStep(3)} disabled={saving}>Anterior</button>
            <button className="admin-primary-button" type="button" onClick={() => handleNextResourceStep(referees.length < 1, 5, 'Registra al menos un árbitro para continuar.')} disabled={saving || referees.length < 1}>Siguiente</button>
          </div>
        </section>}

        {step === 5 && <section className="wizard-step">
          <h2>Paso 5 · Generar calendario</h2>
          <p>Revisa el resumen antes de generar todos los partidos de la fase regular.</p>
          <div className="wizard-summary">
            <p><strong>Inicia:</strong> {summaryDate} con Jornada 1</p>
            <p><strong>Equipos:</strong> {teams.length} = {matchesPerRound} partidos por jornada</p>
            <p><strong>Fase regular:</strong> {totalJornadas} jornadas · {totalRegularMatches} partidos</p>
            <p><strong>Canchas:</strong> {courts.length} · <strong>Árbitros:</strong> {referees.length}</p>
            <p><strong>Formato:</strong> {formatNames[config.formatoLiga]}</p>
            <p><strong>Duración:</strong> {config.duracionPartidoMin} minutos</p>
          </div>
          <fieldset className="wizard-radio-picker">
            <legend>Asignación de partidos</legend>
            <label><input type="radio" name="generationMode" value="automatico" checked={generationMode === 'automatico'} onChange={() => setGenerationMode('automatico')} />Automática: asignar cancha, árbitro y horario sin empalmes.</label>
            <label><input type="radio" name="generationMode" value="manual" checked={generationMode === 'manual'} onChange={() => setGenerationMode('manual')} />Manual: crear partidos sin cancha, árbitro ni hora para asignarlos después.</label>
          </fieldset>
          <div className="wizard-actions">
            <button className="admin-secondary-button" type="button" onClick={() => goToStep(4)} disabled={saving}>Anterior</button>
            <button className="admin-primary-button" type="button" onClick={handleComplete} disabled={saving || !canScheduleJornada || (playoffFormat && teams.length < 8)}>
              {saving ? 'Creando liga y calendario...' : 'CREAR LIGA Y GENERAR CALENDARIO'}
            </button>
          </div>
        </section>}
      </section>
    </main>
  )
}

export default WizardLayout

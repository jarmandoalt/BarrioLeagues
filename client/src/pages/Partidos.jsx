import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useOutletContext } from 'react-router-dom'
import { selectMatches, selectStandings } from '../features/league/leagueSlice'
import LeagueHeader from '../components/LeagueHeader'
import PublicTeamLink from '../components/PublicTeamLink'

const formatMatchDate = (value) => {
  if (!value) return 'Fecha por confirmar'
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

const getDateKey = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDateKey = (value) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const getTournamentMonthRange = (league, matches) => {
  const startValue = league.config?.fechaInicioLiga
    || league.fechaProgramada
    || matches.map((match) => getDateKey(match.fecha)).filter(Boolean).sort()[0]
  const datedMatches = matches.map((match) => getDateKey(match.fecha)).filter(Boolean)
  const lastJourneyDate = league.config?.fechasJornadas?.at(-1)?.fecha
  const endValue = [...datedMatches, lastJourneyDate].filter(Boolean).sort().at(-1) || startValue

  if (!startValue || !endValue) return null

  const startDate = new Date(`${String(startValue).slice(0, 10)}T12:00:00`)
  const endDate = new Date(`${String(endValue).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null

  return {
    start: new Date(startDate.getFullYear(), startDate.getMonth(), 1),
    end: new Date(endDate.getFullYear(), endDate.getMonth(), 1),
  }
}

const getRefereeName = (match) => (match.arbitroId || match.arbitro_id)?.nombre || 'Por asignar'
const getCourtName = (match) => match.canchaId?.nombre || match.cancha_id?.nombre || 'Cancha por asignar'
const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const monthFormatter = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
const matchStatusLabels = {
  programado: 'Pendiente',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  suspendido: 'Suspendido',
}

const getCountdown = (match, now) => {
  if (!match.fecha) return ''

  const startsAt = new Date(match.fecha).getTime()
  const secondsRemaining = Math.floor((startsAt - now) / 1000)
  if (!Number.isFinite(startsAt) || secondsRemaining <= 0) return ''

  const days = Math.floor(secondsRemaining / 86400)
  const hours = Math.floor((secondsRemaining % 86400) / 3600)
  const minutes = Math.floor((secondsRemaining % 3600) / 60)
  const seconds = secondsRemaining % 60
  const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')

  return days > 0 ? `${days} d ${time}` : time
}

const Partidos = () => {
  const { league } = useOutletContext()
  const matches = useSelector(selectMatches)
  const standings = useSelector(selectStandings)
  const loading = useSelector((state) => state.league.loading)
  const [now, setNow] = useState(() => Date.now())
  const [activeTab, setActiveTab] = useState('upcoming')
  const [selectedDate, setSelectedDate] = useState('')
  const scheduledMatches = matches.filter((match) => (
    match.estado === 'programado'
    && (match.faseTorneo !== 'regular' || Number(match.jornada) === Number(league.jornada))
  ))
  const positions = Object.fromEntries(standings.map((team) => [team.nombre, team.pos]))
  const monthRange = getTournamentMonthRange(league, matches)
  const firstUpcomingMatchDate = matches
    .filter((match) => match.fecha && new Date(match.fecha).getTime() > now)
    .map((match) => getDateKey(match.fecha))
    .sort()[0]
  const defaultSelectedDate = firstUpcomingMatchDate
    || matches.map((match) => getDateKey(match.fecha)).filter(Boolean).sort()[0]
    || (monthRange ? getDateKey(monthRange.start) : '')
  const calendarSelectedDate = selectedDate || defaultSelectedDate
  const selectedDateValue = calendarSelectedDate ? parseDateKey(calendarSelectedDate) : null
  const currentMonth = selectedDateValue
    ? new Date(selectedDateValue.getFullYear(), selectedDateValue.getMonth(), 1)
    : monthRange?.start
  const matchDays = new Set(matches.map((match) => getDateKey(match.fecha)).filter(Boolean))
  const selectedDayMatches = matches
    .filter((match) => getDateKey(match.fecha) === calendarSelectedDate)
    .sort((first, second) => new Date(first.fecha) - new Date(second.fecha))
  const monthOffset = currentMonth && monthRange
    ? (currentMonth.getFullYear() - monthRange.start.getFullYear()) * 12 + currentMonth.getMonth() - monthRange.start.getMonth()
    : 0
  const monthCount = monthRange
    ? (monthRange.end.getFullYear() - monthRange.start.getFullYear()) * 12 + monthRange.end.getMonth() - monthRange.start.getMonth() + 1
    : 0
  const firstDayOffset = currentMonth ? (currentMonth.getDay() + 6) % 7 : 0
  const daysInMonth = currentMonth ? new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() : 0
  const today = new Date(now)
  const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const todayIsInRange = monthRange && todayMonth >= monthRange.start && todayMonth <= monthRange.end
  const calendarCells = [
    ...Array.from({ length: firstDayOffset }, (_, index) => ({ key: `empty-${index}`, day: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ]

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const Side = ({ team }) => (
    <div className="flex flex-1 items-center gap-3 min-w-0">
      <span className="text-xs font-bold text-slate-400">#{positions[team?.nombre] || '-'}</span>
      <PublicTeamLink team={team} className="truncate text-left font-semibold text-slate-800" />
    </div>
  )

  const MatchCard = ({ match, showCountdown = false }) => {
    const countdown = showCountdown ? getCountdown(match, now) : ''
    return (
      <article key={match._id} className="min-w-0 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <Side team={match.equipoLocal_id} />
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 sm:px-3 sm:text-xs">VS</span>
          <div className="flex flex-1 justify-end text-right">
            <Side team={match.equipoVisitante_id} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs capitalize text-slate-500 sm:gap-x-5 sm:text-sm">
          {match.faseTorneo && match.faseTorneo !== 'regular' && (
            <span className="font-semibold text-indigo-700">
              {match.faseTorneo === 'cuartos' ? 'Cuartos de final' : match.faseTorneo === 'semifinal' ? 'Semifinal' : 'Final'} · {match.partidoSerie === 1 ? 'Ida' : 'Vuelta'}
            </span>
          )}
          <span>📅 {formatMatchDate(match.fecha)}</span>
          <span>📍 {getCourtName(match)}</span>
          <span>🏁 Árbitro: {getRefereeName(match)}</span>
          {countdown && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold tabular-nums text-blue-700">
              Inicia en {countdown}
            </span>
          )}
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
            match.estado === 'finalizado' ? 'bg-emerald-100 text-emerald-700'
              : match.estado === 'suspendido' ? 'bg-rose-100 text-rose-700'
                : match.estado === 'en_curso' ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
          }`}>
            {matchStatusLabels[match.estado] || 'Pendiente'}
          </span>
        </div>
      </article>
    )
  }

  return (
    <div className="partidos-page min-h-screen bg-[#f8fafc] p-2 sm:p-3 md:p-6">
      <LeagueHeader />

      {loading ? (
        <div className="rounded-2xl bg-white p-10 text-center">Cargando partidos...</div>
      ) : (
        <main className="min-w-0 space-y-4 sm:space-y-5">
          <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-fit" role="tablist" aria-label="Vistas de partidos">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'upcoming'}
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm ${activeTab === 'upcoming' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Próximos juegos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'calendar'}
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm ${activeTab === 'calendar' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Calendario
            </button>
          </div>

          {activeTab === 'upcoming' && scheduledMatches.length === 0 && (
            <>
              {Array.from({ length: 3 }).map((_, index) => (
                <article key={`skeleton-${index}`} className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-1 items-center gap-3"><div className="h-3 w-6 rounded bg-slate-200" /><div className="h-4 w-32 rounded bg-slate-200" /></div>
                    <span className="bg-slate-100 text-slate-300 text-xs font-bold px-3 py-1 rounded-full">VS</span>
                    <div className="flex flex-1 justify-end"><div className="h-4 w-32 rounded bg-slate-200" /></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    <div className="h-3 w-40 rounded bg-slate-200" />
                    <div className="h-3 w-28 rounded bg-slate-200" />
                    <div className="h-3 w-32 rounded bg-slate-200" />
                  </div>
                </article>
              ))}
              <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs p-3 rounded-2xl text-center">
                No hay partidos programados para esta jornada.
              </div>
            </>
          )}
          {activeTab === 'upcoming' && scheduledMatches.map((match) => (
            <MatchCard key={match._id} match={match} showCountdown />
          ))}
          {activeTab === 'upcoming' && (
            <p className="pt-2 text-center text-xs text-slate-500">
              {scheduledMatches.length} partido(s) programado(s) en la jornada {league.jornada}
            </p>
          )}

          {activeTab === 'calendar' && monthRange && currentMonth && (
            <section className="calendar-panel grid min-w-0 gap-4 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4 md:gap-6 md:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="calendar-panel-title text-2xl font-extrabold text-blue-900 md:text-3xl">Calendario mensual</h1>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Mes anterior"
                        disabled={monthOffset <= 0}
                        onClick={() => setSelectedDate(getDateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)))}
                        className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <h2 className="min-w-36 text-center text-lg font-semibold capitalize text-slate-700">
                        {monthFormatter.format(currentMonth)}
                      </h2>
                      <button
                        type="button"
                        aria-label="Mes siguiente"
                        disabled={monthOffset >= monthCount - 1}
                        onClick={() => setSelectedDate(getDateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)))}
                        className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(getDateKey(today))}
                    disabled={!todayIsInRange}
                    className="rounded-lg border border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Hoy
                  </button>
                </div>

                <div className="calendar-weekdays mt-4 grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 sm:mt-5 sm:text-sm">
                  {weekDays.map((day) => <span key={day} className="truncate py-2">{day.slice(0, 3)}</span>)}
                </div>
                <div className="calendar-days-grid grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarCells.map(({ key, day }) => {
                    if (!day) return <span key={key} aria-hidden="true" />
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                    const dateKey = getDateKey(date)
                    const hasMatch = matchDays.has(dateKey)
                    const isSelected = calendarSelectedDate === dateKey
                    const isToday = getDateKey(date) === getDateKey(now)
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label={`${date.toLocaleDateString('es-MX')}${hasMatch ? ', hay partidos' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedDate(dateKey)}
                        className={`calendar-day-cell flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl p-0 text-xs font-semibold transition-colors sm:rounded-full sm:text-base ${isSelected ? 'bg-blue-800 text-white' : isToday ? 'ring-2 ring-blue-700 text-blue-800' : 'text-slate-700 hover:bg-blue-50'}`}
                      >
                        <span>{day}</span>
                        <span className={`calendar-day-dot mt-0.5 h-1.5 w-1.5 rounded-full ${hasMatch ? isSelected ? 'bg-white' : 'bg-blue-700' : 'bg-transparent'}`} />
                      </button>
                    )
                  })}
                </div>
              </div>

              <aside className="min-w-0 border-t border-slate-200 pt-4 sm:pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <h2 className="calendar-agenda-title text-2xl font-extrabold text-blue-900 md:text-3xl">Agenda</h2>
                <p className="mb-4 text-slate-600">
                  {calendarSelectedDate
                    ? new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDateKey(calendarSelectedDate))
                    : 'Selecciona un día'}
                </p>
                {selectedDayMatches.length ? (
                  <div className="space-y-3">
                    {selectedDayMatches.map((match) => <MatchCard key={match._id} match={match} />)}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                    {calendarSelectedDate ? 'No hay partidos programados para este día.' : 'Elige un día del calendario para ver sus partidos.'}
                  </p>
                )}
              </aside>
            </section>
          )}
          {activeTab === 'calendar' && !monthRange && (
            <p className="rounded-2xl bg-white p-6 text-center text-slate-500">
              El calendario estará disponible cuando la liga tenga fechas de inicio y partidos programados.
            </p>
          )}
        </main>
      )}
    </div>
  )
}

export default Partidos

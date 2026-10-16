import { useSelector } from 'react-redux'
import { useOutletContext } from 'react-router-dom'
import { selectMatches, selectStandings } from '../features/league/leagueSlice'
import LeagueHeader from '../components/LeagueHeader'

const formatMatchDate = (value) => {
  if (!value) return 'Fecha por confirmar'
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

const getRefereeName = (match) => (match.arbitroId || match.arbitro_id)?.nombre || 'Por asignar'
const getCourtName = (match) => match.canchaId?.nombre || match.cancha_id?.nombre || 'Cancha por asignar'

const Partidos = () => {
  const { league } = useOutletContext()
  const matches = useSelector(selectMatches)
  const standings = useSelector(selectStandings)
  const loading = useSelector((state) => state.league.loading)
  const scheduledMatches = matches.filter((match) => match.estado === 'programado' && Number(match.jornada) === Number(league.jornada))
  const positions = Object.fromEntries(standings.map((team) => [team.nombre, team.pos]))

  const Side = ({ team }) => (
    <div className="flex flex-1 items-center gap-3 min-w-0">
      <span className="text-xs font-bold text-slate-400">#{positions[team?.nombre] || '-'}</span>
      <strong className="truncate text-slate-800">{team?.nombre || 'Equipo'}</strong>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6">
      <LeagueHeader />

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center">Cargando partidos...</div>
      ) : (
        <main className="space-y-3">
          {scheduledMatches.length === 0 && (
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
          {scheduledMatches.map((match) => (
            <article key={match._id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-4 md:p-5">
              <div className="flex items-center gap-3">
                <Side team={match.equipoLocal_id} />
                <span className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full">VS</span>
                <div className="flex flex-1 justify-end text-right min-w-0">
                  <Side team={match.equipoVisitante_id} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500 capitalize">
                <span>📅 {formatMatchDate(match.fecha)}</span>
                <span>📍 {getCourtName(match)}</span>
                <span>🏁 Árbitro: {getRefereeName(match)}</span>
                <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">Pendiente</span>
              </div>
            </article>
          ))}
          <p className="text-xs text-slate-500 text-center pt-2">
            {scheduledMatches.length} partido(s) programado(s) en la jornada {league.jornada}
          </p>
        </main>
      )}
    </div>
  )
}

export default Partidos

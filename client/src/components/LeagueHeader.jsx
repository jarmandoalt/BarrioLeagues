import { Link, useLocation, useOutletContext } from 'react-router-dom'

const LeagueHeader = ({ league: leagueProp, title, subtitle, links: linksProp, children }) => {
  const outlet = useOutletContext()
  const league = leagueProp || outlet?.league
  const location = useLocation()
  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  const isActive = (path) => location.pathname === path || location.pathname === `${path}/`

  const links = linksProp || [
    { to: `/${league?.slug || ''}`, label: 'Tabla' },
    { to: `/${league?.slug || ''}/partidos`, label: 'Partidos' },
    { to: `/${league?.slug || ''}/equipos`, label: 'Equipos' },
    { to: `/${league?.slug || ''}/estadisticas`, label: 'Estadísticas' },
  ]
  const headerTitle = title ?? league?.nombre
  const headerSubtitle = subtitle ?? (league ? `${league.jornada === 0 ? 'Pre-temporada' : `Jornada ${league.jornada}`} - ${hoy}` : hoy)

  return (
    <header className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 mb-3">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
            {headerTitle}
          </h1>
          <p className="text-xs text-slate-500 capitalize">{headerSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {league && (
            <span className="hidden md:inline bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
              {league.jornada === 0 ? 'Pretemporada' : 'En juego'}
            </span>
          )}
          {children}
        </div>
      </div>

      <nav className="flex gap-1 mt-2 bg-slate-100 p-0.5 rounded-lg w-fit max-w-full overflow-x-auto">
        {links.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${isActive(to) ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

export default LeagueHeader

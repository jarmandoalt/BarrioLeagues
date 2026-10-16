export default function TeamCard({ team, onView }) {
  return (
    <article
      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2 shadow-sm hover:shadow-md transition-shadow border-l-8 border-t-4"
      style={{ borderLeftColor: team.colorPrimario, borderTopColor: team.colorSecundario }}
    >
      {team.imagen ? (
        <img src={team.imagen} alt={`Escudo de ${team.nombre}`} className="h-11 w-11 shrink-0 rounded-full object-contain" />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-full" style={{ backgroundColor: team.colorPrimario }} />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-bold leading-6 text-slate-900">
          {team.nombre} <span className="font-normal text-slate-500">({team.nombreCorto})</span>
        </h3>
        <p className="truncate text-xs leading-4 text-slate-500">DT: {team.dt?.nombre} • PJ: {team.stats?.pj ?? 0} • PTS: {team.stats?.pts ?? 0}</p>
      </div>
      <button
        type="button"
        onClick={() => onView(team)}
        className="rounded-lg border-2 border-blue-700 px-4 py-0.5 font-semibold text-blue-700 hover:bg-blue-50"
      >
        Ver
      </button>
    </article>
  )
}


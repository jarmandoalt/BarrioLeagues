import { useSelector } from 'react-redux'
import { selectStats } from '../features/league/leagueSlice'
import LeagueHeader from '../components/LeagueHeader'

const StatCard = ({ title, subtitle, icon, accent, columns, rows }) => (
  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" style={{ borderTop: `4px solid ${accent}` }}>
    <div className="flex items-center gap-2 px-5 pt-4">
      <span className="text-xl">{icon}</span>
      <h3 className="font-bold text-slate-900">{title}</h3>
      <span className="text-xs text-slate-500">{subtitle}</span>
    </div>
    <table className="w-full text-sm mt-3">
      <thead>
        <tr className="bg-slate-100/80 text-slate-600 text-left">
          {columns.map((column, i) => (
            <th key={column} className={`py-2.5 font-bold ${i === 0 ? 'px-5' : ''} ${i === columns.length - 1 ? 'text-center px-5' : ''}`}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.jugador}-${index}`} className="border-t border-gray-100 hover:bg-slate-50/60">
            <td className="py-3 px-5 font-semibold text-slate-800">{row.jugador}</td>
            <td className="text-slate-600">{row.equipo}</td>
            <td className="text-center px-5 font-extrabold text-blue-700">
              {row.goles ?? row.partidos ?? row.rojas ?? row.amarillas}
            </td>
          </tr>
        ))}
        {rows.length === 0 && Array.from({ length: 3 }).map((_, index) => (
          <tr key={`skeleton-${index}`} className="border-t border-gray-100">
            <td className="py-3 px-5"><div className="h-3 w-28 rounded bg-slate-200" /></td>
            <td><div className="h-3 w-24 rounded bg-slate-200" /></td>
            <td className="px-5"><div className="h-3 w-5 rounded bg-slate-200 mx-auto" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)

const Estadisticas = () => {
  const stats = useSelector(selectStats)
  const loading = useSelector((state) => state.league.loading)
  const { goleadores, porteros, tarjetasRojas, tarjetasAmarillas } = stats

  return (
    <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6">
      <LeagueHeader />

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center">Cargando estadísticas...</div>
      ) : (
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatCard title="Goleador" subtitle="(Máximos goleadores)" icon="🏆" accent="#0e4a9b" columns={['Jugador', 'Equipo', 'Goles']} rows={goleadores} />
          <StatCard title="Arcos en 0" subtitle="Porteros con valla invicta" icon="🧤" accent="#7c3aed" columns={['Jugador', 'Equipo', 'Partidos']} rows={porteros} />
          <StatCard title="Tarjeta Roja" subtitle="Expulsiones" icon="🟥" accent="#d92d4d" columns={['Jugador', 'Equipo', 'Roj.']} rows={tarjetasRojas} />
          <StatCard title="Tarjeta Amarilla" subtitle="Amonestaciones" icon="🟨" accent="#d9a000" columns={['Jugador', 'Equipo', 'Amar.']} rows={tarjetasAmarillas} />
        </main>
      )}
    </div>
  )
}

export default Estadisticas

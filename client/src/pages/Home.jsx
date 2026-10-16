import { useSelector } from 'react-redux'
import { selectStandings } from '../features/league/leagueSlice'
import LeagueHeader from '../components/LeagueHeader'

const Home = () => {
  const standings = useSelector(selectStandings)
  const loading = useSelector((state) => state.league.loading)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4">
        <div className="bg-white rounded-2xl p-10 text-center">Cargando tabla...</div>
      </div>
    )
  }

  const isEmpty = standings.length === 0
  const skeletonRows = Array.from({ length: 5 })

  return (
    <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6">
      <LeagueHeader />

      <main className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 text-left">
                <th className="py-3.5 pl-5 pr-2 w-12 font-bold">Pos</th>
                <th className="font-bold pl-2">Club</th>
                <th className="text-center font-bold">PJ</th>
                <th className="text-center font-bold">PG</th>
                <th className="text-center font-bold">PE</th>
                <th className="text-center font-bold">PP</th>
                <th className="text-center font-bold">GF</th>
                <th className="text-center font-bold">GC</th>
                <th className="text-center font-bold">DG</th>
                <th className="text-center font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {isEmpty && skeletonRows.map((_, index) => (
                <tr key={`skeleton-${index}`} className="border-t border-gray-100">
                  <td className="py-4 pl-5 pr-2 w-12"><div className="h-3 w-4 rounded bg-slate-200" /></td>
                  <td className="py-3 pl-2">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-9 rounded-full bg-slate-200" />
                      <div className="w-8 h-8 rounded-full bg-slate-200" />
                      <div className="h-3 w-32 rounded bg-slate-200" />
                    </div>
                  </td>
                  {Array.from({ length: 8 }).map((__, cell) => (
                    <td key={cell} className="text-center"><div className="h-3 w-5 rounded bg-slate-200 mx-auto" /></td>
                  ))}
                </tr>
              ))}
              {standings.map((equipo) => (
                <tr key={equipo.nombre} className="border-t border-gray-100 hover:bg-slate-50/60 transition">
                  <td className="py-4 pl-5 pr-2 w-12 font-bold text-slate-700">{equipo.pos}</td>
                  <td className="py-3 pl-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1 h-9 rounded-full"
                        style={{ background: equipo.colorPrimario || '#3b82f6' }}
                      />
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm overflow-hidden"
                        style={{ background: equipo.colorPrimario || '#e0f2fe', color: equipo.colorPrimario ? '#fff' : '#1e40af' }}
                      >
                        {equipo.imagen
                          ? <img src={equipo.imagen} alt="" className="w-full h-full rounded-full object-cover bg-white" />
                          : equipo.nombre.slice(0, 1)}
                      </div>
                      <span className="font-semibold text-slate-800">{equipo.nombre}</span>
                    </div>
                  </td>
                  <td className="text-center font-semibold">{equipo.pj}</td>
                  <td className="text-center">{equipo.pg}</td>
                  <td className="text-center">{equipo.pe}</td>
                  <td className="text-center">{equipo.pp}</td>
                  <td className="text-center">{equipo.gf}</td>
                  <td className="text-center">{equipo.gc}</td>
                  <td className="text-center">{equipo.dg}</td>
                  <td className="text-center font-extrabold text-blue-700">{equipo.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isEmpty && (
          <div className="bg-blue-50 border-t border-blue-100 text-blue-800 text-xs p-3 text-center">
            Esta liga aún no tiene equipos registrados.
          </div>
        )}

        {!isEmpty && standings.every((e) => e.pj === 0) && (
          <div className="bg-blue-50 border-t border-blue-100 text-blue-800 text-xs p-3 text-center">
            Pretemporada: todas las estadÃ­sticas inician en 0. Ve a Partidos para crear el calendario.
          </div>
        )}
      </main>
    </div>
  )
}

export default Home

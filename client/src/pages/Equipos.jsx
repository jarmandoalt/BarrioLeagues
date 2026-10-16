import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Modal } from 'react-bootstrap'
import { selectTeams } from '../features/league/leagueSlice'
import { getPlayers } from '../services/leagueApi'
import LeagueHeader from '../components/LeagueHeader'
import TeamGrid from '../components/TeamGrid'
import EquipoDetalle from '../components/EquipoDetalle'

const Equipos = () => {
  const teams = useSelector(selectTeams)
  const loading = useSelector((state) => state.league.loading)
  const [selected, setSelected] = useState(null)
  const [players, setPlayers] = useState([])

  useEffect(() => {
    if (!selected) return undefined
    let active = true
    getPlayers(selected._id)
      .then((data) => active && setPlayers(data))
      .catch(() => active && setPlayers([]))
    return () => {
      active = false
    }
  }, [selected])

  const handleView = (team) => {
    setPlayers([])
    setSelected(team)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6">
      <LeagueHeader />

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center">Cargando equipos...</div>
      ) : teams.length === 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2"><div className="h-4 w-3/4 rounded bg-slate-200" /><div className="h-3 w-1/2 rounded bg-slate-200" /></div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">Esta liga aún no tiene equipos registrados.</p>
        </>
      ) : (
        <TeamGrid teams={teams} onView={handleView} />
      )}

      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} fullscreen>
        <Modal.Header closeButton />
        <Modal.Body className="p-0">
          {selected && <EquipoDetalle equipo={selected} jugadores={players} />}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default Equipos

import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Modal } from 'react-bootstrap'
import { useLocation, useNavigate } from 'react-router-dom'
import { selectTeams } from '../features/league/leagueSlice'
import { getPlayers } from '../services/leagueApi'
import LeagueHeader from '../components/LeagueHeader'
import TeamGrid from '../components/TeamGrid'
import EquipoDetalle from '../components/EquipoDetalle'

const Equipos = () => {
  const teams = useSelector(selectTeams)
  const loading = useSelector((state) => state.league.loading)
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedByClick, setSelectedByClick] = useState(null)
  const [players, setPlayers] = useState([])
  const routedTeamId = location.state?.openTeamId
  const routedTeam = routedTeamId
    ? teams.find((team) => String(team._id) === String(routedTeamId))
    : null
  const selected = selectedByClick || routedTeam
  const navigationError = routedTeamId && teams.length > 0 && !routedTeam && !loading
    ? 'No se pudo encontrar el equipo seleccionado.'
    : ''

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
    setSelectedByClick(team)
  }

  const handleClose = () => {
    setSelectedByClick(null)
    if (!routedTeamId) return

    const remainingState = { ...location.state }
    delete remainingState.openTeamId
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: Object.keys(remainingState).length ? remainingState : null,
    })
  }

  return (
    <div className={`min-h-screen bg-[#f8fafc] p-3 md:p-6${routedTeam ? ' team-navigation-enter' : ''}`}>
      <LeagueHeader />

      {navigationError && (
        <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
          {navigationError}
        </p>
      )}

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

      <Modal show={Boolean(selected)} onHide={handleClose} fullscreen className="team-detail-modal">
        <Modal.Header closeButton />
        <Modal.Body className="p-0">
          {selected && <EquipoDetalle equipo={selected} jugadores={players} />}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default Equipos

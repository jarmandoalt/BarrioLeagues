import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { Button, Modal } from 'react-bootstrap'
import { getPendingRefereeMatches, submitRefereeReport, verifyRefereeMatch } from '../services/leagueApi'
import FloatingNotifications from '../components/FloatingNotifications'
import '../index.css'

const formatMatchDate = (match) => {
  if (!match.fecha) return 'Fecha por confirmar'
  const date = new Date(match.fecha)
  const day = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  return `${day} · ${match.hora || new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(date)}`
}

const TeamReportSection = ({ team, score, events, players, onAdjust, onUpdateEvent }) => {
  const teamId = String(team._id)
  const teamEvents = events.map((event, index) => ({ event, index })).filter(({ event }) => String(event.equipo_id) === teamId)
  const goals = teamEvents.filter(({ event }) => event.tipo === 'GOL')
  const yellowCards = teamEvents.filter(({ event }) => event.tipo === 'TA')
  const redCards = teamEvents.filter(({ event }) => event.tipo === 'TR')

  const renderEvents = (items, icon, label) => items.length > 0 && <div className="referee-event-list">
    {items.map(({ event, index }) => <div className="referee-event-row" key={`${teamId}-${event.tipo}-${index}`}>
      <span className={`referee-event-icon ${event.tipo.toLowerCase()}`} aria-hidden="true">{icon}</span>
      <label>Jugador<select aria-label={`${label}, jugador`} required value={event.jugador_numero} onChange={(change) => onUpdateEvent(index, 'jugador_numero', change.target.value)}>
        {players.length === 0 && <option value="">Sin jugadores activos</option>}
        {players.map((player) => <option key={player._id} value={player.numero}>#{player.numero} · {player.nombre_corto} · {player.posicion}</option>)}
      </select></label>
      <label>Minuto<input aria-label={`${label}, minuto`} type="number" min="0" max="120" value={event.minuto} onChange={(change) => onUpdateEvent(index, 'minuto', change.target.value)} /></label>
      <button className="referee-remove-event" type="button" aria-label={`Quitar ${label.toLowerCase()}`} onClick={() => onAdjust(teamId, event.tipo, -1)}>×</button>
    </div>)}
  </div>

  const renderCounter = (type, count, label) => <div className="referee-counter" aria-label={`${label}: ${count}`}>
    <button type="button" aria-label={`Quitar ${label}`} disabled={count === 0} onClick={() => onAdjust(teamId, type, -1)}>−</button>
    <output>{count}</output>
    <button type="button" aria-label={`Agregar ${label}`} onClick={() => onAdjust(teamId, type, 1)}>+</button>
  </div>

  return <section className="referee-team-card">
    <div className="referee-team-heading">
      <h2>{team.nombre}</h2>
      <div className="referee-score-control"><span>Goles</span>{renderCounter('GOL', score, `goles de ${team.nombre}`)}</div>
    </div>
    <div className="referee-category">
      <div className="referee-category-heading"><span>Goles</span></div>
      {renderEvents(goals, '⚽', 'Gol')}
    </div>
    <div className="referee-card-category">
      <span className="referee-card-label"><i className="referee-yellow-card" /> T.A.</span>
      {renderCounter('TA', yellowCards.length, 'tarjetas amarillas')}
    </div>
    {renderEvents(yellowCards, '■', 'Tarjeta amarilla')}
    <div className="referee-card-category">
      <span className="referee-card-label"><i className="referee-red-card" /> T.R.</span>
      {renderCounter('TR', redCards.length, 'tarjetas rojas')}
    </div>
    {renderEvents(redCards, '■', 'Tarjeta roja')}
  </section>
}

const Arbitros = () => {
  const { slug } = useParams()
  const { league } = useOutletContext()
  const [jornada, setJornada] = useState(1)
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [verifiedMatch, setVerifiedMatch] = useState(null)
  const [playersByTeam, setPlayersByTeam] = useState({ local: [], visitor: [] })
  const [matchCode, setMatchCode] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [report, setReport] = useState({ marcadorLocal: 0, marcadorVisitante: 0, eventos: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showReportReview, setShowReportReview] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPendingMatches = async () => {
    setLoading(true)
    try {
      const result = await getPendingRefereeMatches(slug)
      setJornada(result.jornada)
      setMatches(result.matches)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los partidos pendientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    getPendingRefereeMatches(slug)
      .then((result) => {
        if (!active) return
        setJornada(result.jornada)
        setMatches(result.matches)
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'No se pudieron cargar los partidos pendientes.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [slug])

  const selectMatch = (match) => {
    setSelectedMatch(match)
    setVerifiedMatch(null)
    setPlayersByTeam({ local: [], visitor: [] })
    setMatchCode('')
    setAccessToken('')
    setError('')
    setNotice('')
  }

  const handleVerifyMatch = async (event) => {
    event.preventDefault()
    if (!selectedMatch || matchCode.length !== 6) return
    setSaving(true)
    setError('')
    try {
      const result = await verifyRefereeMatch(slug, selectedMatch._id, matchCode)
      setVerifiedMatch(result.match)
      setAccessToken(result.accessToken)
      setPlayersByTeam(result.players)
      setReport({
        marcadorLocal: result.match.marcadorLocal || 0,
        marcadorVisitante: result.match.marcadorVisitante || 0,
        eventos: (result.match.eventos || []).map((event) => ({ ...event, equipo_id: String(event.equipo_id) })),
      })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'El ID no coincide con el partido pendiente.')
    } finally {
      setSaving(false)
    }
  }

  const adjustEventCount = (teamId, type, delta) => {
    setReport((current) => {
      if (delta > 0) {
        const teamPlayers = teamId === String(verifiedMatch.equipoLocal_id._id) ? playersByTeam.local : playersByTeam.visitor
        const newEvent = { equipo_id: teamId, tipo: type, jugador_numero: teamPlayers[0]?.numero || 1, minuto: 1 }
        return {
          ...current,
          marcadorLocal: type === 'GOL' && teamId === String(verifiedMatch.equipoLocal_id._id) ? current.marcadorLocal + 1 : current.marcadorLocal,
          marcadorVisitante: type === 'GOL' && teamId === String(verifiedMatch.equipoVisitante_id._id) ? current.marcadorVisitante + 1 : current.marcadorVisitante,
          eventos: [...current.eventos, newEvent],
        }
      }

      let removeIndex = -1
      for (let index = current.eventos.length - 1; index >= 0; index -= 1) {
        const item = current.eventos[index]
        if (String(item.equipo_id) === teamId && item.tipo === type) {
          removeIndex = index
          break
        }
      }
      if (removeIndex < 0) return current
      return {
        ...current,
        marcadorLocal: type === 'GOL' && teamId === String(verifiedMatch.equipoLocal_id._id) ? Math.max(0, current.marcadorLocal - 1) : current.marcadorLocal,
        marcadorVisitante: type === 'GOL' && teamId === String(verifiedMatch.equipoVisitante_id._id) ? Math.max(0, current.marcadorVisitante - 1) : current.marcadorVisitante,
        eventos: current.eventos.filter((_, index) => index !== removeIndex),
      }
    })
  }

  const updateReportEvent = (eventIndex, field, value) => {
    setReport((current) => ({
      ...current,
      eventos: current.eventos.map((item, index) => index === eventIndex
        ? { ...item, [field]: value === '' ? '' : Number(value) }
        : item),
    }))
  }

  const openReportReview = (event) => {
    event.preventDefault()
    setError('')
    setShowReportReview(true)
  }

  const handleReportSubmit = async () => {
    if (!verifiedMatch || !accessToken) return
    setSaving(true)
    setError('')
    try {
      await submitRefereeReport(slug, verifiedMatch._id, accessToken, {
        marcadorLocal: Number(report.marcadorLocal),
        marcadorVisitante: Number(report.marcadorVisitante),
        eventos: report.eventos.map((item) => ({ ...item, jugador_numero: Number(item.jugador_numero), minuto: Number(item.minuto) })),
      })
      setShowReportReview(false)
      setNotice('Reporte guardado correctamente.')
      setVerifiedMatch(null)
      setSelectedMatch(null)
      setPlayersByTeam({ local: [], visitor: [] })
      setAccessToken('')
      setMatchCode('')
      await loadPendingMatches()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar el reporte.')
    } finally {
      setSaving(false)
    }
  }

  const localTeam = verifiedMatch?.equipoLocal_id
  const visitorTeam = verifiedMatch?.equipoVisitante_id

  return <div className="referee-shell">
    <FloatingNotifications notifications={[
      notice && { id: 'referee-notice', type: 'success', message: notice },
      error && { id: 'referee-error', type: 'error', message: error },
    ]} />
    <header className="referee-header">
      <Link to={`/${slug}/partidos`} className="referee-back" aria-label="Volver a partidos">‹</Link>
      <h1>Árbitro</h1>
      <span className="referee-header-mark" aria-hidden="true">✓</span>
    </header>
    <main className="referee-main">
      <p className="referee-league-name">{league.nombre}</p>
      {loading && <p className="referee-state">Cargando partidos pendientes...</p>}
      {!loading && !verifiedMatch && <>
        <section className="referee-match-picker">
          <div className="referee-section-heading"><div><h2>Jornada {jornada}</h2><p>Partidos pendientes</p></div><button type="button" onClick={loadPendingMatches}>Actualizar</button></div>
          {matches.length === 0 && <p className="referee-state">No hay partidos pendientes para esta jornada.</p>}
          {matches.map((match) => <button className="referee-match-option" type="button" key={match._id} onClick={() => selectMatch(match)}>
            <strong>{match.equipoLocal_id?.nombre} <span>vs</span> {match.equipoVisitante_id?.nombre}</strong>
            <small>{formatMatchDate(match)} · {match.cancha_id?.nombre || 'Cancha por confirmar'}</small>
          </button>)}
        </section>
        {selectedMatch && <form className="referee-code-form" onSubmit={handleVerifyMatch}>
          <div><h2>Confirmar partido</h2><p>{selectedMatch.equipoLocal_id?.nombre} vs {selectedMatch.equipoVisitante_id?.nombre}</p></div>
          <label>ID del partido<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={matchCode} onChange={(event) => setMatchCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
          <button className="referee-primary-button" type="submit" disabled={saving || matchCode.length !== 6}>{saving ? 'Verificando...' : 'Abrir partido'}</button>
        </form>}
      </>}
      {verifiedMatch && localTeam && visitorTeam && <>
        <div className="referee-match-meta">Partido · Jornada {verifiedMatch.jornada} · {formatMatchDate(verifiedMatch)}</div>
        <form className="referee-report-form" onSubmit={openReportReview}>
          <TeamReportSection team={localTeam} score={report.marcadorLocal} events={report.eventos} players={playersByTeam.local} onAdjust={adjustEventCount} onUpdateEvent={updateReportEvent} />
          <TeamReportSection team={visitorTeam} score={report.marcadorVisitante} events={report.eventos} players={playersByTeam.visitor} onAdjust={adjustEventCount} onUpdateEvent={updateReportEvent} />
          <button className="referee-save-button" type="submit" disabled={saving}>Revisar reporte</button>
        </form>
        <Modal show={showReportReview} onHide={() => { if (!saving) setShowReportReview(false) }} centered backdrop={saving ? 'static' : true} keyboard={!saving}>
          <Modal.Header closeButton={!saving}><Modal.Title>Confirmar resultado</Modal.Title></Modal.Header>
          <Modal.Body>
            <p className="referee-review-fixture">{localTeam.nombre} {report.marcadorLocal} - {report.marcadorVisitante} {visitorTeam.nombre}</p>
            <p className="referee-review-meta">Jornada {verifiedMatch.jornada} · {formatMatchDate(verifiedMatch)}</p>
            <div className="referee-review-teams">
              {[localTeam, visitorTeam].map((team) => {
                const teamId = String(team._id)
                const teamEvents = report.eventos.filter((eventItem) => String(eventItem.equipo_id) === teamId)
                return <section className="referee-review-team" key={teamId}>
                  <h3>{team.nombre}</h3>
                  {teamEvents.length === 0
                    ? <p>Sin goles ni tarjetas</p>
                    : <ul>{teamEvents.map((eventItem, index) => <li key={`${teamId}-${eventItem.tipo}-${index}`}>
                      {eventItem.tipo === 'GOL' ? 'Gol' : eventItem.tipo === 'TA' ? 'Tarjeta amarilla' : 'Tarjeta roja'} · Jugador {eventItem.jugador_numero} · min {eventItem.minuto}
                    </li>)}</ul>}
                </section>
              })}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" type="button" onClick={() => setShowReportReview(false)} disabled={saving}>Volver al formulario</Button>
            <Button variant="success" type="button" onClick={handleReportSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Confirmar reporte'}</Button>
          </Modal.Footer>
        </Modal>
      </>}
    </main>
  </div>
}

export default Arbitros

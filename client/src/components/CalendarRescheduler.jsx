import { useEffect, useMemo, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { confirmMatchReschedules, evaluateMatchReschedule, getRescheduleResources } from '../services/leagueApi'

const weekDays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const getId = (value) => String(value?._id || value || '')
const getLocalDate = (value) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const getMatchDateTime = (match) => {
  if (!match?.fecha) return { date: '', time: '' }
  const date = new Date(match.fecha)
  return {
    date: getLocalDate(date),
    time: match.hora || `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  }
}
const getSlot = (match) => {
  const { date, time } = getMatchDateTime(match)
  return {
    fechaHora: match?.fecha
      ? new Date(match.fecha).toISOString()
      : date && time ? new Date(`${date}T${time}:00`).toISOString() : null,
    hora: time || null,
    canchaId: getId(match.cancha_id) || null,
    arbitroId: getId(match.arbitro_id) || null,
  }
}
const getMatchName = (match) => {
  const home = match?.equipoLocal_id?.nombre || 'Local'
  const away = match?.equipoVisitante_id?.nombre || 'Visitante'
  return `${home} vs ${away}`
}
const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const getErrorMessage = (error) => error.response?.data?.message || error.message || 'No se pudo completar la operación.'

const CalendarRescheduler = ({
  show,
  onHide,
  slug,
  jornada,
  match: initialMatch,
  matches,
  courts,
  referees,
  onConfirmed,
}) => {
  const [movingMatch, setMovingMatch] = useState(initialMatch)
  const [step, setStep] = useState('resolve')
  const [selectedDate, setSelectedDate] = useState(() => getMatchDateTime(initialMatch).date)
  const [selectedTime, setSelectedTime] = useState(() => getMatchDateTime(initialMatch).time)
  const [selectedCourt, setSelectedCourt] = useState('')
  const [selectedReferee, setSelectedReferee] = useState('')
  const [resources, setResources] = useState({ canchas_libres: [], arbitros_libres: [] })
  const [pendingMoves, setPendingMoves] = useState([])
  const [draftMove, setDraftMove] = useState(null)
  const [occupant, setOccupant] = useState(null)
  const [occupantHasRefConflict, setOccupantHasRefConflict] = useState(false)
  const [message, setMessage] = useState('')
  const [loadingResources, setLoadingResources] = useState(false)
  const [saving, setSaving] = useState(false)

  const journeyMatches = useMemo(
    () => matches.filter((match) => Number(match.jornada) === Number(jornada)),
    [jornada, matches],
  )
  const dates = useMemo(() => [...new Set(journeyMatches.filter((match) => match.fecha).map((match) => getLocalDate(match.fecha)))].sort(), [journeyMatches])
  const dateTimes = useMemo(() => {
    if (!selectedDate) return []
    const day = weekDays[new Date(`${selectedDate}T12:00:00`).getDay()]
    return [...new Set(courts
      .filter((court) => court.estado === 'activa')
      .flatMap((court) => (court.horarios || [])
        .filter((slot) => slot.dia === day)
        .map((slot) => slot.horaInicio)))].sort()
  }, [courts, selectedDate])
  const dateMatches = useMemo(
    () => journeyMatches.filter((match) => match.fecha && getLocalDate(match.fecha) === selectedDate),
    [journeyMatches, selectedDate],
  )

  useEffect(() => {
    if (!show || !selectedDate || !selectedTime || !movingMatch) return undefined
    let active = true
    const loadResources = async () => {
      setLoadingResources(true)
      setMessage('')
      try {
        const dateTime = new Date(`${selectedDate}T${selectedTime}:00`)
        const excluding = [...new Set([...pendingMoves.map((move) => move.partidoId), getId(movingMatch._id)])]
        const data = await getRescheduleResources(slug, jornada, {
          fechaHora: dateTime.toISOString(),
          hora: selectedTime,
          dia: weekDays[dateTime.getDay()],
          partidoIgnorado: getId(movingMatch._id),
          excluir: excluding.filter((id) => id !== getId(movingMatch._id)).join(','),
        })
        if (!active) return
        setResources(data)
        setSelectedCourt((current) => data.canchas_libres.some((court) => getId(court) === current)
          ? current
          : getId(data.canchas_libres[0]))
        setSelectedReferee((current) => data.arbitros_libres.some((referee) => getId(referee) === current)
          ? current
          : getId(data.arbitros_libres[0]))
      } catch (error) {
        if (active) {
          setResources({ canchas_libres: [], arbitros_libres: [] })
          setMessage(getErrorMessage(error))
        }
      } finally {
        if (active) setLoadingResources(false)
      }
    }
    loadResources()
    return () => { active = false }
  }, [show, slug, jornada, selectedDate, selectedTime, movingMatch, pendingMoves])

  const buildMove = (targetMatch, slot, reason = 'Reasignación por incidencia') => ({
    partidoId: getId(targetMatch._id),
    jornada: Number(jornada),
    estadoAnterior: getSlot(targetMatch),
    fechaHora: slot.fechaHora,
    hora: slot.hora,
    dia: weekDays[new Date(slot.fechaHora).getDay()],
    canchaId: slot.canchaId,
    arbitroId: slot.arbitroId,
    motivo: reason,
  })
  const buildSelectedSlot = () => {
    const localDateTime = new Date(`${selectedDate}T${selectedTime}:00`)
    return {
      fechaHora: localDateTime.toISOString(),
      hora: selectedTime,
      canchaId: selectedCourt || null,
      arbitroId: selectedReferee || null,
    }
  }
  const evaluateCandidate = async (target = movingMatch, excluding = pendingMoves.map((move) => move.partidoId)) => {
    if (!selectedDate || !selectedTime || !selectedCourt || !selectedReferee) {
      setMessage('Selecciona fecha, hora, cancha y árbitro disponibles.')
      return null
    }
    const slot = buildSelectedSlot()
    const date = new Date(slot.fechaHora)
    const response = await evaluateMatchReschedule(slug, getId(target._id), {
      jornada: Number(jornada),
      ...slot,
      dia: weekDays[date.getDay()],
      excluirPartidoIds: [...new Set(excluding)],
    })
    return { response, move: buildMove(target, slot) }
  }

  const handleResolve = async () => {
    setMessage('')
    try {
      const result = await evaluateCandidate(movingMatch, [])
      if (!result) return
      if (result.response.conflicto) {
        const occupied = journeyMatches.find((item) => getId(item._id) === getId(result.response.partido_ocupante?.id))
        if (!occupied) {
          setMessage('El partido que ocupa ese recurso ya no aparece en esta jornada. Actualiza el calendario.')
          return
        }
        setDraftMove(result.move)
        setOccupant(occupied)
        setOccupantHasRefConflict(result.response.arbitroOcupado)
        setStep('conflict')
        return
      }
      setPendingMoves([result.move])
      setStep('review')
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  const handleSwap = () => {
    const originalSlot = getSlot(movingMatch)
    setPendingMoves([
      draftMove,
      buildMove(occupant, originalSlot, 'Intercambio de horario por conflicto de recursos'),
    ])
    setStep('review')
    setMessage('')
  }

  const handleWait = () => {
    const previousSlot = getSlot(occupant)
    setPendingMoves([
      draftMove,
      buildMove(occupant, {
        ...previousSlot,
        canchaId: null,
        arbitroId: occupantHasRefConflict ? null : previousSlot.arbitroId,
      }, 'Partido dejado en espera para reasignación de recursos'),
    ])
    setStep('review')
    setMessage('')
  }

  const handleMoveOccupant = () => {
    const currentSlot = getMatchDateTime(occupant)
    setPendingMoves([draftMove])
    setMovingMatch(occupant)
    setSelectedDate(currentSlot.date || dates[0] || '')
    setSelectedTime('')
    setSelectedCourt('')
    setSelectedReferee('')
    setStep('chain')
    setMessage('')
  }

  const handleChainMove = async () => {
    setMessage('')
    try {
      const result = await evaluateCandidate(movingMatch, pendingMoves.map((move) => move.partidoId))
      if (!result) return
      if (result.response.conflicto) {
        setMessage('Ya alcanzaste 3 movimientos. Libera una cancha o cambia de horario dentro de la jornada.')
        return
      }
      if (pendingMoves.length >= 3) {
        setMessage('Ya alcanzaste 3 movimientos. Libera una cancha o cambia de horario dentro de la jornada.')
        return
      }
      setPendingMoves((current) => [...current, result.move])
      setStep('review')
    } catch (error) {
      setMessage(error.response?.status === 409
        ? 'Ya alcanzaste 3 movimientos. Libera una cancha o cambia de horario dentro de la jornada.'
        : getErrorMessage(error))
    }
  }

  const handleConfirm = async () => {
    setSaving(true)
    setMessage('')
    try {
      await confirmMatchReschedules(slug, pendingMoves)
      await onConfirmed()
      onHide()
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const selectMatch = (match) => {
    if (match.estado === 'finalizado') return
    setMovingMatch(match)
    const matchDate = getMatchDateTime(match)
    if (matchDate.date) setSelectedDate(matchDate.date)
    if (matchDate.time) setSelectedTime(matchDate.time)
  }

  const isChain = step === 'chain'
  const title = step === 'resolve'
    ? 'Resolver incidencia'
    : step === 'conflict'
      ? 'Conflicto detectado'
      : isChain
        ? 'Mover partido de la cadena'
        : 'Confirmar movimientos'

  return (
    <Modal show={show} onHide={onHide} centered size="xl" dialogClassName="calendar-rescheduler-modal">
      <Modal.Header closeButton><Modal.Title>{title} · Jornada {jornada}</Modal.Title></Modal.Header>
      <Modal.Body>
        {step !== 'review' && <section className="reschedule-calendar">
          <div className="reschedule-calendar-heading">
            <div>
              <strong>Calendario de la jornada</strong>
              <small>Columnas por cancha · solo se muestran fechas de esta jornada</small>
            </div>
            <label>Fecha del calendario
              <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
                {dates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
              </select>
            </label>
          </div>
          <div className="reschedule-calendar-grid">
            {courts.filter((court) => court.estado === 'activa').map((court) => {
              const courtMatches = dateMatches.filter((match) => getId(match.cancha_id) === getId(court._id))
              return <section className="reschedule-court-column" key={court._id}>
                <h3>{court.nombre}</h3>
                {courtMatches.length === 0 && <p className="reschedule-empty-slot">Sin partidos</p>}
                {courtMatches.map((match) => <button
                  className={`reschedule-calendar-match ${getId(movingMatch?._id) === getId(match._id) ? 'is-selected' : ''}`}
                  type="button"
                  key={match._id}
                  onClick={() => selectMatch(match)}
                  disabled={match.estado === 'finalizado'}
                >
                  <strong>{match.hora || 'Hora pendiente'}</strong>
                  <span>{getMatchName(match)}</span>
                  <small>{match.arbitro_id?.nombre || 'Árbitro pendiente'}</small>
                </button>)}
              </section>
            })}
            <section className="reschedule-court-column reschedule-unassigned-column">
              <h3>Sin cancha</h3>
              {dateMatches.filter((match) => !getId(match.cancha_id)).map((match) => <button
                className={`reschedule-calendar-match ${getId(movingMatch?._id) === getId(match._id) ? 'is-selected' : ''}`}
                type="button"
                key={match._id}
                onClick={() => selectMatch(match)}
                disabled={match.estado === 'finalizado'}
              >
                <strong>{match.hora || 'Hora pendiente'}</strong><span>{getMatchName(match)}</span>
              </button>)}
            </section>
          </div>
        </section>}

        {step === 'resolve' && <section className="reschedule-form">
          <p>Partido seleccionado: <strong>{getMatchName(movingMatch)}</strong></p>
          <div className="reschedule-fields">
            <label>Nueva fecha<select value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedTime('') }} required>
              <option value="">Selecciona fecha</option>{dates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
            </select></label>
            <label>Hora<select value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} required>
              <option value="">Selecciona hora</option>{dateTimes.map((time) => <option key={time} value={time}>{time}</option>)}
            </select></label>
            <label>Cancha<select value={selectedCourt} onChange={(event) => setSelectedCourt(event.target.value)} required disabled={loadingResources}>
              <option value="">Selecciona cancha libre</option>{resources.canchas_libres.map((court) => <option key={court._id} value={getId(court)}>{court.nombre}</option>)}
            </select></label>
            <label>Árbitro<select value={selectedReferee} onChange={(event) => setSelectedReferee(event.target.value)} required disabled={loadingResources}>
              <option value="">Selecciona árbitro libre</option>{resources.arbitros_libres.map((referee) => <option key={referee._id} value={getId(referee)}>{referee.nombre}</option>)}
            </select></label>
          </div>
          <p className="reschedule-resource-summary">{loadingResources ? 'Consultando recursos disponibles…' : `${resources.canchas_libres.length} canchas y ${resources.arbitros_libres.length} árbitros disponibles`}</p>
        </section>}

        {step === 'conflict' && <section className="reschedule-conflict">
          <p>El slot de las <strong>{selectedTime}</strong> en <strong>{courts.find((court) => getId(court._id) === selectedCourt)?.nombre}</strong> ya está ocupado por <strong>{getMatchName(occupant)}</strong>. ¿Qué quieres hacer?</p>
          <div className="reschedule-conflict-actions">
            <Button variant="primary" onClick={handleSwap}>HACER SWAP</Button>
            <Button variant="outline-primary" onClick={handleMoveOccupant}>MOVER AL OTRO</Button>
            <Button variant="outline-warning" onClick={handleWait}>DEJAR EN ESPERA</Button>
          </div>
        </section>}

        {isChain && <section className="reschedule-form">
          <p>¿A dónde movemos a <strong>{getMatchName(movingMatch)}</strong>?</p>
          <div className="reschedule-fields">
            <label>Nueva fecha<select value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedTime('') }} required>
              {dates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
            </select></label>
            <label>Hora<select value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} required>
              <option value="">Selecciona hora</option>{dateTimes.map((time) => <option key={time} value={time}>{time}</option>)}
            </select></label>
            <label>Cancha<select value={selectedCourt} onChange={(event) => setSelectedCourt(event.target.value)} required disabled={loadingResources}>
              <option value="">Selecciona cancha libre</option>{resources.canchas_libres.map((court) => <option key={court._id} value={getId(court)}>{court.nombre}</option>)}
            </select></label>
            <label>Árbitro<select value={selectedReferee} onChange={(event) => setSelectedReferee(event.target.value)} required disabled={loadingResources}>
              <option value="">Selecciona árbitro libre</option>{resources.arbitros_libres.map((referee) => <option key={referee._id} value={getId(referee)}>{referee.nombre}</option>)}
            </select></label>
          </div>
        </section>}

        {step === 'review' && <section className="reschedule-review">
          <p>Estos cambios siguen sin guardarse. Se validarán juntos antes de aplicarse:</p>
          {pendingMoves.map((move) => {
            const target = journeyMatches.find((match) => getId(match._id) === move.partidoId)
            const destinationCourt = courts.find((court) => getId(court._id) === move.canchaId)?.nombre || 'Sin cancha (pendiente)'
            const destinationReferee = referees.find((referee) => getId(referee._id) === move.arbitroId)?.nombre || 'Sin árbitro'
            return <article key={move.partidoId} className="reschedule-review-row">
              <strong>{getMatchName(target)}</strong>
              <span>{new Date(move.fechaHora).toLocaleString('es-MX')} · {destinationCourt} · {destinationReferee}</span>
            </article>
          })}
          <p className="reschedule-transaction-notice">Todos los movimientos y su bitácora se guardarán en una sola transacción.</p>
        </section>}

        {message && <div className="reschedule-error" role="alert">{message}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={saving}>Cancelar</Button>
        {step === 'resolve' && <Button variant="primary" onClick={handleResolve} disabled={loadingResources || saving || !selectedTime || !selectedCourt || !selectedReferee}>Continuar</Button>}
        {step === 'chain' && <Button variant="primary" onClick={handleChainMove} disabled={loadingResources || saving || !selectedTime || !selectedCourt || !selectedReferee}>Agregar movimiento</Button>}
        {step === 'review' && <Button variant="success" onClick={handleConfirm} disabled={saving}>{saving ? 'Confirmando…' : 'Confirmar todos los movimientos'}</Button>}
      </Modal.Footer>
    </Modal>
  )
}

export default CalendarRescheduler

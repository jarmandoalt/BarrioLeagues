export const COURT_BLOCK_DURATION_MS = 2 * 60 * 60 * 1000

export const isCourtBlocked = (firstStart, secondStart) => (
  Math.abs(new Date(firstStart).getTime() - new Date(secondStart).getTime()) < COURT_BLOCK_DURATION_MS
)

export const isRefereeBusyAt = (firstStart, secondStart) => (
  new Date(firstStart).getTime() === new Date(secondStart).getTime()
)

export const isMatchInSameJourney = (match, leagueId, jornada) => (
  match.liga_id === leagueId && Number(match.jornada) === Number(jornada)
)

export const findScheduleConflicts = (matches, scheduleByMatchId) => {
  const projected = matches.map((match) => ({
    ...match,
    ...(scheduleByMatchId.get(String(match._id)) || {}),
  })).filter((match) => match.estado !== 'suspendido')
  const conflicts = []

  for (let firstIndex = 0; firstIndex < projected.length; firstIndex += 1) {
    const first = projected[firstIndex]
    if (!first.fecha) continue
    for (let secondIndex = firstIndex + 1; secondIndex < projected.length; secondIndex += 1) {
      const second = projected[secondIndex]
      if (!second.fecha) continue
      if (first.cancha_id && String(first.cancha_id) === String(second.cancha_id)
        && isCourtBlocked(first.fecha, second.fecha)) {
        conflicts.push({ type: 'cancha', firstMatchId: String(first._id), secondMatchId: String(second._id) })
      }
      if (first.arbitro_id && String(first.arbitro_id) === String(second.arbitro_id)
        && isRefereeBusyAt(first.fecha, second.fecha)) {
        conflicts.push({ type: 'arbitro', firstMatchId: String(first._id), secondMatchId: String(second._id) })
      }
    }
  }
  return conflicts
}

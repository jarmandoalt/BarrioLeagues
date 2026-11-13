import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { processScheduledNotifications } from './scheduleNotificationService.js'
import { advanceDueLeagueJourneys } from './leagueJourneyAutomation.js'

dayjs.extend(utc)
dayjs.extend(timezone)

export const runScheduleNotificationCycle = async () => {
  console.log(`[Schedule Cron] [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Ejecutando ciclo de notificaciones.`)
  const startTime = Date.now()
  const advancedLeagues = await advanceDueLeagueJourneys()
  for (const { league, pendingMatches } of advancedLeagues) {
    console.log(
      `[Schedule Cron] ${league.nombre} avanzó automáticamente a la jornada ${league.jornada}. Partidos anteriores sin marcador conservados como pendientes: ${pendingMatches}.`,
    )
  }

  const summary = await processScheduledNotifications()
  console.log(
    `[Schedule Cron] Ciclo finalizado en ${Date.now() - startTime}ms. Evaluados: ${summary.evaluatedMatches || 0}, `
    + `Avisos Árbitro: ${summary.notifiedReferees || 0}, Avisos Capitanes: ${summary.notifiedCaptains || 0}, `
    + `Alertas Admin: ${summary.alertsGenerated || 0}`,
  )
  return summary
}

import cron from 'node-cron'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import {
  isTestMode,
  getTimeFactor,
  processScheduledNotifications,
  checkRefereeConfirmations,
} from './scheduleNotificationService.js'
import { advanceDueLeagueJourneys } from './leagueJourneyAutomation.js'

dayjs.extend(utc)
dayjs.extend(timezone)

let cronJob = null

/**
 * Inicia el servicio de cron para notificaciones de horarios
 * - TEST_MODE=true: corre cada 1 minuto (* * * * *)
 * - Producción: corre a las 8:00 AM (0 8 * * *) y revisiones de timeout
 */
export const startScheduleNotificationCron = () => {
  const testModeActive = isTestMode()
  const schedule = '* * * * *'
  const description = testModeActive ? 'cada minuto (TEST_MODE activado)' : 'cada minuto para respetar el horario configurado'

  console.log(`[Schedule Cron] Iniciando servicio de entrega de horarios... (ejecutará ${description})`)

  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }

  cronJob = cron.schedule(schedule, async () => {
    try {
      console.log(`\n[Schedule Cron] [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Ejecutando ciclo de entrega de horarios...`)
      const startTime = Date.now()

      const advancedLeagues = await advanceDueLeagueJourneys()
      for (const { league, pendingMatches } of advancedLeagues) {
        console.log(
          `[Schedule Cron] ${league.nombre} avanzó automáticamente a la jornada ${league.jornada}. Partidos anteriores sin marcador conservados como pendientes: ${pendingMatches}.`,
        )
      }

      const summary = await processScheduledNotifications()

      const duration = Date.now() - startTime
      console.log(
        `[Schedule Cron] Ciclo finalizado en ${duration}ms. Evaluados: ${summary.evaluatedMatches || 0}, Avisos Árbitro: ${
          summary.notifiedReferees || 0
        }, Avisos Capitanes: ${summary.notifiedCaptains || 0}, Alertas Admin: ${summary.alertsGenerated || 0}`
      )
    } catch (error) {
      console.error('[Schedule Cron] Error crítico durante la ejecución del cron:', error)
    }
  })

  return cronJob
}

/**
 * Detiene el servicio de cron
 */
export const stopScheduleNotificationCron = () => {
  if (cronJob) {
    cronJob.stop()
    console.log('[Schedule Cron] Cron detenido')
    cronJob = null
  }
}

/**
 * Retorna el estado actual del cron
 */
export const getScheduleNotificationCronStatus = () => {
  return {
    isRunning: cronJob !== null,
    testMode: isTestMode(),
    schedule: '* * * * *',
    timeFactor: getTimeFactor(),
  }
}

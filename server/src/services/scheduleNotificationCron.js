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
  const schedule = testModeActive ? '* * * * *' : '0 8 * * *'
  const description = testModeActive ? 'cada 1 minuto (TEST_MODE activado)' : 'a las 8:00 AM (Producción)'

  console.log(`[Schedule Cron] Iniciando servicio de entrega de horarios... (ejecutará ${description})`)

  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }

  cronJob = cron.schedule(schedule, async () => {
    try {
      console.log(`\n[Schedule Cron] [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Ejecutando ciclo de entrega de horarios...`)
      const startTime = Date.now()

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

  // En producción, además programar una revisión horaria para timeouts de confirmación de árbitros
  if (!testModeActive) {
    cron.schedule('0 * * * *', async () => {
      try {
        await checkRefereeConfirmations()
      } catch (err) {
        console.error('[Schedule Cron] Error en chequeo horario de confirmaciones:', err)
      }
    })
  }

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
    schedule: isTestMode() ? 'cada 1 minuto (* * * * *)' : 'a las 8:00 AM (0 8 * * *)',
    timeFactor: getTimeFactor(),
  }
}

import { Router } from 'express'
import mongoose from 'mongoose'
import { Court } from '../models/Court.js'
import { League } from '../models/League.js'

export const courtsRoutes = Router()

const requireDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'MongoDB no está conectado' })
    return false
  }

  return true
}

const hasOverlappingSchedules = (schedules = [], durationMinutes) => schedules.some((schedule, index) => {
  if (!schedule.horaInicio || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.horaInicio)) return false
  const [hours, minutes] = schedule.horaInicio.split(':').map(Number)
  const startMinutes = (hours * 60) + minutes
  return schedules.slice(index + 1).some((otherSchedule) => {
    if (schedule.dia !== otherSchedule.dia || !otherSchedule.horaInicio || !/^([01]\d|2[0-3]):[0-5]\d$/.test(otherSchedule.horaInicio)) return false
    const [otherHours, otherMinutes] = otherSchedule.horaInicio.split(':').map(Number)
    const otherStartMinutes = (otherHours * 60) + otherMinutes
    return Math.abs(startMinutes - otherStartMinutes) < durationMinutes
  })
})

const rejectOverlappingSchedules = (res, schedules, durationMinutes) => {
  if (!hasOverlappingSchedules(schedules, durationMinutes)) return false
  res.status(409).json({ message: 'No se pueden empalmar partidos el mismo día a esa hora.' })
  return true
}

courtsRoutes.get('/canchas', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const courts = await Court.find(req.query.slug ? { liga_id: req.query.slug.toLowerCase() } : {}).sort({ nombre: 1 })
    return res.json(courts)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron consultar las canchas', error: error.message })
  }
})

courtsRoutes.post('/canchas', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const ligaId = req.body.liga_id?.toLowerCase()
    const league = await League.findOne({ slug: ligaId })
    if (!league) return res.status(404).json({ message: 'La liga indicada no existe' })
    if (rejectOverlappingSchedules(res, req.body.horarios, league.duracionPartido || 60)) return

    const court = await Court.create({ ...req.body, liga_id: ligaId })
    return res.status(201).json(court)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo crear la cancha', error: error.message })
  }
})

courtsRoutes.put('/canchas/:id', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const ligaId = req.body.liga_id?.toLowerCase()
    const league = await League.findOne({ slug: ligaId }).select('duracionPartido')
    if (!league) return res.status(404).json({ message: 'La liga indicada no existe' })
    if (rejectOverlappingSchedules(res, req.body.horarios, league.duracionPartido || 60)) return

    const court = await Court.findOneAndUpdate(
      { _id: req.params.id, liga_id: ligaId },
      { ...req.body, liga_id: ligaId },
      { new: true, runValidators: true },
    )
    if (!court) return res.status(404).json({ message: 'Cancha no encontrada' })
    return res.json(court)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo actualizar la cancha', error: error.message })
  }
})

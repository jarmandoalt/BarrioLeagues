import { Router } from 'express'
import mongoose from 'mongoose'
import { Team } from '../models/Team.js'
import { League } from '../models/League.js'

export const teamsRoutes = Router()

const requireDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'MongoDB no está conectado' })
    return false
  }

  return true
}

teamsRoutes.get('/equipos', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const filter = req.query.slug ? { ligaId: req.query.slug.toLowerCase() } : {}
    const teams = await Team.find(filter).sort({ nombre: 1 })
    return res.json(teams)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron consultar los equipos', error: error.message })
  }
})

teamsRoutes.post('/equipos', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const payload = { ...req.body, ligaId: req.body.ligaId?.toLowerCase() }
    const league = await League.findOne({ slug: payload.ligaId })

    if (!league) {
      return res.status(404).json({ message: 'La liga indicada no existe' })
    }

    const team = await Team.create(payload)
    return res.status(201).json(team)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo crear el equipo', error: error.message })
  }
})

teamsRoutes.put('/equipos/:id', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const payload = { ...req.body, ligaId: req.body.ligaId?.toLowerCase() }
    const league = await League.findOne({ slug: payload.ligaId })

    if (!league) {
      return res.status(404).json({ message: 'La liga indicada no existe' })
    }

    const teamToUpdate = await Team.findById(req.params.id)

    if (!teamToUpdate) {
      return res.status(404).json({ message: 'Equipo no encontrado' })
    }

    Object.assign(teamToUpdate, payload)
    const team = await teamToUpdate.save()

    return res.json(team)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo actualizar el equipo', error: error.message })
  }
})

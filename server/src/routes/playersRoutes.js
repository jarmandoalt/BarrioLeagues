import { Router } from 'express'
import mongoose from 'mongoose'
import { Player } from '../models/Player.js'
import { Team } from '../models/Team.js'

export const playersRoutes = Router()

const requireDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'MongoDB no está conectado' })
    return false
  }

  return true
}

playersRoutes.get('/jugadores', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const players = await Player.find(req.query.equipo_id ? { equipo_id: req.query.equipo_id } : {}).sort({ numero: 1 })
    return res.json(players)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron consultar los jugadores', error: error.message })
  }
})

playersRoutes.post('/jugadores', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const team = await Team.findById(req.body.equipo_id)

    if (!team) {
      return res.status(404).json({ message: 'El equipo indicado no existe' })
    }

    const player = await Player.create(req.body)
    return res.status(201).json(player)
  } catch (error) {
    const duplicateNumber = error.code === 11000
    return res.status(duplicateNumber ? 409 : 400).json({
      message: duplicateNumber ? 'Ese número ya está registrado en este equipo' : 'No se pudo crear el jugador',
      error: error.message,
    })
  }
})

playersRoutes.put('/jugadores/:id', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })

    if (!player) {
      return res.status(404).json({ message: 'Jugador no encontrado' })
    }

    return res.json(player)
  } catch (error) {
    const duplicateNumber = error.code === 11000
    return res.status(duplicateNumber ? 409 : 400).json({
      message: duplicateNumber ? 'Ese número ya está registrado en este equipo' : 'No se pudo actualizar el jugador',
      error: error.message,
    })
  }
})

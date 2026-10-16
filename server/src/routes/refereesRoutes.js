import { Router } from 'express'
import mongoose from 'mongoose'
import { League } from '../models/League.js'
import { Referee } from '../models/Referee.js'

export const refereesRoutes = Router()

const requireDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'MongoDB no está conectado' })
    return false
  }

  return true
}

refereesRoutes.get('/arbitros', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const referees = await Referee.find(req.query.slug ? { liga_id: req.query.slug.toLowerCase() } : {}).sort({ nombre: 1 })
    return res.json(referees)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron consultar los árbitros', error: error.message })
  }
})

refereesRoutes.post('/arbitros', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const ligaId = req.body.liga_id?.toLowerCase()
    const league = await League.findOne({ slug: ligaId })

    if (!league) {
      return res.status(404).json({ message: 'La liga indicada no existe' })
    }

    const referee = await Referee.create({ ...req.body, liga_id: ligaId })
    return res.status(201).json(referee)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo crear el árbitro', error: error.message })
  }
})

refereesRoutes.put('/arbitros/:id', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const ligaId = req.body.liga_id?.toLowerCase()
    const referee = await Referee.findOneAndUpdate(
      { _id: req.params.id, liga_id: ligaId },
      { ...req.body, liga_id: ligaId },
      { new: true, runValidators: true },
    )

    if (!referee) return res.status(404).json({ message: 'Árbitro no encontrado' })
    return res.json(referee)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo actualizar el árbitro', error: error.message })
  }
})

import { Router } from 'express'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { League } from '../models/League.js'

export const leaguesRoutes = Router()

const requireDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'MongoDB no está conectado' })
    return false
  }

  return true
}

leaguesRoutes.post('/ligas', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const email = req.body.dueno?.email?.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'El correo del administrador de la liga es obligatorio y debe ser válido' })
    }
    const league = await League.create(req.body)
    const passwordHash = await bcrypt.hash(league.slug, 12)
    const { LeagueAdminCredential } = await import('../models/LeagueAdminCredential.js')
    try {
      await LeagueAdminCredential.create({ leagueSlug: league.slug, passwordHash, mustChangePassword: true })
    } catch (error) {
      await League.deleteOne({ _id: league._id })
      throw error
    }
    return res.status(201).json(league)
  } catch (error) {
    const status = error.code === 11000 ? 409 : 400
    return res.status(status).json({
      message: error.code === 11000 ? 'El slug ya está registrado' : 'No se pudo crear la liga',
      error: error.message,
    })
  }
})

leaguesRoutes.get('/ligas', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const leagues = await League.find().sort({ nombre: 1 })
    return res.json(leagues)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron consultar las ligas', error: error.message })
  }
})

leaguesRoutes.get('/ligas/:slug', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const league = await League.findOne({ slug: req.params.slug.toLowerCase() })

    if (!league) {
      return res.status(404).json({ message: 'Liga no encontrada' })
    }

    return res.json(league)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo consultar la liga', error: error.message })
  }
})

leaguesRoutes.put('/ligas/:slug', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const { slug, ...updates } = req.body
    const isSuperAdmin = req.admin?.role === 'superadmin'
    // Un admin de liga solo edita su configuración; slug, estado y branding son del admin general.
    const allowedUpdates = isSuperAdmin
      ? updates
      : Object.fromEntries(['jornada', 'actualizacionJornada', 'duracionPartido', 'formatoTorneo', 'avisoPartidosDia', 'avisoPartidosHora', 'dueno'].filter((field) => field in updates).map((field) => [field, updates[field]]))
    const league = await League.findOneAndUpdate(
      { slug: req.params.slug.toLowerCase() },
      { ...allowedUpdates, ...(slug && isSuperAdmin ? { slug } : {}) },
      { new: true, runValidators: true },
    )

    if (!league) {
      return res.status(404).json({ message: 'Liga no encontrada' })
    }

    return res.json(league)
  } catch (error) {
    const status = error.code === 11000 ? 409 : 400
    return res.status(status).json({
      message: error.code === 11000 ? 'El slug ya está registrado' : 'No se pudo actualizar la liga',
      error: error.message,
    })
  }
})

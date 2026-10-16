import { Router } from 'express'
import mongoose from 'mongoose'
import { Team } from '../models/Team.js'

export const standingsRoutes = Router()

standingsRoutes.get('/standings', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'MongoDB no está conectado' })
  }

  try {
    const teams = await Team.find({ ligaId: req.query.slug?.toLowerCase() })
      .sort({ 'stats.pts': -1, 'stats.dg': -1, 'stats.gf': -1, nombre: 1 })

    return res.json(teams.map((team, index) => ({
      pos: index + 1,
      nombre: team.nombre,
      colorPrimario: team.colorPrimario,
      colorSecundario: team.colorSecundario,
      imagen: team.imagen,
      pj: team.stats.pj,
      pg: team.stats.pg,
      pe: team.stats.pe,
      pp: team.stats.pp,
      gf: team.stats.gf,
      gc: team.stats.gc,
      dg: team.stats.dg,
      pts: team.stats.pts,
    })))
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo consultar la tabla', error: error.message })
  }
})

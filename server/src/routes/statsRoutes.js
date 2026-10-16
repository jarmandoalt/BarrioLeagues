import { Router } from 'express'
import { Match } from '../models/Match.js'
import { Player } from '../models/Player.js'
import { Team } from '../models/Team.js'

export const statsRoutes = Router()

const TOP = 10
const isGoalkeeper = (player) => /portero|arquero|goalkeeper|\bPOR\b|\bGK\b/i.test(player.posicion)

const rank = (map, field) => [...map.values()]
  .filter((row) => row[field] > 0)
  .sort((a, b) => b[field] - a[field] || a.jugador.localeCompare(b.jugador))
  .slice(0, TOP)

statsRoutes.get('/estadisticas', async (req, res) => {
  try {
    const slug = req.query.slug?.toLowerCase()
    const empty = { goleadores: [], porteros: [], tarjetasRojas: [], tarjetasAmarillas: [] }
    if (!slug) return res.json(empty)

    const teams = await Team.find({ ligaId: slug }).select('nombre')
    if (teams.length === 0) return res.json(empty)

    const teamNames = new Map(teams.map((team) => [String(team._id), team.nombre]))
    const [players, matches] = await Promise.all([
      Player.find({ equipo_id: { $in: teams.map((team) => team._id) } }),
      Match.find({ liga_id: slug, estado: { $in: ['en_curso', 'finalizado'] } }),
    ])

    const playersByKey = new Map(players.map((player) => [`${player.equipo_id}:${player.numero}`, player]))
    const rows = new Map()
    const getRow = (player) => {
      const key = String(player._id)
      if (!rows.has(key)) {
        rows.set(key, {
          jugador: player.nombre_corto || player.nombre_completo,
          equipo: teamNames.get(String(player.equipo_id)),
          goles: 0,
          rojas: 0,
          amarillas: 0,
          partidos: 0,
        })
      }
      return rows.get(key)
    }

    const fields = { GOL: 'goles', TR: 'rojas', TA: 'amarillas' }
    const goalkeepersByTeam = new Map()
    players.filter(isGoalkeeper).forEach((player) => {
      const key = String(player.equipo_id)
      goalkeepersByTeam.set(key, [...(goalkeepersByTeam.get(key) || []), player])
    })

    matches.forEach((match) => {
      match.eventos.forEach((event) => {
        const player = playersByKey.get(`${event.equipo_id}:${event.jugador_numero}`)
        if (player && fields[event.tipo]) getRow(player)[fields[event.tipo]] += 1
      })

      if (match.estado !== 'finalizado') return
      const sides = [
        [match.equipoLocal_id, match.marcadorVisitante],
        [match.equipoVisitante_id, match.marcadorLocal],
      ]
      sides.forEach(([teamId, goalsConceded]) => {
        if (goalsConceded !== 0) return
        const keepers = goalkeepersByTeam.get(String(teamId)) || []
        if (keepers.length === 1) getRow(keepers[0]).partidos += 1
      })
    })

    res.json({
      goleadores: rank(rows, 'goles').map(({ jugador, equipo, goles }) => ({ jugador, equipo, goles })),
      porteros: rank(rows, 'partidos').map(({ jugador, equipo, partidos }) => ({ jugador, equipo, partidos })),
      tarjetasRojas: rank(rows, 'rojas').map(({ jugador, equipo, rojas }) => ({ jugador, equipo, rojas })),
      tarjetasAmarillas: rank(rows, 'amarillas').map(({ jugador, equipo, amarillas }) => ({ jugador, equipo, amarillas })),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

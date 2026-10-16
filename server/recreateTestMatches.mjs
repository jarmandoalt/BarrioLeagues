import mongoose from 'mongoose'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { Match } from './src/models/Match.js'
import { League } from './src/models/League.js'
import { Referee } from './src/models/Referee.js'
import { Court } from './src/models/Court.js'
import { Team } from './src/models/Team.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

async function createTestMatches() {
  try {
    await mongoose.connect('mongodb://localhost:27017/barrio-leagues')
    console.log('✓ MongoDB conectado')

    // Obtener Liga
    const league = await League.findOne({ nombre: 'Barrio Leagues Test' })
    if (!league) {
      console.error('✗ Liga no encontrada')
      process.exit(1)
    }
    console.log(`✓ Liga encontrada: ${league.nombre} (ID: ${league._id})`)

    // Obtener árbitros, canchas y equipos
    const referees = await Referee.find({ liga_id: league._id })
    const courts = await Court.find({ liga_id: league._id })
    const teams = await Team.find({ ligaId: league._id.toString() })

    console.log(`✓ ${referees.length} árbitros, ${courts.length} canchas, ${teams.length} equipos`)

    if (!referees.length || !courts.length || teams.length < 2) {
      console.error('✗ Datos insuficientes para crear partidos')
      process.exit(1)
    }

    // Crear un partido por día
    let jornada = 1
    const baseDate = dayjs()

    for (let i = 0; i < 7; i++) {
      const dayIndex = (baseDate.day() + i) % 7
      const dayOfWeek = DAYS[dayIndex === 0 ? 6 : dayIndex - 1] // Domingo es 6
      const matchDate = baseDate.add(i, 'days')

      const match = new Match({
        liga_id: league._id.toString(),
        idPartido: String(100000 + jornada),
        jornada,
        estado: 'programado',
        fecha: matchDate.toDate(),
        hora: '15:00',
        arbitro_id: referees[i % referees.length]._id,
        cancha_id: courts[i % courts.length]._id,
        equipoLocal_id: teams[0]._id,
        equipoVisitante_id: teams[1]._id,
        confirmado_arbitro: 'pendiente',
        referee_confirmed: false,
      })

      await match.save()
      console.log(`✓ Partido ${jornada} creado para ${dayOfWeek} (${matchDate.format('DD/MM/YYYY')} a las 15:00)`)
      jornada++
    }

    console.log('\n✓ Todos los partidos de prueba creados exitosamente')
    process.exit(0)
  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  }
}

createTestMatches()

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { Match } from '../models/Match.js'
import { Team } from '../models/Team.js'
import { Referee } from '../models/Referee.js'

dayjs.extend(utc)
dayjs.extend(timezone)

dotenv.config()

const LIGA_ID = 'barrio_test'

async function createTestData() {
  try {
    console.log('Conectando a MongoDB...')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Conectado')

    // Crear equipos de prueba
    console.log('\n📋 Creando equipos...')
    let teams = []
    try {
      teams = await Team.insertMany(
        [
          {
            ligaId: LIGA_ID,
            nombre: 'Equipo A',
            nombreCorto: 'EQA',
            dt: { nombre: 'Juan Pérez', whatsapp: '+5215551234567' },
          },
          {
            ligaId: LIGA_ID,
            nombre: 'Equipo B',
            nombreCorto: 'EQB',
            dt: { nombre: 'María García', whatsapp: '+5215559876543' },
          },
          {
            ligaId: LIGA_ID,
            nombre: 'Equipo C',
            nombreCorto: 'EQC',
            dt: { nombre: 'Carlos López', whatsapp: '+5215554443333' },
          },
          {
            ligaId: LIGA_ID,
            nombre: 'Equipo D',
            nombreCorto: 'EQD',
            dt: { nombre: 'Ana Martínez', whatsapp: '+5215552221111' },
          },
        ],
        { ordered: false }
      )
    } catch (error) {
      if (error.code === 11000) {
        console.log('⚠️  Algunos equipos ya existen, continuando...')
        teams = await Team.find({ ligaId: LIGA_ID })
      } else {
        throw error
      }
    }
    console.log(`✅ ${teams.length} equipos disponibles`)

    // Crear árbitros de prueba
    console.log('\n👨‍⚖️ Creando árbitros...')
    let referees = []
    try {
      referees = await Referee.insertMany(
        [
          { nombre: 'María González', telefono: '+5215557778888', liga_id: LIGA_ID },
          { nombre: 'Luis Rodríguez', telefono: '+5215559998888', liga_id: LIGA_ID },
          { nombre: 'Pedro Sánchez', telefono: '+5215553332222', liga_id: LIGA_ID },
        ],
        { ordered: false }
      )
    } catch (error) {
      if (error.code === 11000) {
        console.log('⚠️  Algunos árbitros ya existen, continuando...')
        referees = await Referee.find({ liga_id: LIGA_ID })
      } else {
        throw error
      }
    }
    console.log(`✅ ${referees.length} árbitros disponibles`)

    // Crear partidos para cada día de la semana próxima
    console.log('\n⚽ Creando partidos de prueba...')

    if (teams.length === 0) {
      throw new Error('No hay equipos para crear partidos')
    }

    if (referees.length === 0) {
      throw new Error('No hay árbitros para crear partidos')
    }

    const today = dayjs()
    const matchesByDay = {}

    // Definir partidos para cada día
    const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    const dayToDate = (dayName) => {
      const dayNum = {
        MONDAY: 1,
        TUESDAY: 2,
        WEDNESDAY: 3,
        THURSDAY: 4,
        FRIDAY: 5,
        SATURDAY: 6,
        SUNDAY: 0,
      }[dayName]

      let targetDate = today
      const currentDay = today.day()

      if (dayNum > currentDay) {
        targetDate = today.add(dayNum - currentDay, 'days')
      } else if (dayNum < currentDay) {
        targetDate = today.add(7 - currentDay + dayNum, 'days')
      }

      return targetDate
    }

    const matchesToCreate = []
    for (let i = 0; i < daysOfWeek.length; i++) {
      const day = daysOfWeek[i]
      const date = dayToDate(day)

      // Crear 2 partidos por día
      for (let j = 0; j < 2; j++) {
        const idPartido = `${i}${j}${Math.random().toString().slice(2, 6)}`

        matchesToCreate.push({
          idPartido: idPartido.padEnd(6, '0').slice(0, 6),
          liga_id: LIGA_ID,
          equipoLocal_id: teams[j % teams.length]._id,
          equipoVisitante_id: teams[(j + 1) % teams.length]._id,
          arbitro_id: referees[j % referees.length]._id,
          jornada: 1,
          fecha: date.toDate(),
          hora: `${9 + j}:00`,
          estado: 'programado',
          marcadorLocal: 0,
          marcadorVisitante: 0,
        })
      }
    }

    const createdMatches = await Match.insertMany(matchesToCreate, { ordered: false }).catch((error) => {
      if (error.code === 11000) {
        console.log('⚠️  Algunos partidos ya existen, continuando...')
        return []
      }
      throw error
    })

    // Si no se crearon, obtener los existentes
    if (createdMatches.length === 0) {
      const allMatches = await Match.find({ liga_id: LIGA_ID })
      console.log(`✅ ${allMatches.length} partidos disponibles`)
    } else {
      console.log(`✅ ${createdMatches.length} partidos creados`)
    }

    // Mostrar resumen
    console.log('\n📊 RESUMEN DE PARTIDOS DE PRUEBA:')
    console.log('=' + '='.repeat(59))

    // Obtener todos los partidos
    const allMatches = await Match.find({ liga_id: LIGA_ID })

    for (let i = 0; i < daysOfWeek.length; i++) {
      const day = daysOfWeek[i]
      const date = dayToDate(day)
      const dayMatches = allMatches.filter(
        (m) => dayjs(m.fecha).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
      )

      console.log(
        `\n${day.padEnd(10)} (${date.format('DD/MM/YYYY')}): ${dayMatches.length} partido(s)`
      )
      dayMatches.forEach((match) => {
        console.log(
          `  🎫 ${match.idPartido} | ${match.hora} | ${match.estado}`
        )
      })
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Datos de prueba creados exitosamente!')

    console.log('\n📝 Para probar el sistema:')
    console.log(`
1. Asegúrate que TEST_MODE=true en tu .env
2. Reinicia el servidor (npm run dev)
3. Ejecuta: curl -X POST http://localhost:5005/api/test/simular-jornada -H "Content-Type: application/json" -d '{"matchDate": "${dayToDate('MONDAY').format('YYYY-MM-DD')}"}'
4. Verifica los logs: curl http://localhost:5005/api/test/logs
    `)

    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    await mongoose.connection.close()
    process.exit(1)
  }
}

createTestData()

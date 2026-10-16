import mongoose from 'mongoose'
import { League } from './src/models/League.js'
import { Team } from './src/models/Team.js'
import { Referee } from './src/models/Referee.js'
import { Court } from './src/models/Court.js'

async function seedLasHuertas() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/game')
    console.log('✓ Conectado a MongoDB')

    const slug = 'las-huertas'
    const league = await League.findOne({ slug })
    if (!league) {
      console.error(`✗ No se encontró la liga con slug "${slug}"`)
      process.exit(1)
    }
    console.log(`✓ Liga encontrada: ${league.nombre} (Slug: ${league.slug})`)

    // 1. Borrar equipos existentes en las-huertas
    const deletedTeams = await Team.deleteMany({ ligaId: slug })
    console.log(`✓ Equipos eliminados: ${deletedTeams.deletedCount}`)

    // Borrar árbitros y canchas previos de la liga para asegurar los 5 solicitados de cada uno (opcional pero limpio)
    await Referee.deleteMany({ liga_id: slug })
    await Court.deleteMany({ liga_id: slug })

    // 2. Agregar 10 nuevos equipos con el teléfono de contacto +5214494481016
    const teamsToCreate = []
    for (let i = 1; i <= 10; i++) {
      const numStr = String(i).padStart(2, '0')
      teamsToCreate.push({
        ligaId: slug,
        nombre: `Equipo Huertas ${i}`,
        nombreCorto: `HUA${numStr}`.substring(0, 5),
        dt: {
          nombre: `DT Huertas ${i}`,
          whatsapp: '+5214494481016',
        },
      })
    }
    const createdTeams = await Team.insertMany(teamsToCreate)
    console.log(`✓ Creados ${createdTeams.length} equipos para ${slug}`)

    // 3. Agregar 5 árbitros con el teléfono +5214494481016
    const refereesToCreate = []
    for (let i = 1; i <= 5; i++) {
      refereesToCreate.push({
        nombre: `Árbitro Huertas ${i}`,
        telefono: '+5214494481016',
        liga_id: slug,
        estado: 'activo',
      })
    }
    const createdReferees = await Referee.insertMany(refereesToCreate)
    console.log(`✓ Creados ${createdReferees.length} árbitros para ${slug}`)

    // 4. Agregar 5 canchas con 4 horarios cada uno repartidos en sábado y domingo
    const courtsToCreate = []
    for (let i = 1; i <= 5; i++) {
      courtsToCreate.push({
        nombre: `Cancha Huertas ${i}`,
        liga_id: slug,
        estado: 'activa',
        horarios: [
          { dia: 'sábado', horaInicio: '09:00' },
          { dia: 'sábado', horaInicio: '11:00' },
          { dia: 'domingo', horaInicio: '09:00' },
          { dia: 'domingo', horaInicio: '11:00' },
        ],
      })
    }
    const createdCourts = await Court.insertMany(courtsToCreate)
    console.log(`✓ Creadas ${createdCourts.length} canchas para ${slug} con 4 horarios de fin de semana cada una`)

    console.log('\n✓ Seeding de las-huertas completado exitosamente.')
    process.exit(0)
  } catch (error) {
    console.error('✗ Error ejecutando seedLasHuertas:', error)
    process.exit(1)
  }
}

seedLasHuertas()

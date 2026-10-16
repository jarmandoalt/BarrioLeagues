import mongoose from 'mongoose'
import { Referee } from './src/models/Referee.js'

async function updateReferees() {
  try {
    await mongoose.connect('mongodb://localhost:27017/barrio-leagues')
    console.log('✓ MongoDB conectado')

    const newLigaId = '6acf18d71991f7708d0e34e0'

    // Actualizar árbitros con liga_id antigua
    const result = await Referee.updateMany(
      { liga_id: 'barrio_test' },
      { $set: { liga_id: newLigaId } }
    )

    console.log(`✓ Árbitros actualizados: ${result.modifiedCount}`)

    // Obtener todos los árbitros con la nueva liga
    const referees = await Referee.find({ liga_id: newLigaId })
    console.log(`✓ Total árbitros con nueva liga: ${referees.length}`)
    referees.forEach(r => console.log(`  - ${r.nombre} (+${r.telefono})`))

    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  }
}

updateReferees()

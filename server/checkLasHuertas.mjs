import mongoose from 'mongoose'
import { Team } from './src/models/Team.js'
import { League } from './src/models/League.js'

async function check() {
  await mongoose.connect('mongodb://localhost:27017/game')
  const league = await League.findOne({ slug: 'las-huertas' })
  const teams = await Team.find({ ligaId: 'las-huertas' })
  console.log('League:', league ? league.nombre : 'Not found')
  console.log('Teams count:', teams.length)
  teams.forEach(t => console.log(` - ${t.nombre} (ligaId: ${t.ligaId})`))
  process.exit(0)
}
check()

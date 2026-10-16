import { connect } from 'mongoose';
import { League } from './src/models/League.js';
import { Team } from './src/models/Team.js';
import { Referee } from './src/models/Referee.js';
import { Court } from './src/models/Court.js';
import dotenv from 'dotenv';

dotenv.config();
await connect(process.env.MONGO_URI);

const leagues = await League.countDocuments();
const teams = await Team.countDocuments();
const referees = await Referee.countDocuments();
const courts = await Court.countDocuments();

console.log('=== ESTADO ACTUAL DE LA BASE DE DATOS ===');
console.log(`Ligas: ${leagues}`);
console.log(`Equipos: ${teams}`);
console.log(`Árbitros: ${referees}`);
console.log(`Canchas: ${courts}`);

if (leagues > 0) {
  console.log('\n--- LIGAS ---');
  const leaguesList = await League.find({}).select('nombre liga_id');
  leaguesList.forEach(l => console.log(`${l.liga_id}: ${l.nombre}`));
}

if (teams > 0) {
  console.log('\n--- EQUIPOS (primeros 5) ---');
  const teamsList = await Team.find({}).select('nombre liga_id').limit(5);
  teamsList.forEach(t => console.log(`${t.nombre} (Liga: ${t.liga_id})`));
}

if (referees > 0) {
  console.log('\n--- ÁRBITROS (primeros 5) ---');
  const refereesList = await Referee.find({}).select('nombre telefono liga_id').limit(5);
  refereesList.forEach(r => console.log(`${r.nombre} - ${r.telefono} (Liga: ${r.liga_id})`));
}

if (courts > 0) {
  console.log('\n--- CANCHAS (primeras 5) ---');
  const courtsList = await Court.find({}).select('nombre liga_id').limit(5);
  courtsList.forEach(c => console.log(`${c.nombre} (Liga: ${c.liga_id})`));
}

process.exit(0);


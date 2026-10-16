import { connect } from 'mongoose';
import { League } from './src/models/League.js';
import { Court } from './src/models/Court.js';
import { Team } from './src/models/Team.js';
import dotenv from 'dotenv';

dotenv.config();
await connect(process.env.MONGO_URI);

// Eliminar datos antiguos
await Team.deleteMany({});
await Court.deleteMany({});
await League.deleteMany({});

// Crear liga con todos los campos requeridos
const league = await League.create({
  slug: 'barrio-leagues-test',
  nombre: 'Barrio Leagues Test',
  jornada: 1,
  duracionPartido: 60,
  formatoTorneo: 'todos-vs-todos-una-vuelta',
  dueno: {
    nombre: 'Admin Barrio',
    contacto: '+5214494481016',
    email: 'admin@barrio-leagues.com'
  },
  status: 'activo',
});

console.log('✅ Liga creada:', league.nombre);

// Crear canchas
const courts = await Court.insertMany([
  { nombre: 'Cancha Central', liga_id: league._id, ubicacion: 'Centro' },
  { nombre: 'Cancha Norte', liga_id: league._id, ubicacion: 'Norte' },
  { nombre: 'Cancha Sur', liga_id: league._id, ubicacion: 'Sur' },
]);

console.log('✅ Canchas creadas:', courts.length);

// Crear equipos
const teams = await Team.insertMany([
  { 
    ligaId: league._id.toString(),
    nombre: 'Equipo A', 
    nombreCorto: 'EQUA',
    dt: {
      nombre: 'Coach A',
      whatsapp: '+5214498684666'
    },
    colorPrimario: '#FF0000',
    colorSecundario: '#FFFFFF'
  },
  { 
    ligaId: league._id.toString(),
    nombre: 'Equipo B', 
    nombreCorto: 'EQUB',
    dt: {
      nombre: 'Coach B',
      whatsapp: '+5214498684666'
    },
    colorPrimario: '#0000FF',
    colorSecundario: '#FFFFFF'
  },
  { 
    ligaId: league._id.toString(),
    nombre: 'Equipo C', 
    nombreCorto: 'EQUC',
    dt: {
      nombre: 'Coach C',
      whatsapp: '+5214498684666'
    },
    colorPrimario: '#00FF00',
    colorSecundario: '#FFFFFF'
  },
  { 
    ligaId: league._id.toString(),
    nombre: 'Equipo D', 
    nombreCorto: 'EQUD',
    dt: {
      nombre: 'Coach D',
      whatsapp: '+5214498684666'
    },
    colorPrimario: '#FFFF00',
    colorSecundario: '#000000'
  },
]);

console.log('✅ Equipos creados:', teams.length);

console.log('\n=== ESTRUCTURA RECREADA ===');
console.log(`Liga: ${league.nombre}`);
console.log(`ID Liga: ${league._id}`);
console.log(`Admin: ${league.dueno.nombre} - ${league.dueno.contacto}`);
console.log(`Canchas: ${courts.map(c => c.nombre).join(', ')}`);
console.log(`Equipos: ${teams.map(t => t.nombre).join(', ')}`);

process.exit(0);


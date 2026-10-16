import mongoose from 'mongoose';
import { Match } from './src/models/Match.js';

async function checkMatches() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/barrio-leagues');
    
    const total = await Match.countDocuments();
    console.log(`Total matches in database: ${total}`);
    
    // Get all liga_ids
    const ligas = await Match.collection.distinct('liga_id');
    console.log(`Ligas found: ${ligas}`);
    
    // Get some matches from any liga
    const matches = await Match.find().limit(5).lean();
    
    if (matches.length > 0) {
      console.log('\nSample matches:');
      matches.forEach((m, i) => {
        console.log(`  ${i+1}. ID: ${m.idPartido}, liga: ${m.liga_id}, fecha: ${m.fecha}, hora: ${m.hora}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkMatches();

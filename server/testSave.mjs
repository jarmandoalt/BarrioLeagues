import mongoose from 'mongoose';
import { Match } from './src/models/Match.js';

async function testSave() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/barrio-leagues');
    
    // Buscar un match que haya sido procesado
    const match = await Match.findOne().lean();
    
    if (!match) {
      console.log('No matches found');
      process.exit(0);
    }
    
    console.log(`Found match: ${match.idPartido}`);
    console.log(`Current referee_notified_at: ${match.referee_notified_at}`);
    
    // Update it manually
    const result = await Match.findByIdAndUpdate(
      match._id,
      { referee_notified_at: new Date() },
      { new: true }
    );
    
    console.log(`After update: ${result.referee_notified_at}`);
    
    // Read it back
    const verify = await Match.findById(match._id).lean();
    console.log(`Verify from DB: ${verify.referee_notified_at}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testSave();

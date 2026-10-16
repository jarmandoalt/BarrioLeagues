import mongoose from 'mongoose';

async function checkAll() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/barrio-leagues');
    const db = mongoose.connection.db;
    
    const total = await db.collection('matches').countDocuments();
    console.log(`Total matches (raw): ${total}`);
    
    const withTimestamp = await db.collection('matches').countDocuments({ 
      referee_notified_at: { $exists: true, $ne: null }
    });
    console.log(`Matches with referee_notified_at: ${withTimestamp}`);
    
    const sample = await db.collection('matches').findOne({ 
      referee_notified_at: { $exists: true, $ne: null }
    });
    
    if (sample) {
      console.log('\nSample match with timestamp:');
      console.log(`  ID: ${sample.idPartido}`);
      console.log(`  referee_notified_at: ${sample.referee_notified_at}`);
      console.log(`  referee_confirmed: ${sample.referee_confirmed}`);
      console.log(`  fecha: ${sample.fecha}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAll();

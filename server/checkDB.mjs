import mongoose from 'mongoose';

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/barrio-leagues');
    const db = mongoose.connection.db;
    
    // Check matches with referee_notified_at
    const matchesWithNotif = await db.collection('matches').find({ 
      liga_id: 'barrio_test',
      estado: 'programado',
      referee_notified_at: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`\nMatches with referee_notified_at: ${matchesWithNotif.length}`);
    if (matchesWithNotif.length > 0) {
      console.log('Sample:', {
        idPartido: matchesWithNotif[0].idPartido,
        referee_notified_at: matchesWithNotif[0].referee_notified_at,
        referee_confirmed: matchesWithNotif[0].referee_confirmed,
      });
    }
    
    // Check recent notification logs
    const logs = await db.collection('notificationlogs').find({
      test_mode: true,
      role: 'admin'
    }).sort({ created_at: -1 }).limit(5).toArray();
    
    console.log(`\nAdmin logs: ${logs.length}`);
    if (logs.length > 0) {
      console.log('Recent admin log:', logs[0].message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDB();

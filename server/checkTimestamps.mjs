import { connect } from 'mongoose';
import { Match } from './src/models/Match.js';
import dotenv from 'dotenv';

dotenv.config();
await connect(process.env.MONGO_URI);

const matches = await Match.find({ estado: 'programado' }).select('idPartido referee_notified_at referee_confirmed');
console.log('=== MATCHES ===');
matches.forEach(m => {
  const notifiedTime = m.referee_notified_at ? new Date(m.referee_notified_at).toISOString() : 'null';
  console.log(`${m.idPartido}: notified_at=${notifiedTime}, confirmed=${m.referee_confirmed}`);
});

const now = new Date();
console.log(`\nNow: ${now.toISOString()}`);
console.log(`8 minutes ago: ${new Date(now - 8 * 60 * 1000).toISOString()}`);

process.exit(0);


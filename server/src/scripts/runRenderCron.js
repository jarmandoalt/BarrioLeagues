import 'dotenv/config'
import mongoose from 'mongoose'
import { WhatsAppFlowTest } from '../models/WhatsAppFlowTest.js'
import { WhatsAppReceivedMessage } from '../models/WhatsAppReceivedMessage.js'
import { processDueWhatsAppFlowTests } from '../services/whatsappFlowTest.js'
import { runScheduleNotificationCycle } from '../services/scheduleNotificationCron.js'
import { runScheduledWhatsAppTest } from '../services/scheduledWhatsAppTest.js'

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI debe configurarse para ejecutar el Cron Job de Render.')
}

try {
  await mongoose.connect(process.env.MONGO_URI)
  await Promise.all([
    WhatsAppFlowTest.createIndexes(),
    WhatsAppReceivedMessage.createIndexes(),
  ])
  await processDueWhatsAppFlowTests()
  await runScheduleNotificationCycle()
  await runScheduledWhatsAppTest()
} finally {
  await mongoose.disconnect()
}

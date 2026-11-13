import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Match } from './models/Match.js'
import { NotificationLog } from './models/NotificationLog.js'
import { standingsRoutes } from './routes/standingsRoutes.js'
import { teamsRoutes } from './routes/teamsRoutes.js'
import { matchesRoutes } from './routes/matchesRoutes.js'
import { statsRoutes } from './routes/statsRoutes.js'
import { leaguesRoutes } from './routes/leaguesRoutes.js'
import { playersRoutes } from './routes/playersRoutes.js'
import { refereesRoutes } from './routes/refereesRoutes.js'
import { refereePortalRoutes } from './routes/refereePortalRoutes.js'
import { courtsRoutes } from './routes/courtsRoutes.js'
import { whatsappRoutes } from './routes/whatsappRoutes.js'
import { adminAuthRoutes } from './routes/adminAuthRoutes.js'
import { testRoutes } from './routes/testRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import { requireAdminAuth } from './services/adminAuth.js'
import { provisionLeagueAdminCredentials } from './services/leagueAdminProvisioning.js'
import { startScheduledWhatsAppTest } from './services/scheduledWhatsAppTest.js'
import { startScheduleNotificationCron } from './services/scheduleNotificationCron.js'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 5005
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean)

app.use(helmet())
app.disable('x-powered-by')
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, false)
    if (allowedOrigins.includes(origin)) return callback(null, origin)
    return callback(new Error('Origen no autorizado'))
  },
  credentials: true,
}))
app.use(express.json({
  verify(req, res, buffer) {
    req.rawBody = Buffer.from(buffer)
  },
}))
app.use(cookieParser())

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'BarrioLeagues API funcionando' })
})

app.use('/api', adminAuthRoutes)
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
  if (req.path === '/admin/login' || req.path === '/admin/logout') return next()
  if (req.path === '/webhook/button-response') return next()
  if (/^\/ligas\/[^/]+\/arbitros\/(?:verificar-partido|[^/]+\/reporte)$/.test(req.path)) return next()
  if (/^\/test\//.test(req.path)) return next()
  if (/^\/notifications\//.test(req.path)) return next()
  return requireAdminAuth(req, res, next)
})

app.use('/api', standingsRoutes)
app.use('/api', teamsRoutes)
app.use('/api', matchesRoutes)
app.use('/api', statsRoutes)
app.use('/api', leaguesRoutes)
app.use('/api', playersRoutes)
app.use('/api', refereesRoutes)
app.use('/api', refereePortalRoutes)
app.use('/api', courtsRoutes)
app.use('/api', whatsappRoutes)
app.use('/api', testRoutes)
app.use('/api', notificationRoutes)

const startServer = async () => {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI)
      await provisionLeagueAdminCredentials()
      await Match.createIndexes()
      const indexes = await Match.collection.indexes()
      const legacyGlobalIdIndex = indexes.find((index) => index.unique && Object.keys(index.key).length === 1 && index.key.idPartido === 1)
      if (legacyGlobalIdIndex) await Match.collection.dropIndex(legacyGlobalIdIndex.name)
      await NotificationLog.createIndexes()

      const oldCollectionExists = await mongoose.connection.db.listCollections({ name: 'notificationlogs' }).hasNext()
      if (oldCollectionExists) {
        const count = await mongoose.connection.db.collection('notifications_log').countDocuments()
        if (count === 0) {
          const oldDocs = await mongoose.connection.db.collection('notificationlogs').find().toArray()
          if (oldDocs.length > 0) {
            await mongoose.connection.db.collection('notifications_log').insertMany(oldDocs)
            console.log(`[DB] Migrados ${oldDocs.length} logs a la colección notifications_log`)
          }
        }
      }

      startScheduledWhatsAppTest()
      startScheduleNotificationCron()
      console.log('MongoDB conectado')
    } else {
      console.log('MONGO_URI no configurado. Ejecutando sin base de datos.')
    }

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Error al iniciar servidor:', error.message)
    process.exit(1)
  }
}

startServer()

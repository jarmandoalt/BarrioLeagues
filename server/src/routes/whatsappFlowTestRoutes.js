import { Router } from 'express'
import mongoose from 'mongoose'
import { WhatsAppFlowTest } from '../models/WhatsAppFlowTest.js'
import { requireAdminAuth, readAdminSession } from '../services/adminAuth.js'
import { getLatestWhatsAppFlowTest, startWhatsAppFlowTest } from '../services/whatsappFlowTest.js'

export const whatsappFlowTestRoutes = Router()

const requireSuperAdmin = (req, res, next) => {
  const session = req.admin || readAdminSession(req)
  const username = session?.sub || session?.username
  if (session?.role !== 'superadmin' || username !== process.env.ADMIN_USERNAME) {
    return res.status(403).json({ message: 'Solo el administrador principal puede iniciar esta prueba.' })
  }
  return next()
}

const ensureAdminSession = (req, res, next) => (
  req.admin ? next() : requireAdminAuth(req, res, next)
)

whatsappFlowTestRoutes.use('/admin/test/flujo-completo', ensureAdminSession, requireSuperAdmin)

whatsappFlowTestRoutes.post('/admin/test/flujo-completo', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'MongoDB no está conectado.' })
  }

  try {
    const activeFlow = await WhatsAppFlowTest.findOne({
      status: 'test',
      activeKey: 'whatsapp-admin-flow-test',
    }).select('_id workflowState dueAt')
    if (activeFlow) {
      return res.status(409).json({
        message: 'Ya hay un flujo de prueba activo.',
        flow: activeFlow,
      })
    }

    const flow = await startWhatsAppFlowTest()
    return res.status(202).json({
      flowId: flow._id,
      status: flow.status,
      workflowState: flow.workflowState,
      startedAt: flow.startedAt,
      dueAt: flow.dueAt,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya hay un flujo de prueba activo.' })
    }
    console.error('[WhatsApp Flow Test] No se pudo iniciar el flujo:', error.message)
    return res.status(502).json({ message: 'No se pudo enviar el mensaje inicial de prueba.' })
  }
})

whatsappFlowTestRoutes.get('/admin/test/flujo-completo', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'MongoDB no está conectado.' })
  }
  try {
    const flow = await getLatestWhatsAppFlowTest()
    return res.json({ flow })
  } catch (error) {
    console.error('[WhatsApp Flow Test] No se pudo consultar el estado:', error.message)
    return res.status(500).json({ message: 'No se pudo consultar el estado del flujo de prueba.' })
  }
})

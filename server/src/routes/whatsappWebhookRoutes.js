import { Router } from 'express'
import { WhatsAppReceivedMessage } from '../models/WhatsAppReceivedMessage.js'
import { getWhatsAppFlowResponse, getWhatsAppMessageText, recordWhatsAppFlowReply, getWhatsAppFlowTestConfig } from '../services/whatsappFlowTest.js'
import { verifyWhatsAppWebhookSignature } from '../services/whatsappWebhookSecurity.js'
import { normalizeWhatsAppPhone } from '../services/whatsappCloudService.js'
import { handleWhatsAppWebhookPost } from './whatsappRoutes.js'

export const whatsappWebhookRoutes = Router()

const verifyWebhook = (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (
    req.query['hub.mode'] !== 'subscribe'
    || !verifyToken
    || token !== verifyToken
    || typeof challenge !== 'string'
  ) {
    return res.sendStatus(403)
  }

  return res.type('text/plain').status(200).send(challenge)
}

whatsappWebhookRoutes.get('/webhook', verifyWebhook)

whatsappWebhookRoutes.post('/webhook', async (req, res) => {
  const signature = req.get('x-hub-signature-256')
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!verifyWhatsAppWebhookSignature(req.rawBody, signature, appSecret)) {
    console.warn('[WhatsApp Webhook] Firma ausente o inválida; se ignora el payload.')
    return res.sendStatus(401)
  }

  if (!Array.isArray(req.body?.entry)) return res.sendStatus(200)

  try {
    const messages = req.body.entry
      .flatMap((entry) => entry.changes || [])
      .flatMap((change) => change.value?.messages || [])
    req.whatsappFlowTestMessageIds = new Set()

    for (const message of messages) {
      if (typeof message.from !== 'string' || typeof message.id !== 'string') continue

      const receivedAt = /^\d+$/.test(message.timestamp || '')
        ? new Date(Number(message.timestamp) * 1000)
        : new Date()
      const text = getWhatsAppMessageText(message)
      const payload = message.type === 'button'
        ? message.button?.payload || ''
        : message.interactive?.button_reply?.id || ''
      const buttonText = message.type === 'button' ? message.button?.text || '' : ''
      const senderPhone = normalizeWhatsAppPhone(message.from)
      const response = getWhatsAppFlowResponse(message, buttonText || text)
      let receivedMessage

      try {
        receivedMessage = await WhatsAppReceivedMessage.create({
          messageId: message.id,
          from: message.from,
          text,
          payload,
          messageType: message.type || 'unknown',
          status: senderPhone === getWhatsAppFlowTestConfig().phoneNumber ? 'test' : 'received',
          receivedAt,
        })
      } catch (error) {
        if (error.code !== 11000) throw error
        receivedMessage = await WhatsAppReceivedMessage.findOne({ messageId: message.id })
      }
      if (!receivedMessage) throw new Error('No se pudo recuperar el mensaje recibido de WhatsApp.')

      const flow = await recordWhatsAppFlowReply({
        from: message.from,
        text,
        response,
        receivedAt,
      })
      if (senderPhone === getWhatsAppFlowTestConfig().phoneNumber && (flow || receivedMessage.flowTestId)) {
        req.whatsappFlowTestMessageIds.add(message.id)
      }
      if (flow && receivedMessage.flowTestId?.toString() !== flow._id.toString()) {
        await WhatsAppReceivedMessage.updateOne(
          { messageId: message.id },
          { $set: { flowTestId: flow._id } },
        )
        console.info(`[WhatsApp Flow Test] Respuesta recibida para prueba ${flow._id}: ${response}.`)
      }
    }

    return handleWhatsAppWebhookPost(req, res)
  } catch (error) {
    console.error('[WhatsApp Webhook] No se pudo guardar el mensaje recibido:', error.message)
    return res.sendStatus(500)
  }
})

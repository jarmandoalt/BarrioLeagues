import { WhatsAppFlowTest } from '../models/WhatsAppFlowTest.js'
import { normalizeWhatsAppPhone, sendWhatsAppText } from './whatsappCloudService.js'

const TEST_MODE = true
const TEST_NUMBER = '524494481016'
const FLOW_ACTIVE_KEY = 'whatsapp-admin-flow-test'
const RESPONSE_WINDOW_MS = 6 * 60 * 1000
const PROCESSING_LEASE_MS = 5 * 60 * 1000
const MAX_SEND_ATTEMPTS = 3
const RETRY_DELAY_MS = 60 * 1000

export const getWhatsAppFlowTestConfig = () => ({
  enabled: TEST_MODE,
  phoneNumber: normalizeWhatsAppPhone(TEST_NUMBER),
  responseWindowMs: RESPONSE_WINDOW_MS,
})

export const getWhatsAppMessageText = (message) => (
  message.text?.body
  || message.button?.text
  || message.interactive?.button_reply?.title
  || message.button?.payload
  || message.interactive?.button_reply?.id
  || ''
).trim()

const normalizeReply = (text) => text
  .toLocaleLowerCase('es-MX')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/[.!?,;:]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const getWhatsAppFlowResponse = (message, text = getWhatsAppMessageText(message)) => {
  const payload = message.button?.payload || message.interactive?.button_reply?.id || ''
  if (/^confirm_yes(?:_|$)/.test(payload)) return 'yes'
  if (/^confirm_no(?:_|$)/.test(payload)) return 'no'

  const normalized = normalizeReply(text)
  if (/^(si|si puedo asistir|confirmo|confirmo asistencia|asistire)$/.test(normalized)) return 'yes'
  if (/^(no|no puedo asistir|no asistire)$/.test(normalized)) return 'no'
  return 'other'
}

export const startWhatsAppFlowTest = async () => {
  if (!TEST_MODE) throw new Error('El flujo de prueba está deshabilitado.')

  const startedAt = new Date()
  const flow = await WhatsAppFlowTest.create({
    status: 'test',
    activeKey: FLOW_ACTIVE_KEY,
    phoneNumber: getWhatsAppFlowTestConfig().phoneNumber,
    workflowState: 'waiting_response',
    startedAt,
    dueAt: new Date(startedAt.getTime() + RESPONSE_WINDOW_MS),
  })

  try {
    const sent = await sendWhatsAppText({
      phoneNumber: flow.phoneNumber,
      message: '[PRUEBA - ARBITRO] Este es un mensaje real de prueba del flujo de BarrioLeagues. Responde SI o NO para registrar tu disponibilidad.',
    })
    await WhatsAppFlowTest.updateOne(
      { _id: flow._id },
      {
        $set: {
          refereeMessageId: sent.messageId,
          dueAt: new Date(Date.now() + RESPONSE_WINDOW_MS),
        },
      },
    )
    return flow
  } catch (error) {
    await WhatsAppFlowTest.updateOne(
      { _id: flow._id },
      {
        $set: { workflowState: 'failed', lastError: error.message },
        $unset: { activeKey: 1 },
      },
    )
    throw error
  }
}

export const recordWhatsAppFlowReply = async ({ from, text, response, receivedAt }) => {
  const normalizedPhone = normalizeWhatsAppPhone(from)
  if (normalizedPhone !== getWhatsAppFlowTestConfig().phoneNumber) return null

  const query = {
    status: 'test',
    activeKey: FLOW_ACTIVE_KEY,
    phoneNumber: normalizedPhone,
    startedAt: { $lte: receivedAt },
    dueAt: { $gte: receivedAt },
  }
  const flow = await WhatsAppFlowTest.findOneAndUpdate(
    {
      ...query,
      workflowState: 'waiting_response',
      responded: false,
    },
    {
      $set: {
        responded: true,
        response,
        responseText: text,
        responseReceivedAt: receivedAt,
      },
    },
    { new: true, sort: { startedAt: -1 } },
  )

  return flow || WhatsAppFlowTest.findOne(query).sort({ startedAt: -1 })
}

const claimDueFlowTest = (now) => WhatsAppFlowTest.findOneAndUpdate(
  {
    status: 'test',
    $or: [
      { workflowState: 'waiting_response', dueAt: { $lte: now } },
      { workflowState: 'retry', nextAttemptAt: { $lte: now } },
      { workflowState: 'processing', processingLeaseUntil: { $lte: now } },
    ],
  },
  {
    $set: {
      workflowState: 'processing',
      processingLeaseUntil: new Date(now.getTime() + PROCESSING_LEASE_MS),
    },
  },
  { new: true, sort: { dueAt: 1 } },
)

const finishFlowTest = async (flow) => {
  await WhatsAppFlowTest.updateOne(
    { _id: flow._id, workflowState: 'processing' },
    {
      $set: { workflowState: 'completed', completedAt: new Date() },
      $unset: { activeKey: 1, processingLeaseUntil: 1, nextAttemptAt: 1 },
    },
  )
}

const retryOrFailFlowTest = async (flow, error) => {
  const attemptCount = flow.attemptCount + 1
  const exhausted = attemptCount >= MAX_SEND_ATTEMPTS
  await WhatsAppFlowTest.updateOne(
    { _id: flow._id, workflowState: 'processing' },
    {
      $set: {
        attemptCount,
        lastError: error.message,
        workflowState: exhausted ? 'failed' : 'retry',
        ...(exhausted ? {} : { nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS) }),
      },
      $unset: {
        processingLeaseUntil: 1,
        ...(exhausted ? { activeKey: 1 } : {}),
      },
    },
  )
}

const processClaimedFlowTest = async (flow) => {
  if (flow.response === 'yes' && !flow.confirmationMessageId) {
    const sent = await sendWhatsAppText({
      phoneNumber: flow.phoneNumber,
      message: '[PRUEBA - CONFIRMACION] Se registró tu respuesta SÍ. Este mensaje confirma que recibimos tu disponibilidad.',
    })
    await WhatsAppFlowTest.updateOne(
      { _id: flow._id, workflowState: 'processing' },
      {
        $set: { confirmationMessageId: sent.messageId },
        $unset: { processingLeaseUntil: 1 },
      },
    )
    flow.confirmationMessageId = sent.messageId
  }

  if (!flow.adminMessageId) {
    const responseLabel = flow.response === 'yes'
      ? 'respondió SÍ'
      : flow.response === 'no'
        ? 'respondió NO'
        : flow.response === 'other'
          ? 'respondió un texto distinto de SÍ/NO'
          : 'no respondió durante los 6 minutos'
    const sent = await sendWhatsAppText({
      phoneNumber: flow.phoneNumber,
      message: `[PRUEBA - ADMIN] Resumen del flujo: el árbitro ${responseLabel}. Prueba ${flow._id}.`,
    })
    await WhatsAppFlowTest.updateOne(
      { _id: flow._id, workflowState: 'processing' },
      { $set: { adminMessageId: sent.messageId } },
    )
  }

  await finishFlowTest(flow)
}

export const processDueWhatsAppFlowTests = async (now = new Date()) => {
  let processed = 0
  let flow = await claimDueFlowTest(now)
  while (flow) {
    try {
      await processClaimedFlowTest(flow)
      processed += 1
    } catch (error) {
      console.error(`[WhatsApp Flow Test] No se pudo completar ${flow._id}: ${error.message}`)
      await retryOrFailFlowTest(flow, error)
    }
    flow = await claimDueFlowTest(now)
  }
  return processed
}

export const getLatestWhatsAppFlowTest = () => WhatsAppFlowTest.findOne({ status: 'test' })
  .sort({ startedAt: -1 })
  .select('workflowState startedAt dueAt responded response responseReceivedAt completedAt lastError')
  .lean()

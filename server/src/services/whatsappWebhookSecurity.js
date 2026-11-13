import { createHmac, timingSafeEqual } from 'node:crypto'

export const verifyWhatsAppWebhookSignature = (rawBody, signature, appSecret) => {
  if (!Buffer.isBuffer(rawBody) || !signature || !appSecret) return false
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) return false

  const expected = createHmac('sha256', appSecret).update(rawBody).digest()
  const received = Buffer.from(signature.slice('sha256='.length), 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

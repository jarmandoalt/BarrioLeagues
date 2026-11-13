import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { verifyWhatsAppWebhookSignature } from './whatsappWebhookSecurity.js'

test('verifyWhatsAppWebhookSignature accepts the matching Meta signature', () => {
  const rawBody = Buffer.from('{"entry":[]}')
  const appSecret = 'test-app-secret'
  const signature = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`

  assert.equal(verifyWhatsAppWebhookSignature(rawBody, signature, appSecret), true)
})

test('verifyWhatsAppWebhookSignature rejects malformed or mismatched signatures', () => {
  const rawBody = Buffer.from('{"entry":[]}')

  assert.equal(verifyWhatsAppWebhookSignature(rawBody, 'invalid', 'test-app-secret'), false)
  assert.equal(verifyWhatsAppWebhookSignature(rawBody, `sha256=${'0'.repeat(64)}`, 'test-app-secret'), false)
  assert.equal(verifyWhatsAppWebhookSignature('{"entry":[]}', `sha256=${'0'.repeat(64)}`, 'test-app-secret'), false)
})

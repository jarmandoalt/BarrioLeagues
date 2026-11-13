import assert from 'node:assert/strict'
import test from 'node:test'
import { getWhatsAppButtonReply, getWhatsAppTextReply, getWhatsAppTrialButtonResponse } from './whatsappWebhookPayload.js'

test('getWhatsAppButtonReply reads template quick-reply button payloads', () => {
  const button = { payload: 'confirm_yes_trial-id', text: 'Sí asistiré' }
  assert.equal(getWhatsAppButtonReply({ type: 'button', button }), button)
})

test('getWhatsAppButtonReply keeps interactive button reply support', () => {
  const buttonReply = { payload: 'confirm_no_match-id', title: 'No asistiré' }
  assert.equal(getWhatsAppButtonReply({ type: 'interactive', interactive: { button_reply: buttonReply } }), buttonReply)
})

test('getWhatsAppButtonReply ignores other WhatsApp message types', () => {
  assert.equal(getWhatsAppButtonReply({ type: 'text', text: { body: 'Hola' } }), null)
})

test('getWhatsAppTrialButtonResponse recognizes trial payloads and button text', () => {
  assert.equal(getWhatsAppTrialButtonResponse({
    type: 'button',
    button: { payload: 'confirm_yes_trial-id', text: 'Sí asistiré' },
  }), 'yes')
  assert.equal(getWhatsAppTrialButtonResponse({
    type: 'button',
    button: { payload: 'confirm_no_trial-id', text: 'No asistiré' },
  }), 'no')
  assert.equal(getWhatsAppTrialButtonResponse({
    type: 'button',
    button: { text: 'Si puedo asistir' },
  }), 'yes')
  assert.equal(getWhatsAppTrialButtonResponse({
    type: 'button',
    button: { text: 'Sí puedo asistir' },
  }), 'yes')
  assert.equal(getWhatsAppTrialButtonResponse({
    type: 'button',
    button: { text: 'Quizá pueda asistir' },
  }), null)
})

test('getWhatsAppTextReply normalizes yes and no responses with optional role and match ID', () => {
  assert.deepEqual(getWhatsAppTextReply({ type: 'text', text: { body: 'Sí puedo asistir' } }), {
    response: 'yes',
    role: null,
    matchId: null,
  })
  assert.deepEqual(getWhatsAppTextReply({ type: 'text', text: { body: 'CAPITÁN NO 000123' } }), {
    response: 'no',
    role: 'capitan',
    matchId: '000123',
  })
  assert.deepEqual(getWhatsAppTextReply({ type: 'text', text: { body: 'ARBITRO SI 123456' } }), {
    response: 'yes',
    role: 'arbitro',
    matchId: '123456',
  })
})

test('getWhatsAppTextReply ignores unrecognized text and non-text messages', () => {
  assert.equal(getWhatsAppTextReply({ type: 'text', text: { body: 'Hola, nos vemos' } }), null)
  assert.equal(getWhatsAppTextReply({ type: 'interactive', interactive: { button_reply: {} } }), null)
})

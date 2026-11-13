import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getWhatsAppFlowResponse,
  getWhatsAppFlowTestConfig,
  getWhatsAppMessageText,
} from './whatsappFlowTest.js'

test('flow-test messages are fixed to the test recipient', () => {
  assert.deepEqual(getWhatsAppFlowTestConfig(), {
    enabled: true,
    phoneNumber: '5214494481016',
    responseWindowMs: 6 * 60 * 1000,
  })
})

test('webhook extracts text and recognizes yes/no text or quick replies', () => {
  assert.equal(getWhatsAppMessageText({ type: 'text', text: { body: 'Sí puedo asistir' } }), 'Sí puedo asistir')
  assert.equal(getWhatsAppFlowResponse({ type: 'text', text: { body: 'Sí' } }), 'yes')
  assert.equal(getWhatsAppFlowResponse({ type: 'text', text: { body: 'NO puedo asistir' } }), 'no')
  assert.equal(getWhatsAppFlowResponse({
    type: 'interactive',
    interactive: { button_reply: { id: 'confirm_yes_test', title: 'Sí' } },
  }), 'yes')
  assert.equal(getWhatsAppFlowResponse({
    type: 'button',
    button: { payload: 'confirm_no_test', text: 'No' },
  }), 'no')
  assert.equal(getWhatsAppFlowResponse({
    type: 'button',
    button: { payload: 'confirm_yes_trial-123', text: 'Sí' },
  }), 'yes')
  assert.equal(getWhatsAppFlowResponse({
    type: 'button',
    button: { text: 'Si puedo asistir' },
  }), 'yes')
  assert.equal(getWhatsAppFlowResponse({ type: 'text', text: { body: 'Tal vez' } }), 'other')
})

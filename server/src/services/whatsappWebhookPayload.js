export const getWhatsAppButtonReply = (messageData) => (
  messageData.interactive?.button_reply
  || (messageData.type === 'button' ? messageData.button : null)
)

const normalizeWhatsAppReplyText = (text) => text
  .trim()
  .toLocaleLowerCase('es-MX')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/[.!?,;:]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const getWhatsAppTrialButtonResponse = (messageData) => {
  if (messageData.type !== 'button') return null

  const { payload, text } = messageData.button || {}
  const payloadMatch = typeof payload === 'string'
    ? payload.match(/^confirm_(yes|no)_trial(?:-|$)/)
    : null
  if (payloadMatch) return payloadMatch[1]

  if (typeof text !== 'string') return null
  return normalizeWhatsAppReplyText(text) === 'si puedo asistir' ? 'yes' : null
}

export const getWhatsAppTextReply = (messageData) => {
  if (messageData.type !== 'text' || typeof messageData.text?.body !== 'string') return null

  const body = normalizeWhatsAppReplyText(messageData.text.body)

  const roleMatch = body.match(/^(arbitro|capitan)\s+(.+)$/)
  const role = roleMatch?.[1] === 'arbitro' ? 'arbitro' : roleMatch ? 'capitan' : null
  const answer = roleMatch ? roleMatch[2] : body
  const answerMatch = answer.match(/^(si(?: puedo asistir)?|confirmo(?: asistencia)?|asistire|no(?: puedo asistir)?|no asistire)(?:\s+(\d{6}))?$/)
  if (!answerMatch) return null

  return {
    response: answerMatch[1].startsWith('no') ? 'no' : 'yes',
    role,
    matchId: answerMatch[2] || null,
  }
}

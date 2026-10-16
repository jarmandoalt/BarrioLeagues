const phoneCharactersPattern = /^[+\d\s().-]+$/

export const normalizeContactPhone = (phoneNumber) => {
  const value = String(phoneNumber ?? '').trim()
  if (!value || !phoneCharactersPattern.test(value)) return value

  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return `521${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return `521${digits.slice(2)}`
  return digits
}
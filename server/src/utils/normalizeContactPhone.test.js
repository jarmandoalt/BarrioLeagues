import assert from 'node:assert/strict'
import test from 'node:test'
import { League } from '../models/League.js'
import { Referee } from '../models/Referee.js'
import { Team } from '../models/Team.js'
import { normalizeContactPhone } from './normalizeContactPhone.js'

test('agrega 521 a un teléfono mexicano de diez dígitos', () => {
  assert.equal(normalizeContactPhone('4494481016'), '5214494481016')
})

test('normaliza formatos mexicanos con separadores o prefijo 52', () => {
  assert.equal(normalizeContactPhone('+52 (449) 448-1016'), '5214494481016')
  assert.equal(normalizeContactPhone('52 449 448 1016'), '5214494481016')
})

test('conserva un número que ya tiene el prefijo 521', () => {
  assert.equal(normalizeContactPhone('5214494481016'), '5214494481016')
})

test('no modifica contactos que no son números telefónicos', () => {
  assert.equal(normalizeContactPhone('contacto@liga.mx'), 'contacto@liga.mx')
  assert.equal(normalizeContactPhone(''), '')
})

test('aplica el prefijo al guardar contactos de equipo, árbitro y liga', () => {
  const team = new Team({ dt: { nombre: 'DT', whatsapp: '4494481016' } })
  const referee = new Referee({ telefono: '449-448-1016' })
  const league = new League({ dueno: { contacto: '(449) 448 1016' } })

  assert.equal(team.dt.whatsapp, '5214494481016')
  assert.equal(referee.telefono, '5214494481016')
  assert.equal(league.dueno.contacto, '5214494481016')
})
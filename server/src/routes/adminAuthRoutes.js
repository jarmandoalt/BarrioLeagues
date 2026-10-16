import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { League } from '../models/League.js'
import { LeagueAdminCredential } from '../models/LeagueAdminCredential.js'
import {
  adminCookieName,
  getAdminCookieOptions,
  isAdminAuthConfigured,
  isTrustedOrigin,
  readAdminSession,
  requireTrustedOrigin,
} from '../services/adminAuth.js'

export const adminAuthRoutes = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
})
const leagueAdminResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Intenta más tarde.' },
})

const issueSession = (res, claims) => {
  const token = jwt.sign(claims, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'barrioleagues',
    audience: 'barrioleagues-admin',
    expiresIn: process.env.ADMIN_SESSION_TTL || '8h',
  })
  res.cookie(adminCookieName, token, getAdminCookieOptions())
}

const isValidNewPassword = (password) => typeof password === 'string' && password.length >= 8 && password.length <= 1024

adminAuthRoutes.get('/admin/session', async (req, res) => {
  const session = readAdminSession(req)
  const authenticated = Boolean(session && (
    (session.role === 'superadmin' && session.sub === process.env.ADMIN_USERNAME)
    || (session.role === 'league-admin' && session.leagueSlug === session.sub)
  ))
  let mustChangePassword = authenticated && Boolean(session.mustChangePassword)
  if (authenticated && session.role === 'league-admin') {
    const credential = await LeagueAdminCredential.findOne({ leagueSlug: session.leagueSlug }).select('mustChangePassword')
    mustChangePassword = !credential || credential.mustChangePassword
  }
  return res.json({
    configured: isAdminAuthConfigured(),
    authenticated,
    role: authenticated ? session.role : null,
    leagueSlug: authenticated ? session.leagueSlug || null : null,
    mustChangePassword,
  })
})

adminAuthRoutes.post('/admin/login', loginLimiter, requireTrustedOrigin, async (req, res) => {
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({ message: 'El acceso administrativo no está configurado. Ejecuta npm run admin:setup en el servidor.' })
  }

  const { username, password } = req.body || {}
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) {
    return res.status(400).json({ message: 'Usuario o contraseña inválidos' })
  }

  const passwordMatches = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)
  if (username !== process.env.ADMIN_USERNAME || !passwordMatches) {
    return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })
  }

  issueSession(res, { sub: process.env.ADMIN_USERNAME, role: 'superadmin' })
  return res.json({ authenticated: true })
})

adminAuthRoutes.post('/ligas/:slug/admin/login', loginLimiter, requireTrustedOrigin, async (req, res) => {
  const slug = req.params.slug.toLowerCase()
  const { username, password } = req.body || {}
  if (username !== slug || typeof password !== 'string' || password.length > 1024) {
    return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })
  }

  const credential = await LeagueAdminCredential.findOne({ leagueSlug: slug }).select('+passwordHash')
  if (!credential) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })
  const passwordMatches = await bcrypt.compare(password, credential.passwordHash)
  if (!passwordMatches) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })

  issueSession(res, {
    sub: slug,
    role: 'league-admin',
    leagueSlug: slug,
    mustChangePassword: credential.mustChangePassword,
  })
  return res.json({ authenticated: true, mustChangePassword: credential.mustChangePassword })
})

adminAuthRoutes.post('/ligas/:slug/admin/password', requireTrustedOrigin, async (req, res) => {
  const slug = req.params.slug.toLowerCase()
  const session = readAdminSession(req)
  if (!session || session.role !== 'league-admin' || session.leagueSlug !== slug) {
    return res.status(401).json({ message: 'Inicia sesión en esta liga para cambiar la contraseña' })
  }

  const { password } = req.body || {}
  if (!isValidNewPassword(password)) {
    return res.status(400).json({ message: 'La contraseña debe tener entre 8 y 1024 caracteres' })
  }
  if (password.toLowerCase() === slug) {
    return res.status(400).json({ message: 'La contraseña nueva debe ser distinta al usuario de la liga' })
  }

  const credential = await LeagueAdminCredential.findOne({ leagueSlug: slug }).select('+passwordHash')
  if (!credential) return res.status(404).json({ message: 'Cuenta de liga no encontrada' })

  credential.passwordHash = await bcrypt.hash(password, 12)
  credential.mustChangePassword = false
  await credential.save()

  issueSession(res, { sub: slug, role: 'league-admin', leagueSlug: slug, mustChangePassword: false })
  return res.json({ passwordChanged: true })
})

adminAuthRoutes.post('/admin/ligas/:slug/reset-password', leagueAdminResetLimiter, requireTrustedOrigin, async (req, res) => {
  const session = readAdminSession(req)
  if (!session || session.role !== 'superadmin' || session.sub !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({ message: 'Solo el administrador general puede resetear contraseñas de liga' })
  }

  const slug = req.params.slug.toLowerCase()
  const { slugConfirmation, adminPassword } = req.body || {}
  if (slugConfirmation !== slug) {
    return res.status(400).json({ message: 'El slug de confirmación no coincide' })
  }
  if (typeof adminPassword !== 'string' || adminPassword.length > 1024) {
    return res.status(400).json({ message: 'Debes confirmar la contraseña del administrador general' })
  }
  if (!isAdminAuthConfigured() || !await bcrypt.compare(adminPassword, process.env.ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ message: 'La contraseña del administrador general es incorrecta' })
  }

  const [league, credential] = await Promise.all([
    League.findOne({ slug }).select('_id'),
    LeagueAdminCredential.findOne({ leagueSlug: slug }).select('+passwordHash'),
  ])
  if (!league || !credential) return res.status(404).json({ message: 'No se encontró la cuenta de esa liga' })

  credential.passwordHash = await bcrypt.hash(slug, 12)
  credential.mustChangePassword = true
  await credential.save()
  return res.json({ reset: true, username: slug, mustChangePassword: true })
})

adminAuthRoutes.post('/admin/logout', requireTrustedOrigin, (req, res) => {
  res.clearCookie(adminCookieName, getAdminCookieOptions())
  return res.status(204).end()
})

adminAuthRoutes.get('/ligas/:slug/admin-contact', async (req, res) => {
  const slug = req.params.slug.toLowerCase()
  const session = readAdminSession(req)
  const isSuperAdmin = session?.role === 'superadmin' && session.sub === process.env.ADMIN_USERNAME
  const isThisLeagueAdmin = session?.role === 'league-admin' && session.leagueSlug === slug
  if (!isSuperAdmin && !isThisLeagueAdmin) {
    return res.status(401).json({ message: 'Inicia sesión con permisos para esta liga' })
  }

  const league = await League.findOne({ slug }).select('dueno.email').lean()
  if (!league) return res.status(404).json({ message: 'Liga no encontrada' })
  return res.json({ email: league.dueno?.email || '' })
})
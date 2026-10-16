import jwt from 'jsonwebtoken'
import { Team } from '../models/Team.js'
import { LeagueAdminCredential } from '../models/LeagueAdminCredential.js'

export const adminCookieName = 'bl_admin_session'

const getAllowedOrigins = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const isAdminAuthConfigured = () => Boolean(
  process.env.ADMIN_USERNAME
  && process.env.ADMIN_PASSWORD_HASH
  && process.env.JWT_SECRET
  && Buffer.byteLength(process.env.JWT_SECRET) >= 32,
)

export const isTrustedOrigin = (origin) => Boolean(origin && getAllowedOrigins().includes(origin))

export const getAdminCookieOptions = () => {
  const sameSite = process.env.ADMIN_COOKIE_SAME_SITE === 'none' ? 'none' : 'lax'
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.ADMIN_COOKIE_SECURE === 'true' || sameSite === 'none',
    sameSite,
    path: '/',
  }
}

export const requireTrustedOrigin = (req, res, next) => {
  if (!isTrustedOrigin(req.get('origin'))) {
    return res.status(403).json({ message: 'Origen no autorizado' })
  }
  return next()
}

export const readAdminSession = (req) => {
  if (!isAdminAuthConfigured()) return null
  const token = req.cookies?.[adminCookieName]
  if (!token) return null

  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'barrioleagues',
      audience: 'barrioleagues-admin',
    })
  } catch {
    return null
  }
}

export const requireAdminAuth = async (req, res, next) => {
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({ message: 'El acceso administrativo no está configurado en el servidor' })
  }

  const session = readAdminSession(req)
  if (!session) {
    return res.status(401).json({ message: 'Inicia sesión para modificar los datos' })
  }

  if (!isTrustedOrigin(req.get('origin'))) {
    return res.status(403).json({ message: 'Origen no autorizado' })
  }
  if (session.role === 'superadmin' && session.sub === process.env.ADMIN_USERNAME) {
    req.admin = { username: session.sub, role: session.role }
    return next()
  }

  if (session.role !== 'league-admin' || !session.leagueSlug || session.mustChangePassword) {
    return res.status(403).json({ message: 'Esta cuenta no puede modificar datos hasta completar el cambio de contraseña' })
  }

  const credential = await LeagueAdminCredential.findOne({ leagueSlug: session.leagueSlug }).select('mustChangePassword')
  if (!credential || credential.mustChangePassword) {
    return res.status(403).json({ message: 'Debes iniciar sesión y cambiar la contraseña antes de continuar' })
  }

  // Este middleware es global: req.params no incluye el slug, hay que leerlo de la ruta.
  const leaguePathSlug = req.path.match(/^\/ligas\/([^/]+)/)?.[1]
  let targetLeagueSlug = leaguePathSlug || req.body?.liga_id || req.body?.ligaId
  if (!targetLeagueSlug && req.path.startsWith('/jugadores') && req.body?.equipo_id) {
    const team = await Team.findById(req.body.equipo_id).select('ligaId')
    targetLeagueSlug = team?.ligaId
  }

  if (!targetLeagueSlug || targetLeagueSlug.toLowerCase() !== session.leagueSlug) {
    return res.status(403).json({ message: 'Tu cuenta solo puede modificar datos de su propia liga' })
  }

  req.admin = { username: session.sub, role: session.role, leagueSlug: session.leagueSlug }
  return next()
}
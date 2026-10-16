import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const envPath = path.join(serverDirectory, '.env')
let envText = await readFile(envPath, 'utf8')

const readHidden = (prompt) => new Promise((resolve, reject) => {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    reject(new Error('Ejecuta este asistente en una terminal interactiva.'))
    return
  }

  process.stdout.write(prompt)
  let value = ''
  process.stdin.setRawMode(true)
  process.stdin.resume()

  const cleanup = () => {
    process.stdin.off('data', onData)
    process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdout.write('\n')
  }

  const onData = (chunk) => {
    for (const character of chunk.toString('utf8')) {
      if (character === '\u0003') {
        cleanup()
        reject(new Error('Configuración cancelada.'))
        return
      }
      if (character === '\r' || character === '\n') {
        cleanup()
        resolve(value)
        return
      }
      if (character === '\u007f' || character === '\b') {
        value = value.slice(0, -1)
        continue
      }
      if (character >= ' ') value += character
    }
  }

  process.stdin.on('data', onData)
})

const existingUsername = envText.match(/^ADMIN_USERNAME=(.*)$/m)?.[1]?.trim()
const username = process.argv[2] || existingUsername || 'admin'
if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
  throw new Error('El usuario debe tener entre 3 y 50 caracteres alfanuméricos, punto, guion o guion bajo.')
}

const password = await readHidden('Nueva contraseña (mínimo 8 caracteres): ')
if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
const confirmation = await readHidden('Repite la contraseña: ')
if (password !== confirmation) throw new Error('Las contraseñas no coinciden.')

const passwordHash = await bcrypt.hash(password, 12)
const jwtSecret = randomBytes(64).toString('hex')
envText = envText.replace(/^WHATSAPP_ADMIN_KEY=.*(?:\r?\n|$)/m, '')

const values = {
  ADMIN_USERNAME: username,
  ADMIN_PASSWORD_HASH: passwordHash,
  JWT_SECRET: jwtSecret,
}

for (const [key, value] of Object.entries(values)) {
  const linePattern = new RegExp(`^${key}=.*$`, 'm')
  if (linePattern.test(envText)) envText = envText.replace(linePattern, `${key}=${value}`)
  else envText = `${envText.trimEnd()}\n${key}=${value}\n`
}

const defaults = {
  ADMIN_SESSION_TTL: '8h',
  CLIENT_ORIGIN: 'http://localhost:5173',
  ADMIN_COOKIE_SAME_SITE: 'lax',
}

for (const [key, value] of Object.entries(defaults)) {
  if (!new RegExp(`^${key}=.+$`, 'm').test(envText)) {
    const linePattern = new RegExp(`^${key}=.*$`, 'm')
    if (linePattern.test(envText)) envText = envText.replace(linePattern, `${key}=${value}`)
    else envText = `${envText.trimEnd()}\n${key}=${value}\n`
  }
}

await writeFile(envPath, envText)
console.info(`Acceso administrativo configurado para "${username}". Reinicia el servidor para aplicarlo.`)
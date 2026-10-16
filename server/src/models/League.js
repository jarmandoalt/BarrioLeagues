import mongoose from 'mongoose'
import { normalizeContactPhone } from '../utils/normalizeContactPhone.js'

const leagueSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    nombre: { type: String, required: true, trim: true },
    jornada: { type: Number, required: true, min: 0, default: 1 },
    duracionPartido: { type: Number, min: 10, max: 240, default: 60, validate: { validator: Number.isInteger, message: 'La duración debe ser un número entero de minutos' } },
    formatoTorneo: { type: String, enum: ['todos-vs-todos-una-vuelta', 'todos-vs-todos-ida-y-vuelta'], default: 'todos-vs-todos-una-vuelta' },
    actualizacionJornada: {
      type: String,
      enum: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
      default: 'lunes',
    },
    avisoPartidosDia: {
      type: String,
      enum: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
      default: 'lunes',
    },
    avisoPartidosHora: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora del aviso debe tener formato HH:mm'], default: '09:00' },
    avisoPartidosUltimoEnvio: { type: String, select: false, default: '' },
    dueno: {
      nombre: { type: String, required: true, trim: true },
      contacto: { type: String, required: true, trim: true, set: normalizeContactPhone },
      email: { type: String, lowercase: true, trim: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El correo electrónico no es válido'] },
    },
    status: {
      type: String,
      enum: ['activo', 'inactivo'],
      default: 'activo',
    },
    branding: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(document, result) {
        delete result.dueno?.email
        return result
      },
    },
  },
)

export const League = mongoose.model('League', leagueSchema)

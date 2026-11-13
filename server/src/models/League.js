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
    calendarRevision: { type: Number, min: 0, default: 0 },
    nombre: { type: String, required: true, trim: true },
    jornada: { type: Number, required: true, min: 0, default: 1 },
    duracionPartido: { type: Number, min: 10, max: 240, default: 60, validate: { validator: Number.isInteger, message: 'La duración debe ser un número entero de minutos' } },
    formatoTorneo: {
      type: String,
      enum: [
        'LIGA_IDA_VUELTA',
        'LIGA_UNA_VUELTA',
        'LIGA_IDA_VUELTA_CON_LIGUILLA_8',
        'LIGA_UNA_VUELTA_CON_LIGUILLA_8',
        'todos-vs-todos-una-vuelta',
        'todos-vs-todos-ida-y-vuelta',
      ],
      default: 'LIGA_UNA_VUELTA',
    },
    config: {
      formatoLiga: { type: String, enum: ['TIPO_1', 'TIPO_2', 'TIPO_3', 'TIPO_4'] },
      diasJuego: [{ type: String, enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] }],
      cambioDeJornada: { type: String, enum: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'cada_lunes', 'al_terminar_partidos'] },
      diaEntregaInfo: {
        dia: { type: String, enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] },
        hora: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      },
      fechaInicioLiga: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
      tipoInicioLiga: { type: String, enum: ['desde_cero', 'liga_ya_empezada'], default: 'desde_cero' },
      pasoWizard: { type: Number, min: 1, max: 5, default: 1 },
      fechasJornadas: [{ jornada: { type: Number, min: 1 }, fecha: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ } }],
    },
    estado: { type: String, enum: ['configuracion', 'activa'], default: 'configuracion' },
    wizardCompletado: { type: Boolean, default: false },
    fechaProgramada: { type: Date },
    liguillaSeeds: {
      type: [{ equipoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, posicion: Number }],
      default: undefined,
    },
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

import mongoose from 'mongoose'

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const scheduleSchema = new mongoose.Schema(
  {
    dia: { type: String, required: true, enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] },
    horaInicio: { type: String, required: true, match: [timePattern, 'La hora de inicio debe tener formato HH:mm'] },
  },
  { _id: false },
)

const courtSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    liga_id: { type: String, required: true, lowercase: true, trim: true, index: true },
    estado: { type: String, enum: ['activa', 'inactiva'], default: 'activa' },
    horarios: { type: [scheduleSchema], default: [] },
  },
  { timestamps: true },
)

export const Court = mongoose.model('Court', courtSchema)

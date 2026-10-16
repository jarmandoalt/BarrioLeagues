import mongoose from 'mongoose'
import { normalizeContactPhone } from '../utils/normalizeContactPhone.js'

const refereeSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    telefono: { type: String, required: true, trim: true, set: normalizeContactPhone },
    liga_id: { type: String, required: true, lowercase: true, trim: true, index: true },
    estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
  },
  { timestamps: true },
)

export const Referee = mongoose.model('Referee', refereeSchema)

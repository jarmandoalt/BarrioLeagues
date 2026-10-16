import mongoose from 'mongoose'

const playerSchema = new mongoose.Schema(
  {
    equipo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    numero: { type: Number, required: true, min: 1, max: 99 },
    nombre_corto: { type: String, required: true, trim: true },
    nombre_completo: { type: String, required: true, trim: true },
    posicion: { type: String, required: true, trim: true },
    foto_url: { type: String, trim: true, default: '' },
    estado: { type: String, enum: ['activo', 'suspendido'], default: 'activo' },
  },
  { timestamps: true },
)

playerSchema.index({ equipo_id: 1, numero: 1 }, { unique: true })

export const Player = mongoose.model('Player', playerSchema)

import mongoose from 'mongoose'
import { normalizeContactPhone } from '../utils/normalizeContactPhone.js'

const coachSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, trim: true, set: normalizeContactPhone },
  },
  { _id: false },
)

const statsSchema = new mongoose.Schema(
  {
    pj: { type: Number, default: 0, min: 0 },
    pg: { type: Number, default: 0, min: 0 },
    pe: { type: Number, default: 0, min: 0 },
    pp: { type: Number, default: 0, min: 0 },
    gf: { type: Number, default: 0, min: 0 },
    gc: { type: Number, default: 0, min: 0 },
    dg: { type: Number, default: 0 },
    pts: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
)

const teamSchema = new mongoose.Schema(
  {
    ligaId: { type: String, required: true, lowercase: true, trim: true, index: true },
    nombre: { type: String, required: true, trim: true },
    nombreCorto: { type: String, required: true, uppercase: true, trim: true, maxlength: 5 },
    dt: { type: coachSchema, required: true },
    colorPrimario: { type: String, trim: true, default: '#1f6feb', match: /^#[0-9a-fA-F]{6}$/ },
    colorSecundario: { type: String, trim: true, default: '#ffffff', match: /^#[0-9a-fA-F]{6}$/ },
    imagen: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: (value) => !value || /^https?:\/\/\S+$/i.test(value),
        message: 'La imagen debe ser una URL válida (http o https)',
      },
    },
    stats: { type: statsSchema, default: () => ({}) },
    racha: {
      type: [String],
      default: [],
      validate: {
        validator: (streak) => streak.every((result) => ['G', 'E', 'P'].includes(result)),
        message: 'La racha solo puede contener G, E o P',
      },
    },
  },
  { timestamps: true },
)

teamSchema.pre('validate', function calculateStats(next) {
  this.stats.dg = this.stats.gf - this.stats.gc
  this.stats.pts = (this.stats.pg * 3) + this.stats.pe
  next()
})

export const Team = mongoose.model('Team', teamSchema)

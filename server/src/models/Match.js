import mongoose from 'mongoose'

const matchSchema = new mongoose.Schema(
  {
    idPartido: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{6}$/, 'El ID del partido debe tener exactamente seis dígitos'],
    },
    liga_id: { type: String, required: true, lowercase: true, trim: true, index: true },
    equipoLocal_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    equipoVisitante_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    arbitro_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Referee' },
    cancha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Court' },
    jornada: { type: Number, required: true, min: 1 },
    fecha: { type: Date },
    hora: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm'] },
    marcadorLocal: { type: Number, default: 0, min: 0 },
    marcadorVisitante: { type: Number, default: 0, min: 0 },
    estado: {
      type: String,
      enum: ['programado', 'en_curso', 'finalizado', 'suspendido'],
      default: 'programado',
    },
    // Campos para el sistema de notificaciones
    referee_notified_at: { type: Date },
    referee_confirmed: { type: Boolean, default: false },
    referee_confirmed_at: { type: Date },
    captains_notified_at: { type: Date },
    admin_notified_at: { type: Date },
    // Estado de confirmación del árbitro: 'pendiente', 'confirmado', 'rechazado'
    confirmado_arbitro: { type: String, enum: ['pendiente', 'confirmado', 'rechazado'], default: 'pendiente' },
    arbitro_estado_confirmacion: {
      type: String,
      enum: ['pendiente', 'confirmado', 'rechazado', 'sin_respuesta'],
      default: 'pendiente',
    },
    arbitro_motivo_rechazo: { type: String, trim: true },
    arbitro_fecha_respuesta: { type: Date },
    requiere_reasignacion: { type: Boolean, default: false },
    eventos: [{
      equipo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
      tipo: { type: String, enum: ['GOL', 'TA', 'TR'], required: true },
      jugador_numero: { type: Number, required: true, min: 1, max: 99 },
      minuto: { type: Number, required: true, min: 0, max: 120 },
    }],
  },
  { timestamps: true },
)

matchSchema.index({ liga_id: 1, idPartido: 1 }, { unique: true })
matchSchema.index({ referee_notified_at: 1, referee_confirmed: 1 })
matchSchema.index({ fecha: 1, estado: 1 })

matchSchema.pre('validate', function validateTeams(next) {
  if (this.equipoLocal_id && this.equipoVisitante_id && this.equipoLocal_id.equals(this.equipoVisitante_id)) {
    this.invalidate('equipoVisitante_id', 'El equipo visitante debe ser diferente al local')
  }
  next()
})

export const Match = mongoose.model('Match', matchSchema)


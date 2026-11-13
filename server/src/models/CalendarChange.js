import mongoose from 'mongoose'

const calendarChangeSchema = new mongoose.Schema(
  {
    liga_id: { type: String, required: true, lowercase: true, trim: true, index: true },
    jornada: { type: Number, required: true, min: 1 },
    partido_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    cambio_anterior: { type: mongoose.Schema.Types.Mixed, required: true },
    cambio_nuevo: { type: mongoose.Schema.Types.Mixed, required: true },
    motivo: { type: String, required: true, trim: true, maxlength: 300 },
    operador: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: 'cambios_calendario' },
)

export const CalendarChange = mongoose.model('CalendarChange', calendarChangeSchema)

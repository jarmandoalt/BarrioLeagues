import mongoose from 'mongoose'

const whatsappReceivedMessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, trim: true },
    from: { type: String, required: true, trim: true, index: true },
    text: { type: String, default: '' },
    payload: { type: String, default: '' },
    messageType: { type: String, default: 'unknown' },
    status: { type: String, enum: ['received', 'test'], required: true },
    receivedAt: { type: Date, required: true, index: true },
    flowTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppFlowTest' },
  },
  { timestamps: true, collection: 'mensajes_recibidos' },
)

export const WhatsAppReceivedMessage = mongoose.model(
  'WhatsAppReceivedMessage',
  whatsappReceivedMessageSchema,
)

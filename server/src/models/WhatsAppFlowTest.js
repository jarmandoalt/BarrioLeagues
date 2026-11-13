import mongoose from 'mongoose'

const whatsappFlowTestSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['test'], default: 'test', required: true },
    activeKey: { type: String, unique: true, sparse: true },
    phoneNumber: { type: String, required: true, trim: true },
    workflowState: {
      type: String,
      enum: ['waiting_response', 'processing', 'retry', 'completed', 'failed'],
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true, index: true },
    responded: { type: Boolean, default: false },
    response: { type: String, enum: ['yes', 'no', 'other'], default: null },
    responseText: { type: String, default: '' },
    responseReceivedAt: { type: Date, default: null },
    refereeMessageId: { type: String, default: null },
    confirmationMessageId: { type: String, default: null },
    adminMessageId: { type: String, default: null },
    processingLeaseUntil: { type: Date, default: null },
    nextAttemptAt: { type: Date, default: null },
    attemptCount: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'whatsapp_flow_tests' },
)

whatsappFlowTestSchema.index({ status: 1, workflowState: 1, dueAt: 1 })

export const WhatsAppFlowTest = mongoose.model('WhatsAppFlowTest', whatsappFlowTestSchema)

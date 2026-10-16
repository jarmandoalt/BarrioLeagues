import mongoose from 'mongoose'

const notificationLogSchema = new mongoose.Schema(
  {
    match_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    to: { type: String, required: true, trim: true },
    recipient_name: { type: String, trim: true },
    role: { type: String, enum: ['arbitro', 'capitan', 'admin'], required: true },
    type: {
      type: String,
      enum: ['schedule_notification', 'confirmation_reminder', 'admin_alert', 'referee_confirmation', 'referee_rejection'],
      required: true,
    },
    message: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed', 'simulated', 'pending', 'delivered'], default: 'pending' },
    sent_at: { type: Date },
    test_mode: { type: Boolean, default: false },
    error_message: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

notificationLogSchema.virtual('createdAt').get(function () {
  return this.created_at
})
notificationLogSchema.virtual('updatedAt').get(function () {
  return this.updated_at
})

notificationLogSchema.index({ test_mode: 1, created_at: -1 })
notificationLogSchema.index({ match_id: 1 })
notificationLogSchema.index({ role: 1, created_at: -1 })

export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema, 'notifications_log')

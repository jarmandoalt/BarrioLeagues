import mongoose from 'mongoose'

const leagueAdminCredentialSchema = new mongoose.Schema(
  {
    leagueSlug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const LeagueAdminCredential = mongoose.model('LeagueAdminCredential', leagueAdminCredentialSchema)
import mongoose from 'mongoose'

export const connectDB = async () => {
  const uri = process.env.MONGO_URI

  if (!uri) {
    return null
  }

  mongoose.set('strictQuery', true)
  await mongoose.connect(uri)
  return mongoose.connection
}

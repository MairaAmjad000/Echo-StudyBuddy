import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDb() {
  mongoose.set('strictQuery', true)
  // Fail fast when the database is unreachable instead of buffering calls.
  mongoose.set('bufferTimeoutMS', 2000)
  try {
    await mongoose.connect(env.MONGODB_URI)
    console.log(`MongoDB connected: ${mongoose.connection.name}`)
  } catch (err) {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  }

  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message))
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'))
}

import mongoose from 'mongoose'
import { env } from './env.js'

// One connection per process, opened once and reused for the life of the
// instance. On a serverless host (Vercel) this is what keeps a warm function
// from opening a new connection per request, which would exhaust the
// database's connection limit in minutes.
let pending = null

export async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection

  if (!pending) {
    mongoose.set('strictQuery', true)
    // Fail fast when the database is unreachable instead of buffering calls.
    mongoose.set('bufferTimeoutMS', 2000)
    pending = mongoose
      .connect(env.MONGODB_URI)
      .then(() => {
        console.log(`MongoDB connected: ${mongoose.connection.name}`)
        mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message))
        mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'))
        return mongoose.connection
      })
      .catch((err) => {
        // Forget the failed attempt so the next request can try again; a
        // serverless instance must never leave a rejected promise cached.
        pending = null
        throw err
      })
  }

  return pending
}

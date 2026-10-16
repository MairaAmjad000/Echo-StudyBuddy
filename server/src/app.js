import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env, isProd } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import materialsRoutes from './routes/materials.routes.js'
import progressRoutes from './routes/progress.routes.js'
import chatRoutes from './routes/chat.routes.js'
import { AppError } from './lib/AppError.js'

export function createApp() {
  const app = express()

  // In production the app sits behind a reverse proxy (Vercel and every other
  // host), so the real client address only arrives in X-Forwarded-For. Without
  // this the rate limiter would key every request to the proxy's own address
  // and lock out all users together.
  if (isProd) app.set('trust proxy', 1)

  app.use(helmet())
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
  app.use(cookieParser())
  app.use(express.json({ limit: '5mb' }))

  app.get('/api/health', (req, res) => res.json({ ok: true, env: env.NODE_ENV }))
  app.use('/api/auth', authRoutes)
  app.use('/api/materials', materialsRoutes)
  app.use('/api/progress', progressRoutes)
  app.use('/api/chat', chatRoutes)

  // Unknown API routes are a 404, not a hang.
  app.use('/api', (req, res, next) => next(new AppError(404, `No route for ${req.method} ${req.originalUrl}`)))

  // Central error handler. Operational errors carry a safe message;
  // anything else is logged fully and hidden from the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    console.error(err)
    res.status(500).json({ error: isProd ? 'Something went wrong' : err.message })
  })

  return app
}

// Vercel serverless entry.
//
// Vercel hands this the same (req, res) a Node server would, so the existing
// Express app answers every request unchanged. Two things differ from
// src/index.js on purpose:
//
//   * nothing calls app.listen(). A serverless instance is created per
//     request and frozen between them; there is no port to listen on.
//   * the database is connected lazily, inside the handler, and cached by
//     src/config/db.js, so a warm invocation reuses the connection instead of
//     opening another one.
//
// The [...path] in the filename is Vercel's catch-all convention: it is what
// matches /api/auth/login, /api/materials, and every other route. Vercel
// passes the original URL through, so the Express routes (all mounted under
// /api) match exactly as they do locally.
import { createApp } from '../src/app.js'
import { connectDb } from '../src/config/db.js'

const app = createApp()

export default async function handler(req, res) {
  try {
    await connectDb()
  } catch (err) {
    console.error('Database unavailable:', err.message)
    res.statusCode = 503
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'The server cannot reach its database right now. Please try again in a moment.' }))
    return
  }
  return app(req, res)
}

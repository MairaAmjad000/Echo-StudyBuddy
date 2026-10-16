// Vercel serverless entry.
//
// Vercel hands this the same (req, res) a Node server would, so the existing
// Express app answers every request unchanged. Three things differ from
// src/index.js on purpose:
//
//   * nothing calls app.listen(). A serverless instance is created per request
//     and frozen between them; there is no port to listen on.
//   * the database is connected lazily, inside the handler, and cached by
//     src/config/db.js, so a warm invocation reuses the connection instead of
//     opening another one.
//   * the URL is rebuilt from ?__url=. Vercel's file-system API routing only
//     matches ONE path segment per dynamic file — an api/[...path].js entry
//     answered /api/health but returned the platform's 404 for /api/auth/me,
//     /api/materials/:id and every other nested route. So vercel.json rewrites
//     the whole /api surface to this one function with the real path carried in
//     the query, and restoreUrl() puts it back before Express matches routes.
import { createApp } from '../src/app.js'
import { connectDb } from '../src/config/db.js'

const app = createApp()

/**
 * Puts the path the rewrite carried back onto the request, keeping the rest of
 * the query string — the Google callback arrives with ?code=…&state=….
 * Exported so it can be checked directly, without a database.
 */
export function restoreUrl(req) {
  const raw = String(req.url || '')
  const queryStart = raw.indexOf('?')
  if (queryStart === -1) return
  const params = new URLSearchParams(raw.slice(queryStart + 1))
  const carried = params.get('__url')
  if (carried === null) return
  if (carried.includes(':')) {
    // The pattern matched but the platform did not substitute the capture.
    // Say so instead of inventing a path.
    console.warn('Rewrite did not substitute the path; leaving the URL as', raw)
    return
  }
  params.delete('__url')
  const path = carried.replace(/^\/+|\/+$/g, '')
  const query = params.toString()
  req.url = `/api${path ? `/${path}` : ''}${query ? `?${query}` : ''}`
}

export default async function handler(req, res) {
  restoreUrl(req)
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

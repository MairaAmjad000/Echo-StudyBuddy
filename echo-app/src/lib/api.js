// The only place that talks to the backend. Requests are same-origin
// in production (reverse proxy) and proxied by Vite in dev, with the
// session carried in an httpOnly cookie — never in localStorage.

const API = import.meta.env.VITE_API_URL || ''

/** An API error carrying the server's safe message and status. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    // Keep the server's reason when it sent one (a failed login, a bad field);
    // fall back to the session-expired line for bare 401s.
    if (res.status === 401) throw new ApiError(401, data?.error || 'Your session expired. Please log in again.')
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
}

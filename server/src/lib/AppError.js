// Operational error: carries a status code and a safe client message.
export class AppError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
  }
}

export const notFound = (what = 'Resource') => new AppError(404, `${what} not found`)
export const unauthorized = (message = 'Sign in first') => new AppError(401, message)
export const badRequest = (message = 'Invalid request') => new AppError(400, message)

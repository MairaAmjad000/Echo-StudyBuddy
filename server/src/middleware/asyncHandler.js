// Express 4 does not forward rejected promises to the error middleware.
// Wrap every async handler so DB/controller errors reach it.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

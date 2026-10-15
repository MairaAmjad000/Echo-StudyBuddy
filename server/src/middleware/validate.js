import { AppError } from '../lib/AppError.js'

/** Wraps a zod schema: 400 with the first issue on bad input. */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    })
    if (result.success) return next()
    const issue = result.error.issues[0]
    next(new AppError(400, `${issue.path.join('.')}: ${issue.message}`))
  }
}

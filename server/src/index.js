import 'dotenv/config'
import { createApp } from './app.js'
import { connectDb } from './config/db.js'
import { env } from './config/env.js'

async function main() {
  await connectDb()
  const app = createApp()
  app.listen(env.PORT, () => {
    console.log(`Echo API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

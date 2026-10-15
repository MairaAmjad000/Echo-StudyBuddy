// TEMPORARY verification helper: inserts two sample conversations for an
// account so the chat history rail can be checked without spending AI quota.
// Run with: node scripts/seed-chat-check.mjs "<account name>"
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDb } from '../src/config/db.js'
import { User } from '../src/models/User.js'
import { Material } from '../src/models/Material.js'
import { ChatSession } from '../src/models/ChatSession.js'

const name = process.argv[2] || 'Strobi Test'

await connectDb()
const user = await User.findOne({ name })
if (!user) {
  console.error(`No user named "${name}"`)
  process.exit(1)
}
const material = await Material.findOne({ owner: user._id })
if (!material) {
  console.error('That account has no material')
  process.exit(1)
}

const now = Date.now()
const one = await ChatSession.create({
  owner: user._id,
  material: material._id,
  materialTitle: material.title,
  title: 'What is Introduction to TypeScript about?',
  turnCount: 4,
  messages: [
    { role: 'user', content: 'What is Introduction to TypeScript about?', at: now - 60000 },
    { role: 'echo', content: 'It introduces what TypeScript is and why the course matters, in plain steps.', at: now - 55000 },
    { role: 'user', content: 'Give me one line I should remember.', at: now - 30000 },
    { role: 'echo', content: 'TypeScript adds types to JavaScript so mistakes show up before you run the code.', at: now - 25000 },
  ],
})
const two = await ChatSession.create({
  owner: user._id,
  material: material._id,
  materialTitle: material.title,
  title: 'Quiz me on Prerequisites and Course Takeaways',
  turnCount: 2,
  messages: [
    { role: 'user', content: 'Quiz me on Prerequisites and Course Takeaways', at: now - 86400000 },
    { role: 'echo', content: 'Question one: what do you need installed before TypeScript is useful?', at: now - 86390000 },
  ],
})
// Raw collection: the schema stamps updatedAt on every mongoose write.
await ChatSession.collection.updateOne({ _id: two._id }, { $set: { updatedAt: new Date(now - 86400000) } })

console.log(JSON.stringify({ first: String(one._id), second: String(two._id) }))
await mongoose.disconnect()

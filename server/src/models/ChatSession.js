import mongoose from 'mongoose'

// One stored conversation with Echo. The client sends the whole thread on
// every question (so a reload keeps its context); the server keeps the same
// thread here so the student can come back to it later.
const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'echo'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    at: { type: Number, default: () => Date.now() },
  },
  { _id: false },
)

const chatSessionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    // Kept alongside the id so the history list still reads well if a material
    // is deleted later.
    materialTitle: { type: String, default: '' },
    title: { type: String, default: 'New chat', maxlength: 120 },
    turnCount: { type: Number, default: 0 },
    messages: [messageSchema],
  },
  { timestamps: true },
)

chatSessionSchema.index({ owner: 1, updatedAt: -1 })

chatSessionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.owner
    return ret
  },
})

export const ChatSession = mongoose.model('ChatSession', chatSessionSchema)

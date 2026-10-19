import mongoose from 'mongoose'

// One saved whiteboard lesson. The board itself is plain data — titles, spoken
// narration and typed lines — so a lesson can be reopened and replayed later
// without calling the model again, and without storing any image the student
// photographed.
const lineSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['text', 'math', 'note'], default: 'text' },
    text: { type: String, required: true, maxlength: 400 },
  },
  { _id: false },
)

const stepSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    say: { type: String, default: '', maxlength: 700 },
    lines: { type: [lineSchema], default: [] },
  },
  { _id: false },
)

const whiteboardLessonSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 140 },
    subject: { type: String, default: 'Study', maxlength: 60 },
    summary: { type: String, default: '', maxlength: 320 },
    question: { type: String, default: '', maxlength: 4000 },
    source: { type: String, enum: ['typed', 'photo'], default: 'typed' },
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    materialTitle: { type: String, default: '', maxlength: 200 },
    steps: { type: [stepSchema], default: [] },
    answer: {
      text: { type: String, default: '', maxlength: 400 },
      say: { type: String, default: '', maxlength: 700 },
    },
  },
  { timestamps: true },
)

whiteboardLessonSchema.index({ owner: 1, updatedAt: -1 })

whiteboardLessonSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.owner
    return ret
  },
})

export const WhiteboardLesson = mongoose.model('WhiteboardLesson', whiteboardLessonSchema)

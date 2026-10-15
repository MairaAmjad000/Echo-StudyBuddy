import mongoose from 'mongoose'

// A study pack is produced by the rule-based generator (or a future LLM).
// Shapes mirror the frontend's pack exactly.
const keyPointSchema = new mongoose.Schema(
  { id: String, label: String, match: [String], hint: String },
  { _id: false },
)

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: String,
    summary: [String],
    groups: [{ title: String, items: [String] }],
    terms: [{ term: String, def: String }],
    keyPoints: [keyPointSchema],
  },
  { _id: false },
)

const cardSchema = new mongoose.Schema(
  { id: { type: String, required: true }, sectionId: String, q: String, a: String },
  { _id: false },
)

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    sectionId: String,
    q: String,
    options: [String],
    answer: Number,
    why: String,
  },
  { _id: false },
)

const packSchema = new mongoose.Schema(
  { sections: [sectionSchema], cards: [cardSchema], questions: [questionSchema] },
  { _id: false },
)

const materialSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ['pdf', 'pptx', 'docx', 'txt', 'md', 'youtube', 'sample'],
      required: true,
    },
    status: { type: String, enum: ['ready', 'needs-text'], default: 'ready' },
    sourceUrl: { type: String, maxlength: 2000 },
    sample: { type: Boolean, default: false },
    pack: packSchema,
    // The student's own text, kept so Chat with Echo can quote the file itself
    // instead of only the generated notes. Never sent in list responses.
    sourceText: { type: String, maxlength: 200_000, select: false },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

materialSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    // The frontend keys progress by its own string id; keep it stable.
    if (!ret.packId) return ret
    return ret
  },
})

export const Material = mongoose.model('Material', materialSchema)

import mongoose from 'mongoose'

const xpLogSchema = new mongoose.Schema({ at: Number, amount: Number }, { _id: false })
const quizLogSchema = new mongoose.Schema(
  { at: Number, materialId: String, correct: Number, total: Number, defeated: Boolean, fast: Number, boss: Boolean },
  { _id: false },
)
const teachLogSchema = new mongoose.Schema(
  { at: Number, materialId: String, sectionId: String, topic: String, score: Number },
  { _id: false },
)
const activitySchema = new mongoose.Schema(
  { id: String, type: String, text: String, at: Number },
  { _id: false },
)

// One progress document per user. Field names match the frontend state
// so the client can hydrate its store directly from GET /api/progress.
const progressSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    sectionsDone: { type: Object, default: {} }, // materialId -> [sectionId]
    cardsEasy: { type: Object, default: {} }, // materialId -> [cardId]
    quizLog: [quizLogSchema],
    teachLog: [teachLogSchema],
    xp: { type: Number, default: 0 },
    xpLog: [xpLogSchema],
    studyDays: [String], // YYYY-MM-DD
    activity: [activitySchema],
    achievements: { type: Object, default: {} }, // id -> unlockedAt (ms)
    xpAwarded: { type: Object, default: {} }, // "materialId:sectionId" -> true, prevents double XP
    settings: {
      reduceMotion: { type: Boolean, default: false },
      echoEnabled: { type: Boolean, default: true },
    },
    lastStudied: { materialId: String, sectionId: String },
  },
  { timestamps: true },
)

progressSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id
    delete ret.__v
    delete ret.owner
    return ret
  },
})

export const Progress = mongoose.model('Progress', progressSchema)

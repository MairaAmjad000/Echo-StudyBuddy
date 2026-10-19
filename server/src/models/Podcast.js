import mongoose from 'mongoose'

// One recorded episode: the script, which voice reads each turn, and how far the
// student got. The audio itself is not stored — it is synthesised turn by turn
// the first time a turn is played and then cached by the browser (see
// lib/tts.js and the audio route), which keeps an episode a few kilobytes of
// text in the database instead of megabytes of MP3.

const segmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    speaker: { type: String, enum: ['echo', 'milo'], required: true },
    // The Edge voice for this turn, resolved when the episode is written, so
    // playing it back never depends on the preset list staying the same.
    voice: { type: String, required: true },
    text: { type: String, required: true, maxlength: 800 },
    seconds: Number,
  },
  { _id: false },
)

const podcastSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    materialTitle: String,
    // The one topic the episode covers, or empty when it covers the material.
    sectionId: { type: String, default: '' },
    sectionTitle: { type: String, default: '' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    preset: { type: String, required: true }, // voice pair id
    length: { type: String, enum: ['short', 'standard', 'deep'], default: 'standard' },
    source: { type: String, enum: ['ai', 'built-in'], default: 'built-in' },
    segments: [segmentSchema],
    seconds: { type: Number, default: 0 }, // estimated from the script
    words: { type: Number, default: 0 },
    // The turn the student last heard, so the player can offer to pick up there.
    position: { type: Number, default: 0 },
    listenedAt: Date,
  },
  { timestamps: true },
)

podcastSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const Podcast = mongoose.model('Podcast', podcastSchema)

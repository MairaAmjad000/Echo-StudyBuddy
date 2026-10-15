import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Enter a valid email address',
      },
    },
    passwordHash: { type: String, required: true, select: false },
    // Chosen profile picture: a file name from the frontend's avatar folder.
    // The server only ever accepts one the user's level has unlocked.
    avatar: { type: String, default: null },
  },
  { timestamps: true },
)

// Never send the hash (or internals) to the client.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const User = mongoose.model('User', userSchema)

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
    // Accounts created with "Continue with Google" have no password of their
    // own: the controller insists on one or the other, not on a password
    // specifically, so `required` cannot live on the field itself.
    passwordHash: { type: String, default: null, select: false },
    // Google's stable subject id for this person. Sparse so the many
    // password-only accounts do not collide — but note the field must stay
    // ABSENT on those accounts, never `null`: a sparse index skips missing
    // fields while still indexing an explicit null, so a `default: null` here
    // would let exactly one password-only account ever exist.
    googleId: { type: String, unique: true, sparse: true },
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
    // How the account signs in is the client's business; Google's subject id
    // for it is not.
    ret.googleLinked = Boolean(ret.googleId)
    delete ret.googleId
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const User = mongoose.model('User', userSchema)

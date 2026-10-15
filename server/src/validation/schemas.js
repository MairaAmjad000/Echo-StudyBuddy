import { z } from 'zod'

const id = z.string().min(1)

export const signupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name needs at least 2 letters').max(80, 'Name must be 80 characters or fewer'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z.string().min(8, 'Password needs at least 8 characters').max(128, 'That password is too long — 128 characters maximum'),
  }),
})

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z.string().min(1, 'Enter your password'),
  }),
})

export const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, 'Name needs at least 2 letters').max(80).optional(),
      avatar: z.string().trim().min(1).max(60).optional(),
    })
    .refine((v) => v.name !== undefined || v.avatar !== undefined, {
      message: 'Send a name or a profile picture',
    }),
})

/**
 * A study pack, loosely validated: we trust the shapes the generator makes. The
 * ceilings match what the generators may return — a whole long document's worth
 * of notes, cards and questions, not a sample of it.
 */
const packSchema = z.object({
  sections: z.array(z.any()).max(60).optional(),
  cards: z.array(z.any()).max(400).optional(),
  questions: z.array(z.any()).max(300).optional(),
})

export const createMaterialSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(200),
      type: z.enum(['pdf', 'pptx', 'docx', 'txt', 'md', 'youtube', 'sample']),
      status: z.enum(['ready', 'needs-text']).optional(),
      sourceUrl: z.string().url().max(2000).optional(),
      sample: z.boolean().optional(),
      pack: packSchema.optional(),
      // Raw material for server-side generation when no pack is sent.
      text: z.string().max(2_000_000).optional(),
      sections: z.array(z.object({ title: z.string(), lines: z.array(z.string()) })).max(60).optional(),
    })
    .refine((v) => v.pack !== undefined || v.text !== undefined || v.sections !== undefined || v.status === 'needs-text', {
      message: 'Send a pack, or text/sections to generate one from',
    })
    // A YouTube link is only accepted together with its transcript.
    .refine((v) => v.type !== 'youtube' || (typeof v.text === 'string' && v.text.trim().length > 0), {
      message: 'A YouTube link needs its transcript too — send both',
    }),
})

export const linkSchema = z.object({
  body: z.object({
    url: z.string().url('Enter a valid YouTube link'),
    transcript: z.string().min(1, 'Paste the transcript too — a YouTube link needs both').max(2_000_000),
  }),
})

export const completeMaterialSchema = z.object({
  params: z.object({ id: id }),
  body: z.object({ transcript: z.string().min(1) }),
})

export const recordQuizSchema = z.object({
  body: z.object({
    materialId: id,
    correct: z.number().int().min(0),
    total: z.number().int().min(0),
    defeated: z.boolean().optional().default(false),
    fast: z.number().int().min(0).optional().default(0),
    boss: z.boolean().optional().default(false),
  }),
})

export const recordCardsSchema = z.object({
  body: z.object({
    materialId: id,
    easyIds: z.array(z.string()).max(500),
    hardCount: z.number().int().min(0).default(0),
  }),
})

export const recordTeachSchema = z.object({
  body: z.object({
    materialId: id,
    sectionId: id,
    topic: z.string().max(200),
    score: z.number().min(0).max(100),
  }),
})

export const toggleSectionSchema = z.object({
  params: z.object({ materialId: id }),
  body: z.object({ sectionId: id, title: z.string().max(200), done: z.boolean() }),
})

export const touchSchema = z.object({
  body: z.object({ materialId: id, sectionId: id }),
})

export const settingsSchema = z.object({
  body: z
    .object({
      reduceMotion: z.boolean().optional(),
      echoEnabled: z.boolean().optional(),
    })
    .refine((v) => v.reduceMotion !== undefined || v.echoEnabled !== undefined, {
      message: 'Send a setting to change',
    }),
})

/** Chat with Echo: the question plus the conversation so far (oldest first).
 * `sessionId` is the stored conversation to append to (omitted for a new one). */
export const chatSchema = z.object({
  body: z.object({
    materialId: id,
    sessionId: id.optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'echo']),
          content: z.string().trim().min(1, 'Say something first').max(2000),
        }),
      )
      .min(1)
      .max(40),
  }),
})

export const chatSessionParamsSchema = z.object({ params: z.object({ id }) })

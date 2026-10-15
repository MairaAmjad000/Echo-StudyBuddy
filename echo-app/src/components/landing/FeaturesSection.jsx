import { FlashDemo, MapDemo, NotesDemo, PerformanceDemo, QuizDemo } from './FeatureDemos.jsx'
import './landing.css'

export default function FeaturesSection() {
  return (
    <section className="lp-features" id="features">
      <div className="wrap">
        <div className="lp-intro">
          <h2>One upload, five ways to study it.</h2>
          <p className="muted">
            You have already seen Teach Echo above. These are the other four, all built from the same file. The examples come from a data
            communication chapter, and every demo below works.
          </p>
        </div>

        <div className="lp-grid">
          <article className="lp-f lp-notes">
            <h3>Notes you can revise from</h3>
            <p>Echo reads the file and writes notes with a contents list, headings and the key points under each one.</p>
            <NotesDemo />
          </article>

          <article className="lp-f lp-flash">
            <h3>Flashcards, easy or hard</h3>
            <p>Flip the card, then mark it. Try this one.</p>
            <FlashDemo />
          </article>

          <article className="lp-f lp-quiz">
            <h3>Quizzes you fight through</h3>
            <p>Every right answer hits the monster. Every wrong one lets it hit back. The questions come from your own material.</p>
            <QuizDemo />
          </article>

          <article className="lp-f lp-map">
            <h3>A map of the whole course</h3>
            <p>Echo splits your course into topics and lays them out in order. Finish a topic to open the next one. The last stop is the boss round.</p>
            <MapDemo />
            <p className="small muted lp-sample">Sample map for a networking course.</p>
          </article>
        </div>

        <div className="lp-perf">
          <div className="lp-f">
            <h3>See what is sticking</h3>
            <p>Echo scores your knowledge, memory, problem solving, consistency and speed, and shows which one is lowest this month.</p>
          </div>
          <div>
            <PerformanceDemo />
            <p className="small muted lp-sample">Sample figures. The lowest one is marked in red.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

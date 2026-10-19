import SelectField from '../ui/SelectField.jsx'
import './podcast.css'

/**
 * The panel that records a new episode: which material, which topic, which pair
 * of voices, how long. A topic narrows the episode the way it narrows a
 * flashcard deck or a quiz — "All topics" walks the whole material instead.
 *
 * The script is written server-side (Gemini when a key is configured, the notes
 * themselves otherwise) and the audio is recorded the first time each turn is
 * played, so this waits for the script only — a few seconds.
 */
export default function EpisodeStudio({
  materials,
  materialId,
  onMaterial,
  topics,
  sectionId,
  onSection,
  presets,
  preset,
  onPreset,
  lengths,
  length,
  onLength,
  creating,
  status,
  error,
  onCreate,
}) {
  return (
    <section className="pod-studio surface">
      <div className="pod-studio-copy">
        <h3>Record a new episode</h3>
        <p className="muted">
          Echo and Milo talk through one of your materials — or one topic of it. What it means, the words worth keeping, and the
          questions you would be asked. Two voices, so it works on a walk.
        </p>
      </div>

      <div className="pod-studio-fields">
        <SelectField
          label="Material"
          value={materialId}
          onChange={onMaterial}
          options={materials.map((m) => ({ value: m.id, label: m.title }))}
        />
        <SelectField label="Topic" value={sectionId} onChange={onSection} options={topics} />
        <SelectField label="Voices" value={preset} onChange={onPreset} options={presets} />
        <SelectField label="Length" value={length} onChange={onLength} options={lengths} />
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={onCreate} disabled={creating || !materialId}>
            {creating ? 'Writing the script…' : 'Record episode'}
          </button>
        </div>
      </div>

      {status && <p className="pod-studio-status small muted">{status}</p>}
      {error && <p className="pod-studio-error" role="status">{error}</p>}
    </section>
  )
}

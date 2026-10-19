import { useCallback, useEffect, useRef, useState } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import EchoNote from '../components/ui/EchoNote.jsx'
import Button from '../components/ui/Button.jsx'
import EpisodeRail from '../components/podcast/EpisodeRail.jsx'
import EpisodeStudio from '../components/podcast/EpisodeStudio.jsx'
import EpisodePlayer from '../components/podcast/EpisodePlayer.jsx'
import useMaterialSelection from '../hooks/useMaterialSelection.js'
import useMediaQuery from '../hooks/useMediaQuery.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useApp } from '../store/AppContext.jsx'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { podcastStory, podcastReadyStory, podcastVoiceStory } from '../components/mascot/scenarios.js'
import '../styles/pages.css'
import '../components/podcast/podcast.css'

/**
 * Podcast with Echo.
 *
 * One of the student's materials becomes an episode: Echo and Milo talk through
 * it in two voices, and the page plays it back turn by turn with the script
 * alongside, so it can be listened to on a walk or skimmed like notes.
 *
 * The script is written on the server (Gemini, or the material's own notes when
 * there is no key) and saved with the episode. The voices are recorded the first
 * time each turn is played, which is why the page can start playing a fresh
 * episode in a couple of seconds instead of waiting for the whole thing.
 */
export default function Podcast() {
  useDocumentTitle('Podcast with Echo')
  const { actions } = useApp()
  const companion = useCompanion()
  const { ready, material, section, setMaterial, setSection } = useMaterialSelection()
  const wideEnough = useMediaQuery('(min-width: 1200px)')

  const [episodes, setEpisodes] = useState([])
  const [options, setOptions] = useState({ presets: [], lengths: [], hosts: { echo: 'Echo', milo: 'Milo' } })
  const [episode, setEpisode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  // The studio's status line: the script comes first, then the page opens the
  // player and the voices are recorded on demand.
  const [studioOpen, setStudioOpen] = useState(false)
  const [preset, setPreset] = useState('')
  const [length, setLength] = useState('standard')
  const [showRail, setShowRail] = useState(wideEnough)
  const railChosen = useRef(false)
  // Whether the page has already chosen an episode to open by itself.
  const picked = useRef(false)

  // The rail is a second column on a wide screen; on anything narrower it would
  // squeeze the player, so it sits behind a button and stacks instead.
  useEffect(() => {
    if (!railChosen.current) setShowRail(wideEnough)
  }, [wideEnough])

  const refresh = useCallback(async () => {
    try {
      const data = await actions.listPodcasts()
      const list = data.episodes || []
      setEpisodes(list)
      setOptions(data)
      setLoadError('')
      // Open the newest episode straight away: coming back to this page is
      // almost always "carry on listening", and the player offers the turn the
      // student stopped at. Only on the first load — a later refresh must not
      // pull them off the episode they are on.
      if (!picked.current && list.length) {
        picked.current = true
        actions
          .loadPodcast(list[0].id)
          .then(setEpisode)
          .catch(() => {})
      }
      return list
    } catch (e) {
      setLoadError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [actions])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Opening the page is worth one line from Echo, and the studio is open the
  // first time there is nothing to listen to.
  const greeted = useRef(false)
  useEffect(() => {
    if (loading || greeted.current) return
    greeted.current = true
    if (!episodes.length) {
      setStudioOpen(true)
      const story = podcastStory()
      companion.react(story.pose, story.line, story.tone, story.ms)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const open = useCallback(
    async (id) => {
      picked.current = true
      try {
        setEpisode(await actions.loadPodcast(id))
      } catch (e) {
        setLoadError(e.message)
      }
    },
    [actions],
  )

  const create = async () => {
    if (creating) return
    setCreating(true)
    setCreateError('')
    try {
      const created = await actions.createPodcast({
        materialId: material.id,
        sectionId: section?.id,
        preset: preset || undefined,
        length,
      })
      setEpisodes((list) => [created, ...list.filter((e) => e.id !== created.id)])
      setEpisode(created)
      setStudioOpen(false)
      const story = podcastReadyStory({ minutes: created.minutes, turns: created.turns })
      companion.react(story.pose, story.line, story.tone, story.ms)
    } catch (e) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const removeEpisode = async (target) => {
    try {
      await actions.deletePodcast(target.id)
      setEpisodes((list) => list.filter((e) => e.id !== target.id))
      setEpisode((current) => (current?.id === target.id ? null : current))
      // Deleting the episode that was on screen should open the next one rather
      // than leave an empty player behind.
      const next = episodes.find((e) => e.id !== target.id)
      if (next) open(next.id)
    } catch (e) {
      setLoadError(e.message)
    }
  }

  /** Echo comments while an episode is playing, and again when it finishes. */
  const onTurnChange = useCallback(
    (index, meta) => {
      if (!meta?.finished) return
      const story = podcastVoiceStory()
      companion.react(story.pose, story.line, story.tone, story.ms)
    },
    [companion],
  )

  const onSavePosition = useCallback(
    (index) => {
      if (episode) actions.savePodcastPosition(episode.id, index)
      setEpisodes((list) => list.map((e) => (e.id === episode?.id ? { ...e, position: index } : e)))
    },
    [actions, episode],
  )

  if (!ready.length) {
    return (
      <>
        <PageHeader title="Podcast with Echo" subtitle="Two voices talking through your material." />
        <EmptyState title="Nothing to record from yet." action={<Button to="/app/materials">Upload your first notes</Button>}>
          Upload a file and Echo will turn it into an episode you can listen to.
        </EmptyState>
      </>
    )
  }

  // The same topic list the flashcards and the quiz use: every section of the
  // material, plus "All topics" for an episode that walks the whole course.
  const topics = [
    { value: '', label: 'All topics' },
    ...(material?.pack?.sections || []).map((s) => ({ value: s.id, label: s.title })),
  ]

  return (
    <div className="pod-page">
      <PageHeader title="Podcast with Echo" subtitle="Echo and Milo talk through one material, and you listen.">
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            railChosen.current = true
            setShowRail((v) => !v)
          }}
          aria-expanded={showRail}
        >
          {showRail ? 'Hide episodes' : `Episodes${episodes.length ? ` (${episodes.length})` : ''}`}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setStudioOpen((v) => !v)} disabled={creating}>
          {studioOpen ? 'Close studio' : 'New episode'}
        </button>
      </PageHeader>

      {loadError && <p className="pod-error" role="status">{loadError}</p>}

      {(studioOpen || episodes.length === 0) && (
        <EpisodeStudio
          materials={ready}
          materialId={material?.id || ''}
          onMaterial={(id) => setMaterial(id)}
          topics={topics}
          sectionId={section?.id || ''}
          onSection={setSection}
          presets={options.presets}
          preset={preset || options.presets[0]?.value || ''}
          onPreset={setPreset}
          lengths={options.lengths}
          length={length}
          onLength={setLength}
          creating={creating}
          status={creating ? 'Echo is reading the material and writing the script. This takes a few seconds.' : ''}
          error={createError}
          onCreate={create}
        />
      )}

      <div className={`pod-shell${showRail ? '' : ' is-solo'}`}>
        {showRail && (
          <EpisodeRail
            episodes={episodes}
            activeId={episode?.id}
            onOpen={open}
            onNew={() => setStudioOpen(true)}
            busy={creating}
          />
        )}

        <div className="pod-main">
          {episode ? (
            <EpisodePlayer
              key={episode.id}
              episode={episode}
              hosts={options.hosts}
              onTurnChange={onTurnChange}
              onSavePosition={onSavePosition}
              onDelete={removeEpisode}
            />
          ) : (
            <div className="pod-idle surface">
              <img src="/echo.png" alt="" width="72" height="72" />
              <div>
                <h3>{loading ? 'Loading your episodes…' : 'Pick an episode'}</h3>
                <p className="muted">
                  {episodes.length
                    ? 'Choose one from the list to keep listening, or record a new one from any of your materials.'
                    : 'Record your first episode from one of your materials and it will show up here.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="page-note">
        <EchoNote>
          the first play of a
          turn takes a second to record, and after that it is instant.
        </EchoNote>
      </div>
    </div>
  )
}

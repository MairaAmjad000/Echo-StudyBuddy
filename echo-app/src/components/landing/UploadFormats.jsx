import './landing.css'

export default function UploadFormats() {
  return (
    <section className="lp-uploads" id="uploads">
      <div className="wrap lp-uploads-grid">
        <h2>Bring what you already have.</h2>
        <div>
          <dl className="lp-formats">
            <div><dt>Slides</dt><dd>PowerPoint files (.pptx)</dd></div>
            <div><dt>Documents</dt><dd>PDF, Word and plain text files (.pdf, .docx, .txt)</dd></div>
            <div><dt>Lecture videos</dt><dd>Paste a YouTube link, with the transcript if you have it</dd></div>
          </dl>
          <p className="muted lp-foot">Everything you upload is kept in My Materials, so you can pick which file to study from. Files are read in your browser and stay on your device.</p>
        </div>
      </div>
    </section>
  )
}

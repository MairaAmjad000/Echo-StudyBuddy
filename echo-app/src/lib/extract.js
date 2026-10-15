// Reads a File in the browser and returns either plain text or ready-made sections.
// Nothing is uploaded anywhere: parsing happens on this device.

import { fileExt } from './format.js'

const MAX_PDF_PAGES = 200

/** The shortest text Echo can build a study pack from — files and transcripts
 * are checked against this on their way in, client and server alike. */
export const MIN_TEXT = 200

async function readDocx(file) {
  const mod = await import('mammoth')
  const mammoth = mod.default ?? mod
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const sections = []
  let cur = null
  const ensure = () => (cur ||= { title: '', lines: [] })
  for (const el of doc.body.children) {
    const text = el.textContent.replace(/\s+/g, ' ').trim()
    if (!text) continue
    if (/^H[1-6]$/.test(el.tagName)) {
      if (cur) sections.push(cur)
      cur = { title: text, lines: [] }
    } else if (el.tagName === 'UL' || el.tagName === 'OL') {
      el.querySelectorAll('li').forEach((li) => ensure().lines.push('- ' + li.textContent.replace(/\s+/g, ' ').trim()))
    } else {
      ensure().lines.push(text)
    }
  }
  if (cur) sections.push(cur)
  const usable = sections.filter((s) => s.lines.join(' ').length > 40)
  if (usable.filter((s) => s.title).length >= 2) return { sections: usable }
  return { text: doc.body.textContent }
}

async function readPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages = []
  for (let p = 1; p <= Math.min(doc.numPages, MAX_PDF_PAGES); p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    let line = ''
    let lastY = null
    const lines = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line)
        line = ''
      }
      line += item.str + (item.hasEOL ? '' : ' ')
      lastY = y
    }
    lines.push(line)
    pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'))
  }
  return { text: pages.join('\n\n') }
}

async function readPptx(file) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
  const sections = []
  for (const name of names) {
    const xml = new DOMParser().parseFromString(await zip.files[name].async('string'), 'application/xml')
    const paras = [...xml.getElementsByTagName('a:p')]
      .map((p) => [...p.getElementsByTagName('a:t')].map((t) => t.textContent).join('').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    if (paras.join(' ').length < 30) continue
    sections.push({ title: paras[0].length <= 80 ? paras[0] : '', lines: (paras[0].length <= 80 ? paras.slice(1) : paras).map((l) => '- ' + l) })
  }
  return { sections }
}

export async function extractFromFile(file) {
  const ext = fileExt(file.name)
  if (['txt', 'md', 'markdown'].includes(ext)) return { text: await file.text(), type: ext === 'markdown' ? 'md' : ext }
  if (ext === 'docx') return { ...(await readDocx(file)), type: 'docx' }
  if (ext === 'pdf') return { ...(await readPdf(file)), type: 'pdf' }
  if (ext === 'pptx') return { ...(await readPptx(file)), type: 'pptx' }
  if (ext === 'ppt' || ext === 'doc') {
    throw new Error(`Old .${ext} files can't be read here. Save the file as .${ext}x and upload that.`)
  }
  throw new Error('That file type is not supported. Use PDF, PPTX, DOCX, TXT or MD.')
}

export const ACCEPTED = '.pdf,.pptx,.docx,.txt,.md'

export function parseYouTube(url) {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1) || null
    if (host.endsWith('youtube.com')) return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || null
  } catch {
    /* not a URL */
  }
  return null
}

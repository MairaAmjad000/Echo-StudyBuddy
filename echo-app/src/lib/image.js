/**
 * Turn a photo the student picked into something the AI can read.
 *
 * A phone camera photo is several megabytes; sending that whole file would be
 * slow and pointless, since the model only needs enough pixels to read the
 * question. The picture is drawn to a canvas at a maximum of 1400px on its long
 * edge, flattened onto white (a transparent PNG would otherwise turn black in
 * JPEG) and encoded at a sensible quality. The result is a data URL — no
 * upload service, no separate OCR bill.
 */
const MAX_FILE_BYTES = 12 * 1024 * 1024
const MAX_EDGE = 1400
const QUALITY = 0.82

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That photo could not be read. Try a JPEG or PNG.'))
    img.src = src
  })
}

export async function preparePhoto(file) {
  if (!file) throw new Error('Choose a photo of the question first.')
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Choose a photo of the question (JPEG, PNG or WebP).')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That photo is over 12 MB. Try a smaller one, or type the question instead.')
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
    if (!dataUrl || dataUrl.length < 100) throw new Error('That photo came out empty. Try another one.')
    return { dataUrl, width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

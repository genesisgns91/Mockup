import { deflate, concat } from './deflate.js'

/*
  ==========================================================
  GERADOR DE PDF (sem dependências)

  • Uma página, no tamanho exato da folha (A4/A3).
  • Cada arte é uma imagem RGB sem perdas (Flate) com máscara de
    transparência própria: a página não tem fundo algum, então o
    papel fica transparente (nada é impresso onde não há arte).
  • As imagens já chegam prontas (espelhadas/giradas) e são
    posicionadas em milímetros, com precisão.
  ==========================================================
*/

const PT_PER_MM = 72 / 25.4

const encoder = new TextEncoder()

function ascii(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/([()\\])/g, '\\$1')
}

function num(value) {
  return Number(value.toFixed(3)).toString()
}

/*
  rgba: Uint8Array/Uint8ClampedArray com width*height*4 bytes.
*/
async function prepareImage(width, height, rgba) {
  const pixels = width * height
  const rgb = new Uint8Array(pixels * 3)
  const alpha = new Uint8Array(pixels)

  let hasAlpha = false

  for (let i = 0, p = 0; i < pixels; i += 1, p += 4) {
    const a = rgba[p + 3]

    rgb[i * 3] = rgba[p]
    rgb[i * 3 + 1] = rgba[p + 1]
    rgb[i * 3 + 2] = rgba[p + 2]
    alpha[i] = a

    if (a !== 255) hasAlpha = true
  }

  return {
    rgb: await deflate(rgb),
    alpha: hasAlpha ? await deflate(alpha) : null,
  }
}

export async function buildPdf({ pageW, pageH, images, title = 'Gabarito de impressao' }) {
  const prepared = []

  for (const image of images) {
    prepared.push(await prepareImage(image.width, image.height, image.rgba))
  }

  const parts = []
  const offsets = []
  let length = 0

  const push = (bytes) => {
    parts.push(bytes)
    length += bytes.length
  }

  const text = (value) => push(encoder.encode(value))

  const beginObject = (n) => {
    offsets[n] = length
  }

  // numeração: 1 catálogo, 2 páginas, 3 página, 4 conteúdo,
  // depois [imagem, máscara?] de cada arte e, por fim, as informações
  let next = 5
  const refs = images.map((_, i) => {
    const ref = { image: next }

    next += 1

    if (prepared[i].alpha) {
      ref.mask = next
      next += 1
    }

    return ref
  })

  const infoObj = next

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  beginObject(1)
  text('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  beginObject(2)
  text('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')

  const pageWpt = pageW * PT_PER_MM
  const pageHpt = pageH * PT_PER_MM

  const xobjects = refs.map((r, i) => `/Im${i + 1} ${r.image} 0 R`).join(' ')

  beginObject(3)
  text(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageWpt)} ${num(pageHpt)}] ` +
      `/Resources << /XObject << ${xobjects} >> >> /Contents 4 0 R >>\nendobj\n`
  )

  let content = ''

  images.forEach((image, i) => {
    const w = image.w * PT_PER_MM
    const h = image.h * PT_PER_MM
    const x = image.x * PT_PER_MM
    // o PDF mede a partir de baixo; o layout mede a partir do topo
    const y = pageHpt - (image.y + image.h) * PT_PER_MM

    content += `q\n${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm\n/Im${i + 1} Do\nQ\n`
  })

  const contentBytes = encoder.encode(content)

  beginObject(4)
  text(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`)
  push(contentBytes)
  text('\nendstream\nendobj\n')

  images.forEach((image, i) => {
    const ref = refs[i]
    const data = prepared[i]

    beginObject(ref.image)
    text(
      `${ref.image} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.rgb.length}` +
        (ref.mask ? ` /SMask ${ref.mask} 0 R` : '') +
        ' >>\nstream\n'
    )
    push(data.rgb)
    text('\nendstream\nendobj\n')

    if (ref.mask) {
      beginObject(ref.mask)
      text(
        `${ref.mask} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
          `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.alpha.length} >>\nstream\n`
      )
      push(data.alpha)
      text('\nendstream\nendobj\n')
    }
  })

  beginObject(infoObj)
  text(
    `${infoObj} 0 obj\n<< /Title (${ascii(title)}) /Producer (Almatie Mockup 3D) >>\nendobj\n`
  )

  const xrefOffset = length
  const size = infoObj + 1

  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`

  for (let n = 1; n < size; n += 1) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  }

  text(xref)
  text(
    `trailer\n<< /Size ${size} /Root 1 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  )

  return concat(parts)
}

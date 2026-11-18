import { stepDown } from '../sheet/bake.js'

/*
  Prévia de alta qualidade para a tela: imagens muito grandes (ex.: 6000 px)
  mostradas pequenas na folha ficam serrilhadas quando o navegador reduz de
  uma vez. Aqui reduzimos em etapas de 1/2 (como na exportação), uma única
  vez, e a tela usa essa prévia enquanto ela tiver pixels de sobra. Ao dar
  zoom, volta a usar o arquivo original. A exportação NUNCA usa a prévia.
*/
export const PREVIEW_SIDE = 2400

export async function makePreview(img, side = PREVIEW_SIDE) {
  try {
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    const longest = Math.max(iw, ih)

    // só vale a pena para imagens bem maiores que a prévia
    if (!longest || longest <= side * 1.5) return null

    const k = side / longest
    const w = Math.max(1, Math.round(iw * k))
    const h = Math.max(1, Math.round(ih * k))

    const source = stepDown(img, w, h)

    const canvas = document.createElement('canvas')

    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, w, h)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

    if (!blob) return null

    return { url: URL.createObjectURL(blob), longest: Math.max(w, h) }
  } catch {
    return null
  }
}

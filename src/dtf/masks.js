import { MASK_SIDE, maskFromRgba, solidMask } from './overlap.js'

/*
  Máscara de baixa resolução (partes visíveis) de uma imagem.
  Imagens sem transparência (JPG) dão uma máscara 100% cheia.
  Se o navegador não conseguir ler a imagem, usa máscara cheia
  (o aviso de sobreposição então considera a "caixa" inteira).
*/
export function buildMask(img) {
  try {
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    const k = Math.min(1, MASK_SIDE / Math.max(iw, ih))

    const w = Math.max(1, Math.round(iw * k))
    const h = Math.max(1, Math.round(ih * k))

    const canvas = document.createElement('canvas')

    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    if (!ctx) return solidMask()

    ctx.drawImage(img, 0, 0, w, h)

    return maskFromRgba(ctx.getImageData(0, 0, w, h).data, w, h)
  } catch {
    return solidMask()
  }
}

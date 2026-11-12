import { bakeArt, mmToPx } from './bake.js'
import { buildPdf } from './pdf.js'
import { encodePng } from './png.js'

/*
  ==========================================================
  EXPORTAÇÃO DO GABARITO (PDF / PNG)

  Fundo sempre TRANSPARENTE e resolução de 300 DPI ou mais.
  ==========================================================
*/

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function bakeAll(items, dpi, { mirror, fit }) {
  return items.map((item) => {
    const w = mmToPx(item.w, dpi)
    const h = mmToPx(item.h, dpi)

    return {
      ...item,
      px: mmToPx(item.x, dpi),
      py: mmToPx(item.y, dpi),
      pw: w,
      ph: h,
      canvas: bakeArt(item.art.img, w, h, {
        rotated: item.rotated,
        mirror,
        fit,
      }),
    }
  })
}

export async function exportSheetPng({ page, items, dpi, mirror, fit, onProgress }) {
  const width = mmToPx(page.w, dpi)
  const height = mmToPx(page.h, dpi)

  const baked = bakeAll(items, dpi, { mirror, fit })

  const band = document.createElement('canvas')
  band.width = width

  const ctx = band.getContext('2d', { willReadFrequently: true })

  const bytes = await encodePng({
    width,
    height,
    dpi,
    bandRows: 128,
    onProgress,
    rows: async (y0, count) => {
      band.height = count // também limpa o canvas (transparente)

      for (const item of baked) {
        if (item.py + item.ph <= y0 || item.py >= y0 + count) continue

        ctx.drawImage(item.canvas, item.px, item.py - y0)
      }

      await tick()

      return ctx.getImageData(0, 0, width, count).data
    },
  })

  for (const item of baked) {
    item.canvas.width = 0
    item.canvas.height = 0
  }

  return new Blob([bytes], { type: 'image/png' })
}

export async function exportSheetPdf({ page, items, dpi, mirror, fit, title }) {
  const baked = bakeAll(items, dpi, { mirror, fit })
  const images = []

  for (const item of baked) {
    const ctx = item.canvas.getContext('2d', { willReadFrequently: true })
    const data = ctx.getImageData(0, 0, item.pw, item.ph).data

    images.push({
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      width: item.pw,
      height: item.ph,
      rgba: data,
    })

    item.canvas.width = 0
    item.canvas.height = 0

    await tick()
  }

  const bytes = await buildPdf({
    pageW: page.w,
    pageH: page.h,
    images,
    title,
  })

  return new Blob([bytes], { type: 'application/pdf' })
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = filename

  document.body.appendChild(a)
  a.click()
  a.remove()

  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

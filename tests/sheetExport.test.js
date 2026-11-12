// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { planSheet, placeArts } from '../src/sheet/layout.js'

// o exportador usa o DOM só para criar canvas: aqui usamos um canvas real em Node
beforeAll(() => {
  globalThis.document = { createElement: () => createCanvas(1, 1) }
})

async function makeArt(width, height) {
  // metade esquerda vermelha, metade direita azul (para conferir o espelhamento)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ff0000'
  ctx.fillRect(0, 0, width / 2, height)
  ctx.fillStyle = '#0000ff'
  ctx.fillRect(width / 2, 0, width / 2, height)

  return loadImage(canvas.toBuffer('image/png'))
}

async function setup({ mirror }) {
  const { exportSheetPng, exportSheetPdf } = await import('../src/sheet/exporter.js')

  const img = await makeArt(2480, 1122)
  const plan = planSheet({ paper: 'A4', orientation: 'portrait', artW: 210, artH: 95, margin: 0, gap: 0 })
  const placed = placeArts(plan, 0, 2)
  const items = placed.map((p) => ({ ...p, art: { img, w: 2480, h: 1122 } }))

  return { exportSheetPng, exportSheetPdf, plan, items, mirror }
}

describe('exportação do gabarito (ponta a ponta)', () => {
  it('PNG: 2480×3508 px a 300 DPI, fundo transparente e arte no lugar certo', async () => {
    const { exportSheetPng, plan, items } = await setup({ mirror: false })

    const blob = await exportSheetPng({ page: plan.page, items, dpi: 300, mirror: false, fit: 'contain' })
    const decoded = await loadImage(Buffer.from(await blob.arrayBuffer()))

    expect(decoded.width).toBe(2480)
    expect(decoded.height).toBe(3508)

    const canvas = createCanvas(decoded.width, decoded.height)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(decoded, 0, 0)

    const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data]

    // cantos fora das artes = transparentes
    expect(px(5, 5)[3]).toBe(0)
    expect(px(2470, 3500)[3]).toBe(0)

    // 2 artes de 95 mm centralizadas: topo em (297 - 190) / 2 = 53,5 mm → ~632 px
    const top = Math.round((53.5 / 25.4) * 300)

    expect(px(200, top + 50)).toEqual([255, 0, 0, 255]) // metade esquerda vermelha
    expect(px(2300, top + 50)).toEqual([0, 0, 255, 255]) // metade direita azul
    expect(px(200, top - 20)[3]).toBe(0) // acima da arte: transparente
  })

  it('PNG espelhado: as metades trocam de lado', async () => {
    const { exportSheetPng, plan, items } = await setup({ mirror: true })

    const blob = await exportSheetPng({ page: plan.page, items, dpi: 300, mirror: true, fit: 'contain' })
    const decoded = await loadImage(Buffer.from(await blob.arrayBuffer()))

    const canvas = createCanvas(decoded.width, decoded.height)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(decoded, 0, 0)

    const top = Math.round((53.5 / 25.4) * 300)
    const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data]

    expect(px(200, top + 50)).toEqual([0, 0, 255, 255]) // agora a esquerda é azul
    expect(px(2300, top + 50)).toEqual([255, 0, 0, 255]) // e a direita, vermelha
  })

  it('PDF: uma página A4 com as duas artes e transparência', async () => {
    const { exportSheetPdf, plan, items } = await setup({ mirror: false })

    const blob = await exportSheetPdf({ page: plan.page, items, dpi: 300, mirror: false, fit: 'contain', title: 'Teste' })
    const text = Buffer.from(await blob.arrayBuffer()).toString('latin1')

    expect(text.startsWith('%PDF-')).toBe(true)
    expect(text).toContain('/MediaBox [0 0 595.276 841.89]')
    expect((text.match(/\/Subtype \/Image/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(text).toContain('/Count 1')
  })

  it('600 DPI: dimensões dobram (A4 = 4961 × 7016 px)', async () => {
    const { exportSheetPng, plan, items } = await setup({ mirror: false })

    const blob = await exportSheetPng({ page: plan.page, items, dpi: 600, mirror: false, fit: 'contain' })
    const decoded = await loadImage(Buffer.from(await blob.arrayBuffer()))

    expect(decoded.width).toBe(4961)
    expect(decoded.height).toBe(7016)
  }, 60000)
})

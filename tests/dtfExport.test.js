// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { aabb, mirrorObject } from '../src/dtf/geometry.js'

beforeAll(() => {
  globalThis.document = { createElement: () => createCanvas(1, 1) }
})

async function redBlue(width, height) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ff0000'
  ctx.fillRect(0, 0, width / 2, height)
  ctx.fillStyle = '#0000ff'
  ctx.fillRect(width / 2, 0, width / 2, height)

  return loadImage(canvas.toBuffer('image/png'))
}

async function render(objects, { dpi = 300, mirror = false } = {}) {
  const { exportSheetPng, exportSheetPdf } = await import('../src/sheet/exporter.js')
  const { bakeFree } = await import('../src/sheet/bake.js')

  const page = { w: 210, h: 297 }
  const list = mirror ? objects.map((o) => mirrorObject(o, page.w)) : objects

  const items = list.map((o) => {
    const box = aabb(o)

    return { x: box.x, y: box.y, w: box.w, h: box.h, bake: (pw, ph, d) => bakeFree(o.img, o, d, pw, ph) }
  })

  const png = await exportSheetPng({ page, items, dpi })
  const pdf = await exportSheetPdf({ page, items, dpi, title: 'DTF' })
  const decoded = await loadImage(Buffer.from(await png.arrayBuffer()))

  const canvas = createCanvas(decoded.width, decoded.height)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(decoded, 0, 0)

  const mm = (v) => Math.round((v / 25.4) * dpi)
  const px = (xmm, ymm) => [...ctx.getImageData(mm(xmm), mm(ymm), 1, 1).data]

  return { decoded, px, pdf }
}

describe('exportação do gabarito DTF (ponta a ponta)', () => {
  it('objeto girado 90°: ocupa o retângulo girado e o resto fica transparente', async () => {
    const img = await redBlue(600, 400)
    // 60×40 mm girado 90° => ocupa 40×60 mm centrado em (105, 100)
    const o = { id: 'a', img, cx: 105, cy: 100, w: 60, h: 40, angle: 90, flipX: false, flipY: false }

    const { decoded, px } = await render([o])

    expect(decoded.width).toBe(2480)
    expect(decoded.height).toBe(3508)

    // girar 90° no sentido horário leva a metade esquerda (vermelha) para o TOPO
    expect(px(105, 80)).toEqual([255, 0, 0, 255])
    expect(px(105, 120)).toEqual([0, 0, 255, 255])

    // fora do retângulo girado: transparente
    expect(px(60, 100)[3]).toBe(0)
    expect(px(105, 150)[3]).toBe(0)
    expect(px(10, 10)[3]).toBe(0)
  })

  it('espelhar horizontalmente (flipX) troca os lados', async () => {
    const img = await redBlue(600, 400)
    const o = { id: 'a', img, cx: 105, cy: 60, w: 60, h: 40, angle: 0, flipX: true, flipY: false }

    const { px } = await render([o])

    expect(px(85, 60)).toEqual([0, 0, 255, 255]) // esquerda agora azul
    expect(px(125, 60)).toEqual([255, 0, 0, 255])
  })

  it('a ordem das camadas vale: o último fica por cima', async () => {
    const red = await redBlue(400, 400)
    const blueCanvas = createCanvas(400, 400)

    blueCanvas.getContext('2d').fillStyle = '#00ff00'
    blueCanvas.getContext('2d').fillRect(0, 0, 400, 400)

    const green = await loadImage(blueCanvas.toBuffer('image/png'))

    const bottom = { id: 'b', img: red, cx: 100, cy: 100, w: 60, h: 60, angle: 0, flipX: false, flipY: false }
    const top = { id: 't', img: green, cx: 110, cy: 100, w: 60, h: 60, angle: 0, flipX: false, flipY: false }

    const { px } = await render([bottom, top])

    // região de sobreposição (x 80–130): o verde está por cima
    expect(px(105, 100)).toEqual([0, 255, 0, 255])
    // parte só do de baixo (x 70–80): continua vermelha
    expect(px(75, 100)).toEqual([255, 0, 0, 255])
  })

  it('objeto parcialmente fora da folha é cortado sem erro', async () => {
    const img = await redBlue(600, 400)
    const o = { id: 'a', img, cx: 5, cy: 50, w: 60, h: 40, angle: 0, flipX: false, flipY: false } // x de -25 a 35

    const { px } = await render([o])

    expect(px(1, 50)[3]).toBe(255) // dentro da folha: visível
    expect(px(30, 50)).toEqual([0, 0, 255, 255]) // metade direita (azul) visível
    expect(px(60, 50)[3]).toBe(0)
  })

  it('espelhar a folha inteira: o objeto vai para o lado oposto', async () => {
    const img = await redBlue(600, 400)
    const o = { id: 'a', img, cx: 50, cy: 60, w: 60, h: 40, angle: 0, flipX: false, flipY: false }

    const { px } = await render([o], { mirror: true })

    expect(px(50, 60)[3]).toBe(0) // lugar de origem ficou vazio
    expect(px(160, 60)[3]).toBe(255) // 210 - 50
    // a imagem também foi invertida: o lado azul (antes à direita) agora fica à esquerda
    expect(px(140, 60)).toEqual([0, 0, 255, 255])
    expect(px(180, 60)).toEqual([255, 0, 0, 255])
  })

  it('PDF: página A4 exata com as imagens e máscara de transparência', async () => {
    const img = await redBlue(600, 400)
    const o = { id: 'a', img, cx: 105, cy: 100, w: 60, h: 40, angle: 33, flipX: false, flipY: false }

    const { pdf } = await render([o])
    const text = Buffer.from(await pdf.arrayBuffer()).toString('latin1')

    expect(text).toContain('/MediaBox [0 0 595.276 841.89]')
    expect(text).toContain('/SMask') // cantos do retângulo girado são transparentes
  })
})

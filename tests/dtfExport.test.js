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

  it('sem perda de qualidade: a 1:1 (300 DPI) cada pixel da imagem sai idêntico, sem suavizar', async () => {
    // imagem de 100×100 px com xadrez pixel a pixel (o pior caso para borrar/serrilhar)
    const size = 100
    const source = createCanvas(size, size)
    const sctx = source.getContext('2d')
    const data = sctx.createImageData(size, size)

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const on = (x + y) % 2 === 0
        const i = (y * size + x) * 4

        data.data[i] = on ? 255 : 0
        data.data[i + 1] = on ? 128 : 200
        data.data[i + 2] = on ? 0 : 255
        data.data[i + 3] = 255
      }
    }

    sctx.putImageData(data, 0, 0)

    const img = await loadImage(source.toBuffer('image/png'))

    // 100 px a 300 DPI = 8,4667 mm; canto em 10,16 mm = pixel 120
    const mmSize = (size / 300) * 25.4
    const x0mm = (120 / 300) * 25.4
    const y0mm = (200 / 300) * 25.4

    const o = { id: 'a', img, cx: x0mm + mmSize / 2, cy: y0mm + mmSize / 2, w: mmSize, h: mmSize, angle: 0, flipX: false, flipY: false }

    const { decoded } = await render([o])

    const canvas = createCanvas(decoded.width, decoded.height)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(decoded, 0, 0)

    const out = ctx.getImageData(120, 200, size, size).data
    let different = 0

    for (let i = 0; i < out.length; i += 1) {
      if (Math.abs(out[i] - data.data[i]) > 1) different += 1
    }

    expect(different).toBe(0)
  })

  it('reduzir uma imagem grande mantém a nitidez (sem serrilhado: sem "escadas" duras)', async () => {
    // linha diagonal fina em 2400×2400 px reduzida para ~15 mm (≈177 px a 300 DPI)
    const size = 2400
    const source = createCanvas(size, size)
    const sctx = source.getContext('2d')

    sctx.fillStyle = '#ffffff'
    sctx.fillRect(0, 0, size, size)
    sctx.strokeStyle = '#000000'
    sctx.lineWidth = 6
    sctx.beginPath()
    sctx.moveTo(0, 0)
    sctx.lineTo(size, size)
    sctx.stroke()

    const img = await loadImage(source.toBuffer('image/png'))

    const o = { id: 'a', img, cx: 40, cy: 40, w: 30, h: 30, angle: 0, flipX: false, flipY: false }

    const { decoded } = await render([o])

    const canvas = createCanvas(decoded.width, decoded.height)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(decoded, 0, 0)

    // a linha precisa ter tons de cinza intermediários (suavizada); serrilhado seria só preto/branco
    const x0 = Math.round((25 / 25.4) * 300)
    const y0 = Math.round((25 / 25.4) * 300)
    const side = Math.round((30 / 25.4) * 300)
    const px = ctx.getImageData(x0, y0, side, side).data

    let grays = 0
    let blackWhite = 0

    for (let i = 0; i < px.length; i += 4) {
      const v = px[i]

      if (v > 40 && v < 215) grays += 1
      else if (v <= 40 || v >= 215) blackWhite += 1
    }

    expect(grays).toBeGreaterThan(side) // há transição suave ao longo de toda a diagonal
    expect(blackWhite).toBeGreaterThan(grays)
  })
})

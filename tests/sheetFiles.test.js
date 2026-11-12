// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { encodePng } from '../src/sheet/png.js'
import { buildPdf } from '../src/sheet/pdf.js'

function solid(width, height, rgba) {
  const data = new Uint8Array(width * height * 4)

  for (let i = 0; i < width * height; i += 1) data.set(rgba, i * 4)

  return data
}

describe('PNG do gabarito', () => {
  it('gera um PNG válido com DPI, canal alfa e fundo transparente', async () => {
    const width = 40
    const height = 30

    const png = await encodePng({
      width,
      height,
      dpi: 300,
      bandRows: 7,
      rows: async (y0, count) => {
        const px = new Uint8Array(width * count * 4) // tudo transparente

        // uma "arte" vermelha opaca no meio
        for (let r = 0; r < count; r += 1) {
          const y = y0 + r

          if (y >= 10 && y < 20) {
            for (let x = 10; x < 30; x += 1) px.set([255, 0, 0, 255], (r * width + x) * 4)
          }
        }

        return px
      },
    })

    // assinatura PNG
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])

    const text = Buffer.from(png).toString('latin1')

    expect(text.includes('IHDR')).toBe(true)
    expect(text.includes('pHYs')).toBe(true)
    expect(text.includes('IEND')).toBe(true)

    // pHYs: 300 DPI = 11811 pixels por metro
    const at = text.indexOf('pHYs')
    const view = new DataView(png.buffer, png.byteOffset + at + 4, 9)

    expect(view.getUint32(0)).toBe(11811)
    expect(view.getUint32(4)).toBe(11811)
  })

  it('os pixels voltam idênticos depois de descomprimir (filtro Sub)', async () => {
    const width = 8
    const height = 5
    const original = new Uint8Array(width * height * 4)

    for (let i = 0; i < original.length; i += 1) original[i] = (i * 37) & 0xff

    const png = await encodePng({
      width,
      height,
      bandRows: 2,
      rows: async (y0, count) => original.subarray(y0 * width * 4, (y0 + count) * width * 4),
    })

    // junta os IDAT
    const parts = []
    let pos = 8

    while (pos < png.length) {
      const len = new DataView(png.buffer, png.byteOffset + pos, 4).getUint32(0)
      const type = Buffer.from(png.subarray(pos + 4, pos + 8)).toString('latin1')

      if (type === 'IDAT') parts.push(png.subarray(pos + 8, pos + 8 + len))

      pos += 12 + len
    }

    const raw = inflateSync(Buffer.concat(parts.map((p) => Buffer.from(p))))
    const stride = width * 4
    const out = new Uint8Array(width * height * 4)

    for (let y = 0; y < height; y += 1) {
      const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))

      expect(raw[y * (stride + 1)]).toBe(1)

      for (let x = 0; x < stride; x += 1) {
        out[y * stride + x] = x < 4 ? row[x] : (row[x] + out[y * stride + x - 4]) & 0xff
      }
    }

    expect([...out]).toEqual([...original])
  })
})

describe('PDF do gabarito', () => {
  it('gera um PDF com o tamanho exato da folha A4 e imagem com máscara', async () => {
    const pdf = await buildPdf({
      pageW: 210,
      pageH: 297,
      images: [
        { x: 0, y: 6, w: 210, h: 95, width: 20, height: 9, rgba: solid(20, 9, [10, 20, 30, 128]) },
        { x: 0, y: 101, w: 210, h: 95, width: 20, height: 9, rgba: solid(20, 9, [200, 100, 50, 255]) },
      ],
    })

    const text = Buffer.from(pdf).toString('latin1')

    expect(text.startsWith('%PDF-1.7')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(text).toContain('/MediaBox [0 0 595.276 841.89]')
    expect(text).toContain('/SMask') // a 1ª imagem tem transparência
    expect((text.match(/\/Subtype \/Image/g) || []).length).toBe(3) // 2 imagens + 1 máscara

    // o startxref aponta para a tabela xref
    const start = Number(text.match(/startxref\n(\d+)/)[1])

    expect(text.slice(start, start + 4)).toBe('xref')
  })
})

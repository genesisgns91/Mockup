import { createDeflater, concat } from './deflate.js'

/*
  ==========================================================
  CODIFICADOR DE PNG (RGBA 8 bits, com DPI gravado)

  • Gera o arquivo por faixas de linhas: nunca precisa de um
    canvas gigante (folhas A3 a 300 DPI passam de 17 milhões de
    pixels, mais do que muitos celulares aceitam).
  • Grava a resolução (chunk pHYs): programas de impressão
    reconhecem 300 DPI e imprimem no tamanho físico correto.
  • Mantém o canal alfa: o fundo da folha fica transparente.
  ==========================================================
*/

let crcTable = null

function crc32(bytes, start = 0, end = bytes.length) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)

    for (let n = 0; n < 256; n += 1) {
      let c = n

      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }

      crcTable[n] = c >>> 0
    }
  }

  let crc = 0xffffffff

  for (let i = start; i < end; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function u32(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length)

  out.set(u32(data.length), 0)

  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)

  out.set(data, 8)
  out.set(u32(crc32(out, 4, 8 + data.length)), 8 + data.length)

  return out
}

/*
  rows(y0, count) devolve os pixels RGBA (Uint8ClampedArray ou
  Uint8Array) das linhas y0 … y0+count-1.
*/
export async function encodePng({
  width,
  height,
  dpi = 300,
  rows,
  bandRows = 128,
  onProgress,
}) {
  const header = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = new Uint8Array(13)
  ihdr.set(u32(width), 0)
  ihdr.set(u32(height), 4)
  ihdr[8] = 8 // 8 bits por canal
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const ppm = Math.round(dpi / 0.0254)
  const phys = new Uint8Array(9)
  phys.set(u32(ppm), 0)
  phys.set(u32(ppm), 4)
  phys[8] = 1 // unidade: metro

  const deflater = createDeflater()
  const stride = width * 4

  for (let y0 = 0; y0 < height; y0 += bandRows) {
    const count = Math.min(bandRows, height - y0)
    const pixels = await rows(y0, count)

    const filtered = new Uint8Array(count * (stride + 1))

    for (let r = 0; r < count; r += 1) {
      const src = r * stride
      const dst = r * (stride + 1)

      filtered[dst] = 1 // filtro "Sub"

      for (let x = 0; x < 4 && x < stride; x += 1) {
        filtered[dst + 1 + x] = pixels[src + x]
      }

      for (let x = 4; x < stride; x += 1) {
        filtered[dst + 1 + x] = (pixels[src + x] - pixels[src + x - 4]) & 0xff
      }
    }

    await deflater.write(filtered)

    if (onProgress) onProgress(Math.min(1, (y0 + count) / height))
  }

  const compressed = concat(await deflater.finish())

  const parts = [
    header,
    chunk('IHDR', ihdr),
    chunk('pHYs', phys),
  ]

  const IDAT_SIZE = 1 << 20

  for (let pos = 0; pos < compressed.length; pos += IDAT_SIZE) {
    parts.push(chunk('IDAT', compressed.subarray(pos, pos + IDAT_SIZE)))
  }

  parts.push(chunk('IEND', new Uint8Array(0)))

  return concat(parts)
}

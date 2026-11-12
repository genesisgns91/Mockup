/*
  ==========================================================
  COMPRESSÃO ZLIB (usada no PDF e no PNG)

  Usa o CompressionStream do navegador. Se o navegador for muito
  antigo e não tiver, grava em blocos "sem compressão" — o arquivo
  fica maior, mas continua válido.
  ==========================================================
*/

const ADLER_MOD = 65521

function concat(chunks) {
  let total = 0

  for (const c of chunks) total += c.length

  const out = new Uint8Array(total)
  let offset = 0

  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }

  return out
}

export { concat }

export function createDeflater() {
  if (typeof CompressionStream === 'function') {
    const stream = new CompressionStream('deflate')
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()
    const out = []

    const pump = (async () => {
      for (;;) {
        const { value, done } = await reader.read()

        if (done) break

        out.push(value)
      }
    })()

    let chain = Promise.resolve()

    return {
      write(bytes) {
        // aguarda cada escrita para não acumular memória sem controle
        chain = chain.then(() => writer.write(bytes))

        return chain
      },
      async finish() {
        await chain
        await writer.close()
        await pump

        return out
      },
    }
  }

  // alternativa: blocos "stored" (sem compressão)
  const out = [new Uint8Array([0x78, 0x01])]
  let a = 1
  let b = 0

  return {
    async write(bytes) {
      for (let i = 0; i < bytes.length; i += 1) {
        a = (a + bytes[i]) % ADLER_MOD
        b = (b + a) % ADLER_MOD
      }

      for (let pos = 0; pos < bytes.length; pos += 65535) {
        const len = Math.min(65535, bytes.length - pos)
        const block = new Uint8Array(5 + len)

        block[0] = 0
        block[1] = len & 0xff
        block[2] = (len >>> 8) & 0xff
        block[3] = ~len & 0xff
        block[4] = (~len >>> 8) & 0xff
        block.set(bytes.subarray(pos, pos + len), 5)

        out.push(block)
      }
    },
    async finish() {
      const tail = new Uint8Array(5 + 4)

      tail[0] = 1 // bloco final vazio
      tail[1] = 0
      tail[2] = 0
      tail[3] = 0xff
      tail[4] = 0xff

      const adler = ((b << 16) | a) >>> 0

      tail[5] = (adler >>> 24) & 0xff
      tail[6] = (adler >>> 16) & 0xff
      tail[7] = (adler >>> 8) & 0xff
      tail[8] = adler & 0xff

      out.push(tail)

      return out
    },
  }
}

export async function deflate(bytes) {
  const deflater = createDeflater()

  await deflater.write(bytes)

  return concat(await deflater.finish())
}

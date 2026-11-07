import { describe, it, expect } from 'vitest'
import { collectUrls, registerUrl, getBlobForUrl, pruneUrls } from '../src/utils/imageFiles.js'

describe('imagens', () => {
  it('collectUrls reúne arte e fundo de várias fotografias', () => {
    const urls = collectUrls([
      { artZones: { a: { image: { src: 'blob:1' } }, b: { image: null } }, background: { image: 'blob:2' } },
      { artZones: {}, background: { image: null } },
      null,
    ])

    expect([...urls].sort()).toEqual(['blob:1', 'blob:2'])
  })

  it('pruneUrls libera só o que não é mais usado', () => {
    registerUrl('blob:keep', new Blob(['a']))
    registerUrl('blob:drop', new Blob(['b']))

    URL.revokeObjectURL = () => {}

    pruneUrls(new Set(['blob:keep']))

    expect(getBlobForUrl('blob:keep')).not.toBeNull()
    expect(getBlobForUrl('blob:drop')).toBeNull()
  })
})

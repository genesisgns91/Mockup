import { describe, it, expect } from 'vitest'
import { getImageLayout, clampZoom, ZOOM_MIN, ZOOM_MAX } from '../src/utils/exportLayout.js'

describe('getImageLayout', () => {
  it('imagem quadrada em quadro quadrado preenche exatamente', () => {
    expect(getImageLayout(1000, 1000, 500, 500, 'cover', 1, 0.5, 0.5))
      .toEqual({ drawW: 500, drawH: 500, x: 0, y: 0 })
  })

  it('cover em quadro paisagem corta o excesso na vertical', () => {
    const l = getImageLayout(1000, 1000, 800, 400, 'cover', 1, 0.5, 0.5)
    expect(l.drawW).toBe(800)
    expect(l.drawH).toBe(800)
    expect(l.y).toBe(-200)
  })

  it('contain mostra a imagem inteira e centraliza', () => {
    const l = getImageLayout(1000, 1000, 800, 400, 'contain', 1, 0.5, 0.5)
    expect(l).toEqual({ drawW: 400, drawH: 400, x: 200, y: 0 })
  })

  it('zoom abaixo de 100% deixa margem ao redor', () => {
    const l = getImageLayout(1000, 1000, 500, 500, 'contain', 0.5, 0.5, 0.5)
    expect(l).toEqual({ drawW: 250, drawH: 250, x: 125, y: 125 })
  })

  it('a posição (0 a 1) move a imagem dentro do excesso', () => {
    const start = getImageLayout(1000, 1000, 800, 400, 'cover', 1, 0.5, 0)
    const end = getImageLayout(1000, 1000, 800, 400, 'cover', 1, 0.5, 1)
    expect(start.y).toBeCloseTo(0)
    expect(end.y).toBe(-400)
  })

  it('zoom é limitado ao intervalo permitido', () => {
    expect(clampZoom(0)).toBe(1)
    expect(clampZoom(100)).toBe(ZOOM_MAX)
    expect(clampZoom(0.01)).toBe(ZOOM_MIN)
  })

  it('dimensões inválidas não geram NaN', () => {
    const l = getImageLayout(0, 0, 100, 100)
    expect(l.drawW).toBe(100)
    expect(Number.isNaN(l.x)).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { planSheet, placeArts, effectiveDpi } from '../src/sheet/layout.js'
import { ART_PRESETS, resolveArtSize, PAPERS, MAX_ARTS } from '../src/sheet/presets.js'

const mug = { artW: 210, artH: 95 }

describe('gabarito: cálculo da folha', () => {
  it('exemplo do pedido: caneca 210×95 em A4 cabe 3 no retrato e 2 na paisagem', () => {
    const portrait = planSheet({ paper: 'A4', orientation: 'portrait', ...mug })
    const landscape = planSheet({ paper: 'A4', orientation: 'landscape', ...mug })

    expect(portrait.capacity).toBe(3)
    expect(portrait.cols).toBe(1)
    expect(portrait.rows).toBe(3)
    expect(landscape.capacity).toBe(2)
  })

  it('no modo automático escolhe a orientação que cabe mais', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'auto', ...mug })

    expect(plan.orientation).toBe('portrait')
    expect(plan.capacity).toBe(3)
    expect(plan.fullSize).toBe(true)
  })

  it('permitir girar a arte em A4 paisagem encaixa 3 (95×210 em pé)', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'landscape', allowRotate: true, ...mug })

    expect(plan.rotated).toBe(true)
    expect(plan.capacity).toBe(3)
  })

  it('A3 comporta mais artes que A4', () => {
    const a3 = planSheet({ paper: 'A3', orientation: 'auto', ...mug })

    expect(a3.capacity).toBeGreaterThan(3)
    expect(a3.slots).toBeLessThanOrEqual(MAX_ARTS)
  })

  it('margem de 10 mm reduz a arte (aviso) mas ainda cabem 3 no retrato', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', margin: 10, ...mug })

    expect(plan.fullSize).toBe(false)
    expect(plan.scale).toBeCloseTo(190 / 210, 5)
    expect(plan.capacity).toBe(3)
  })

  it('o espaço entre artes pode reduzir a quantidade', () => {
    // 3 × 95 + 2 × 6 = 297 → cabe; 3 × 95 + 2 × 7 = 299 → não cabe
    expect(planSheet({ paper: 'A4', orientation: 'portrait', gap: 6, ...mug }).capacity).toBe(3)
    expect(planSheet({ paper: 'A4', orientation: 'portrait', gap: 7, ...mug }).capacity).toBe(2)
  })

  it('o número de espaços nunca passa de 6', () => {
    const plan = planSheet({ paper: 'A3', orientation: 'auto', artW: 40, artH: 40 })

    expect(plan.capacity).toBeGreaterThan(6)
    expect(plan.slots).toBe(MAX_ARTS)
  })

  it('arte maior que a folha é reduzida para caber uma vez', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', artW: 400, artH: 100 })

    expect(plan.fullSize).toBe(false)
    expect(plan.cw).toBeLessThanOrEqual(210)
    expect(plan.capacity).toBeGreaterThanOrEqual(1)
  })
})

describe('gabarito: posições', () => {
  it('uma arte fica centralizada na folha', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', ...mug })
    const [item] = placeArts(plan, 0, 1)

    expect(item.x + item.w / 2).toBeCloseTo(105)
    expect(item.y + item.h / 2).toBeCloseTo(148.5)
  })

  it('três artes empilhadas ficam centralizadas como conjunto', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', ...mug })
    const items = placeArts(plan, 0, 3)

    expect(items).toHaveLength(3)
    expect(items[0].y).toBeCloseTo((297 - 285) / 2)
    expect(items[2].y + items[2].h).toBeCloseTo(297 - (297 - 285) / 2)
  })

  it('nenhuma arte invade as margens nem se sobrepõe', () => {
    const margin = 8
    const gap = 3
    const plan = planSheet({ paper: 'A3', orientation: 'auto', margin, gap, artW: 90, artH: 60 })
    const items = placeArts(plan, gap, plan.slots)

    for (const a of items) {
      expect(a.x).toBeGreaterThanOrEqual(margin - 1e-6)
      expect(a.y).toBeGreaterThanOrEqual(margin - 1e-6)
      expect(a.x + a.w).toBeLessThanOrEqual(plan.page.w - margin + 1e-6)
      expect(a.y + a.h).toBeLessThanOrEqual(plan.page.h - margin + 1e-6)
    }

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i]
        const b = items[j]
        const overlap =
          a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 &&
          a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6

        expect(overlap).toBe(false)
      }
    }
  })

  it('última linha incompleta também é centralizada', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', artW: 90, artH: 60 })
    const items = placeArts(plan, 0, 3)

    const last = items[items.length - 1]
    const row = items.filter((i) => Math.abs(i.y - last.y) < 1e-6)
    const left = Math.min(...row.map((i) => i.x))
    const right = Math.max(...row.map((i) => i.x + i.w))

    expect(left + right).toBeCloseTo(210)
  })
})

describe('gabarito: medidas e resolução', () => {
  it('a medida padrão é a caneca 210×95', () => {
    expect(ART_PRESETS[0]).toMatchObject({ id: 'caneca-325', w: 210, h: 95 })
  })

  it('há no máximo 5 medidas padrão + personalizada', () => {
    expect(ART_PRESETS.length).toBeLessThanOrEqual(5)
    expect(resolveArtSize('custom', { w: 120, h: 80 })).toEqual({ w: 120, h: 80 })
    expect(resolveArtSize('custom', { w: 5, h: 9999 })).toEqual({ w: 20, h: 420 })
  })

  it('folhas A4 e A3 têm as medidas ISO', () => {
    expect(PAPERS.A4).toMatchObject({ w: 210, h: 297 })
    expect(PAPERS.A3).toMatchObject({ w: 297, h: 420 })
  })

  it('DPI efetivo: 2480×1122 px em 210×95 mm = 300 DPI', () => {
    expect(effectiveDpi(2480, 1122, 210, 95, false, 'contain')).toBeCloseTo(300, 0)
  })
})

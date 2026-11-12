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
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', marginX: 10, marginY: 10, ...mug })

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
  it('uma arte fica encostada no TOPO e centralizada na horizontal', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', ...mug })
    const [item] = placeArts(plan, 0, 1)

    expect(item.y).toBeCloseTo(0)
    expect(item.x + item.w / 2).toBeCloseTo(105)
  })

  it('duas artes ficam juntas no topo, deixando a parte de baixo livre', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', ...mug })
    const items = placeArts(plan, 0, 2)

    expect(items).toHaveLength(2)
    expect(items[0].y).toBeCloseTo(0)
    expect(items[1].y).toBeCloseTo(95)

    // sobra uma faixa livre de 297 - 190 = 107 mm embaixo (cabe outra arte de 95 mm)
    const free = 297 - (items[1].y + items[1].h)

    expect(free).toBeCloseTo(107)
    expect(free).toBeGreaterThanOrEqual(95)
  })

  it('a margem de topo define onde começam as artes', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', marginY: 8, ...mug })
    const [item] = placeArts(plan, 0, 1)

    expect(item.y).toBeCloseTo(8)
  })

  it('três artes ocupam a folha toda a partir do topo', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', ...mug })
    const items = placeArts(plan, 0, 3)

    expect(items).toHaveLength(3)
    expect(items[0].y).toBeCloseTo(0)
    expect(items[2].y + items[2].h).toBeCloseTo(285)
  })

  it('nenhuma arte invade as margens nem se sobrepõe', () => {
    const marginX = 8
    const marginY = 5
    const gap = 3
    const plan = planSheet({ paper: 'A3', orientation: 'auto', marginX, marginY, gap, artW: 90, artH: 60 })
    const items = placeArts(plan, gap, plan.slots)

    for (const a of items) {
      expect(a.x).toBeGreaterThanOrEqual(marginX - 1e-6)
      expect(a.y).toBeGreaterThanOrEqual(marginY - 1e-6)
      expect(a.x + a.w).toBeLessThanOrEqual(plan.page.w - marginX + 1e-6)
      expect(a.y + a.h).toBeLessThanOrEqual(plan.page.h - marginY + 1e-6)
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

  it('última linha incompleta é centralizada na horizontal', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', artW: 90, artH: 60 })
    const items = placeArts(plan, 0, 3)

    const last = items[items.length - 1]
    const row = items.filter((i) => Math.abs(i.y - last.y) < 1e-6)
    const left = Math.min(...row.map((i) => i.x))
    const right = Math.max(...row.map((i) => i.x + i.w))

    expect(left + right).toBeCloseTo(210)
  })
})

describe('gabarito: margens separadas', () => {
  it('margens laterais e de topo/base atuam de forma independente', () => {
    // só laterais de 10 mm: a largura útil cai para 190 mm → a arte de 210 é reduzida
    const sides = planSheet({ paper: 'A4', orientation: 'portrait', marginX: 10, marginY: 0, ...mug })

    expect(sides.fullSize).toBe(false)
    expect(sides.scale).toBeCloseTo(190 / 210, 5)

    // só topo/base de 10 mm: a largura continua 210 → tamanho real, mas cabem só 2 de altura 95 (277 mm úteis, 3×95 = 285)
    const vertical = planSheet({ paper: 'A4', orientation: 'portrait', marginX: 0, marginY: 10, gap: 0, ...mug })

    expect(vertical.fullSize).toBe(true)
    expect(vertical.capacity).toBe(2)
  })

  it('o atalho "margin" aplica o mesmo valor nos dois eixos', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', margin: 6, ...mug })

    expect(plan.marginX).toBe(6)
    expect(plan.marginY).toBe(6)
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

import { describe, it, expect } from 'vitest'
import { planSheet, placeArts, effectiveDpi, aspectMismatch } from '../src/sheet/layout.js'
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

    // só topo/base de 10 mm: a largura continua 210, mas a altura útil (277 mm) reduz a arte
    // (277 / 285) em vez de perder uma arte ou mudar o arranjo
    const vertical = planSheet({ paper: 'A4', orientation: 'portrait', marginX: 0, marginY: 10, gap: 0, ...mug })

    expect(vertical.capacity).toBe(3)
    expect(vertical.scale).toBeCloseTo(277 / 285, 5)
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


describe('gabarito: aproveitamento máximo da folha (espaço de 1 mm + redução de até 1 mm)', () => {
  const art = { artW: 210, artH: 95, gap: 1 }

  it('A3 em paisagem comporta 6 artes de 210×95 (2 colunas × 3 linhas)', () => {
    const plan = planSheet({ paper: 'A3', orientation: 'landscape', ...art })

    expect(plan.capacity).toBe(6)
    expect(plan.cols).toBe(2)
    expect(plan.rows).toBe(3)
  })

  it('a redução necessária para o espaço de 1 mm é pequena (até 1 mm) e sem aviso', () => {
    const plan = planSheet({ paper: 'A3', orientation: 'landscape', ...art })

    expect(plan.scale).toBeLessThan(1)
    expect(plan.shrinkMM).toBeGreaterThan(0)
    expect(plan.shrinkMM).toBeLessThanOrEqual(1 + 1e-9)
    expect(plan.fullSize).toBe(true)
  })

  it('com margem zero as artes encostam nas bordas da folha', () => {
    const plan = planSheet({ paper: 'A3', orientation: 'landscape', ...art })
    const items = placeArts(plan, 1, 6)

    const left = Math.min(...items.map((i) => i.x))
    const right = Math.max(...items.map((i) => i.x + i.w))
    const top = Math.min(...items.map((i) => i.y))

    expect(left).toBeCloseTo(0, 6)
    expect(right).toBeCloseTo(420, 6)
    expect(top).toBeCloseTo(0, 6)
  })

  it('há exatamente 1 mm entre uma arte e outra', () => {
    const plan = planSheet({ paper: 'A3', orientation: 'landscape', ...art })
    const items = placeArts(plan, 1, 6)
    const first = items[0]
    const second = items[1]

    expect(second.x - (first.x + first.w)).toBeCloseTo(1, 6)
  })

  it('A3 em retrato girando as artes também comporta 6 (3 colunas × 2 linhas)', () => {
    const plan = planSheet({ paper: 'A3', orientation: 'portrait', allowRotate: true, ...art })

    expect(plan.capacity).toBe(6)
    expect(plan.rotated).toBe(true)
  })

  it('A4 em paisagem girando as artes comporta 3', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'landscape', allowRotate: true, ...art })

    expect(plan.capacity).toBe(3)
    expect(plan.rotated).toBe(true)
  })

  it('A4 não passa de 3 artes de 210×95 (a área da folha não permite 4)', () => {
    for (const orientation of ['auto', 'portrait', 'landscape']) {
      const plan = planSheet({ paper: 'A4', orientation, allowRotate: true, ...art })

      expect(plan.capacity).toBeLessThanOrEqual(3)
    }
  })

  it('no automático escolhe a melhor combinação (A3 → 6) e prefere não girar quando empata', () => {
    const plan = planSheet({ paper: 'A3', orientation: 'auto', allowRotate: true, ...art })

    expect(plan.capacity).toBe(6)
    expect(plan.rotated).toBe(false)
    expect(plan.orientation).toBe('landscape')
  })

  it('A4 em retrato continua em tamanho real (100%) com 1 mm entre as artes', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', ...art })

    expect(plan.capacity).toBe(3)
    expect(plan.scale).toBe(1)
  })

  it('redução maior que 1 mm (margens grandes) continua sendo avisada', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', marginX: 10, ...art })

    expect(plan.fullSize).toBe(false)
    expect(plan.scale).toBeCloseTo(190 / 210, 5)
  })
})

describe('gabarito: proporção da arte e encaixe', () => {
  it('detecta a diferença de proporção entre a arte e a medida', () => {
    expect(aspectMismatch(2100, 950, 210, 95, false)).toBeCloseTo(0, 5)
    expect(aspectMismatch(2070, 1000, 210, 95, false)).toBeGreaterThan(0.05)
  })

  it('esticar usa o eixo mais esticado para o DPI', () => {
    const dpi = effectiveDpi(2000, 1000, 210, 95, false, 'stretch')

    expect(dpi).toBeCloseTo(25.4 / Math.max(210 / 2000, 95 / 1000), 4)
  })
})

describe('gabarito: a margem reduz a arte sem mudar o arranjo', () => {
  const art = { artW: 210, artH: 95, gap: 1, allowRotate: true }

  it('em A4, de 0 a 10 mm de margem o arranjo é o mesmo e a largura da arte = 210 − 2 × margem', () => {
    for (const m of [0, 3, 6, 10]) {
      const plan = planSheet({ paper: 'A4', orientation: 'auto', marginX: m, marginY: m, ...art })
      const items = placeArts(plan, 1, plan.slots)

      expect(plan.orientation).toBe('portrait')
      expect(plan.capacity).toBe(3)
      expect(plan.rotated).toBe(false)
      expect(plan.cw).toBeCloseTo(210 - 2 * m, 5)

      // a arte começa na margem (lateral e de topo)
      expect(items[0].x).toBeCloseTo(m, 5)
      expect(items[0].y).toBeCloseTo(m, 5)
    }
  })

  it('margem 0: arte do tamanho original encostada nas bordas', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'auto', marginX: 0, marginY: 0, ...art })

    expect(plan.scale).toBe(1)
    expect(placeArts(plan, 1, 1)[0].x).toBeCloseTo(0)
  })

  it('em A3 as 6 artes continuam 6 em qualquer margem de 0 a 10 mm', () => {
    for (const m of [0, 3, 10]) {
      const plan = planSheet({ paper: 'A3', orientation: 'auto', marginX: m, marginY: m, ...art })

      expect(plan.capacity).toBe(6)
      expect(plan.orientation).toBe('landscape')
    }
  })

  it('as margens laterais e de topo/base atuam separadas no tamanho da arte', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', marginX: 10, marginY: 0, ...art })

    expect(plan.cw).toBeCloseTo(190, 5) // limitado pela largura
    expect(plan.capacity).toBe(3)
  })

  it('o padrão de impressão: 3 mm em cada lado deixa a arte com 204 × 92,3 mm', () => {
    const plan = planSheet({ paper: 'A4', orientation: 'portrait', marginX: 3, marginY: 3, ...art })

    expect(plan.cw).toBeCloseTo(204, 5)
    expect(plan.ch).toBeCloseTo(92.286, 2)
  })
})


import { describe, it, expect } from 'vitest'
import {
  aabb, resizeFromHandle, rotateFromPointer, normalizeAngle, snapBox, snapLines,
  effectiveDpi, sizeAtDpi, alignToPage, withBoxPosition, mirrorObject, outsidePage, localToWorld, worldToLocal,
} from '../src/dtf/geometry.js'
import { placeNew, arrangeAll } from '../src/dtf/packing.js'
import { visibleOverlap, findOverlaps, solidMask, visibleAt } from '../src/dtf/overlap.js'

const obj = (p = {}) => ({ id: 'a', cx: 100, cy: 100, w: 60, h: 40, angle: 0, flipX: false, flipY: false, nw: 1200, nh: 800, ...p })
const page = { w: 210, h: 297 }

describe('geometria', () => {
  it('retângulo envolvente de um objeto girado 90° troca largura e altura', () => {
    const b = aabb(obj({ angle: 90 }))

    expect(b.w).toBeCloseTo(40)
    expect(b.h).toBeCloseTo(60)
  })

  it('ida e volta entre coordenadas locais e da folha', () => {
    const o = obj({ angle: 33 })
    const w = localToWorld(o, 10, -5)
    const l = worldToLocal(o, w.x, w.y)

    expect(l.x).toBeCloseTo(10)
    expect(l.y).toBeCloseTo(-5)
  })

  it('ângulos ficam entre -180 e 180', () => {
    expect(normalizeAngle(190)).toBe(-170)
    expect(normalizeAngle(-190)).toBe(170)
    expect(normalizeAngle(360)).toBe(0)
  })

  it('alça do canto redimensiona proporcionalmente e mantém o canto oposto fixo', () => {
    const o = obj() // 60×40, centro (100,100): canto sup. esq. = (70, 80)
    const r = resizeFromHandle(o, 'se', { x: 190, y: 160 }, { lock: true })

    // canto oposto (nw) permanece em (70, 80)
    expect(r.cx - r.w / 2).toBeCloseTo(70)
    expect(r.cy - r.h / 2).toBeCloseTo(80)
    expect(r.w / r.h).toBeCloseTo(60 / 40)
    expect(r.w).toBeGreaterThan(60)
  })

  it('Shift no canto deforma livremente', () => {
    const r = resizeFromHandle(obj(), 'se', { x: 190, y: 120 }, { free: true })

    expect(r.w).toBeCloseTo(120)
    expect(r.h).toBeCloseTo(40)
  })

  it('alça lateral estica só um eixo (sem trava) e mantém a borda oposta', () => {
    const r = resizeFromHandle(obj(), 'e', { x: 150, y: 100 }, { lock: false })

    expect(r.w).toBeCloseTo(80) // de 70 até 150
    expect(r.h).toBeCloseTo(40)
    expect(r.cx - r.w / 2).toBeCloseTo(70)
  })

  it('redimensionar um objeto girado funciona no eixo do objeto', () => {
    const o = obj({ angle: 90, w: 60, h: 40 })
    // girado 90°: a alça "e" aponta para baixo (+y da folha)
    const r = resizeFromHandle(o, 'e', { x: 100, y: 150 }, { lock: false })

    // a borda "w" (oposta) está em y = 100 - 30 = 70; a nova borda em 150 → w = 80
    expect(r.w).toBeCloseTo(80)
    expect(r.cy - r.w / 2).toBeCloseTo(70)
    expect(r.cx).toBeCloseTo(100)
  })

  it('nunca fica menor que o tamanho mínimo', () => {
    const r = resizeFromHandle(obj(), 'se', { x: 70, y: 80 }, { lock: true })

    expect(r.w).toBeGreaterThanOrEqual(2)
    expect(r.h).toBeGreaterThanOrEqual(2)
  })

  it('girar pelo ponteiro soma a diferença de ângulo; Shift prende em 15°', () => {
    const c = { x: 100, y: 100 }
    const angle = rotateFromPointer(0, c, { x: 100, y: 0 }, { x: 200, y: 100 })

    expect(angle).toBeCloseTo(90)

    const snapped = rotateFromPointer(0, c, { x: 100, y: 0 }, { x: 160, y: 20 }, true)

    expect(snapped % 15).toBeCloseTo(0)
  })

  it('ímã: encosta na borda da folha quando está perto', () => {
    const moving = { x: 1.2, y: 50, w: 30, h: 30, r: 31.2, b: 80 }
    const snap = snapBox(moving, snapLines(page, 0, []), 2)

    expect(snap.dx).toBeCloseTo(-1.2)
    expect(snap.guides.x).toBe(0)
    expect(snap.dy).toBe(0) // longe de qualquer linha em y
  })

  it('ímã: alinha o centro com outro objeto', () => {
    const other = obj({ cx: 150, cy: 200 })
    const moving = { x: 120, y: 100, w: 60, h: 40, r: 180, b: 140 } // centro x = 150
    const snap = snapBox({ ...moving, x: 121, r: 181 }, snapLines(page, 0, [other]), 2)

    expect(snap.dx).toBeCloseTo(-1)
  })

  it('DPI efetivo: 2480 px em 210 mm = 300 DPI; reduzir à metade dobra o DPI', () => {
    const o = { nw: 2480, nh: 1122, w: 210, h: 95.0 }

    expect(effectiveDpi(o)).toBeCloseTo(300, 0)
    expect(effectiveDpi({ ...o, w: 105, h: 47.5 })).toBeCloseTo(600, 0)
  })

  it('tamanho em que a imagem fica com 300 DPI', () => {
    const s = sizeAtDpi(2480, 1122, 300)

    expect(s.w).toBeCloseTo(210, 0)
    expect(s.h).toBeCloseTo(95, 0)
  })

  it('alinhar à folha e posicionar pelo canto do retângulo envolvente', () => {
    const o = obj()

    expect(aabb(alignToPage(o, page, 'left')).x).toBeCloseTo(0)
    expect(aabb(alignToPage(o, page, 'right')).r).toBeCloseTo(210)
    expect(aabb(alignToPage(o, page, 'top')).y).toBeCloseTo(0)
    expect(aabb(alignToPage(o, page, 'bottom')).b).toBeCloseTo(297)

    const c = aabb(alignToPage(o, page, 'centerX'))

    expect(c.x + c.w / 2).toBeCloseTo(105)

    const moved = aabb(withBoxPosition(obj({ angle: 45 }), 10, 20))

    expect(moved.x).toBeCloseTo(10)
    expect(moved.y).toBeCloseTo(20)
  })

  it('espelhar a folha inverte posição, ângulo e vira o objeto', () => {
    const m = mirrorObject(obj({ cx: 50, angle: 30 }), 210)

    expect(m.cx).toBe(160)
    expect(m.angle).toBe(-30)
    expect(m.flipX).toBe(true)
  })

  it('detecta objeto (parcialmente) fora da folha', () => {
    expect(outsidePage(obj({ cx: 100 }), page)).toBe(false)
    expect(outsidePage(obj({ cx: 5 }), page)).toBe(true)
  })
})

describe('distribuição automática', () => {
  it('várias imagens são distribuídas pela folha sem sobrepor', () => {
    const items = Array.from({ length: 6 }, () => ({ w: 90, h: 60 }))
    const spots = placeNew(items, [], page, { margin: 5, gap: 4 })

    expect(spots.every((s) => !s.overflow)).toBe(true)

    const boxes = spots.map((s) => ({ x: s.cx - s.w / 2, y: s.cy - s.h / 2, r: s.cx + s.w / 2, b: s.cy + s.h / 2 }))

    for (let i = 0; i < boxes.length; i += 1) {
      expect(boxes[i].x).toBeGreaterThanOrEqual(5 - 1e-6)
      expect(boxes[i].r).toBeLessThanOrEqual(205 + 1e-6)

      for (let j = i + 1; j < boxes.length; j += 1) {
        const overlap = boxes[i].x < boxes[j].r && boxes[j].x < boxes[i].r && boxes[i].y < boxes[j].b && boxes[j].y < boxes[i].b

        expect(overlap).toBe(false)
      }
    }
  })

  it('começa pelo topo da folha', () => {
    const [first] = placeNew([{ w: 50, h: 50 }], [], page, { margin: 5 })

    expect(first.cy - first.h / 2).toBeCloseTo(5)
  })

  it('respeita imagens que já estão na folha', () => {
    const existing = [obj({ cx: 105, cy: 40, w: 200, h: 60 })] // faixa de cima ocupada
    const [spot] = placeNew([{ w: 50, h: 50 }], existing, page, { margin: 5, gap: 4 })

    expect(spot.cy - spot.h / 2).toBeGreaterThanOrEqual(70 + 4 - 1e-6)
  })

  it('reduz a imagem quando ela não cabe no tamanho original', () => {
    const [spot] = placeNew([{ w: 500, h: 100 }], [], page, { margin: 5 })

    expect(spot.w).toBeLessThanOrEqual(200 + 1e-6)
    expect(spot.scale).toBeLessThan(1)
  })

  it('"organizar tudo" reduz todos juntos quando não cabem', () => {
    const many = Array.from({ length: 12 }, (_, i) => obj({ id: `o${i}`, w: 100, h: 100 }))
    const arranged = arrangeAll(many, page, { margin: 5, gap: 4 })

    expect(arranged).not.toBeNull()
    expect(arranged[0].w).toBeLessThan(100)
    expect(arranged.every((o) => aabb(o).r <= 205 + 1e-6 && aabb(o).b <= 292 + 1e-6)).toBe(true)
  })
})

describe('sobreposição que ignora o fundo transparente', () => {
  const a = obj({ id: 'a', cx: 50, cy: 50, w: 40, h: 40 })

  it('caixas que se cruzam com imagem opaca = sobreposição', () => {
    const b = obj({ id: 'b', cx: 70, cy: 50, w: 40, h: 40 })

    expect(visibleOverlap(a, b, solidMask(), solidMask())).toBe(true)
  })

  it('objetos afastados não se sobrepõem', () => {
    const b = obj({ id: 'b', cx: 150, cy: 50, w: 40, h: 40 })

    expect(visibleOverlap(a, b, solidMask(), solidMask())).toBe(false)
  })

  it('caixas se cruzam, mas a parte que se cruza é transparente = SEM aviso', () => {
    // figura só na metade ESQUERDA de "a" e só na metade DIREITA de "b"
    const w = 16
    const left = new Uint8Array(w * w)
    const right = new Uint8Array(w * w)

    for (let y = 0; y < w; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (x < w / 2) left[y * w + x] = 1
        else right[y * w + x] = 1
      }
    }

    // "b" está logo à direita, com a caixa invadindo 10 mm de "a" (a visível de "a" é a metade esquerda)
    const b = obj({ id: 'b', cx: 80, cy: 50, w: 40, h: 40 }) // caixa: 60..100; a: 30..70
    const maskA = { w, h: w, data: left } // figura em 30..50
    const maskB = { w, h: w, data: right } // figura em 80..100

    expect(visibleOverlap(a, b, maskA, maskB)).toBe(false)

    // se a figura de "a" ocupasse a metade direita (50..70) e a de "b" a esquerda (60..80), há sobreposição
    expect(visibleOverlap(a, b, { w, h: w, data: right }, { w, h: w, data: left })).toBe(true)
  })

  it('espelhar (flip) muda onde está a parte visível', () => {
    const w = 16
    const rightHalf = new Uint8Array(w * w)

    for (let y = 0; y < w; y += 1) for (let x = w / 2; x < w; x += 1) rightHalf[y * w + x] = 1

    const mask = { w, h: w, data: rightHalf }
    const o = obj({ id: 'o', cx: 50, cy: 50, w: 40, h: 40 })

    expect(visibleAt(o, mask, 60, 50)).toBe(true) // metade direita visível
    expect(visibleAt(o, mask, 40, 50)).toBe(false)
    expect(visibleAt({ ...o, flipX: true }, mask, 40, 50)).toBe(true) // espelhado: passa para a esquerda
  })

  it('imagens giradas também são testadas', () => {
    const b = obj({ id: 'b', cx: 85, cy: 50, w: 60, h: 10, angle: 90 }) // em pé: ocupa x 80–90, y 20–80
    const c = obj({ id: 'c', cx: 88, cy: 50, w: 8, h: 8 })

    expect(visibleOverlap(a, b, solidMask(), solidMask())).toBe(false) // a vai até x=70
    expect(visibleOverlap(b, c, solidMask(), solidMask())).toBe(true)
  })

  it('findOverlaps devolve os pares (por id)', () => {
    const items = [
      obj({ id: 'x', cx: 40, cy: 40, w: 30, h: 30 }),
      obj({ id: 'y', cx: 55, cy: 40, w: 30, h: 30 }),
      obj({ id: 'z', cx: 160, cy: 200, w: 30, h: 30 }),
    ]

    expect(findOverlaps(items, new Map())).toEqual([['x', 'y']])
  })
})

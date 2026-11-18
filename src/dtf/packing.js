import { aabb } from './geometry.js'

/*
  ==========================================================
  DISTRIBUIÇÃO AUTOMÁTICA PELA FOLHA

  Encaixa cada imagem no primeiro canto livre (começando pelo topo,
  da esquerda para a direita), respeitando o que já está na folha.

  Várias imagens GRANDES: se não couberem juntas, TODAS são reduzidas na
  mesma proporção, na maior escala em que ainda cabem sem se sobrepor
  (busca binária). Uma imagem pode ser girada 90° se isso ajudar a caber.
  ==========================================================
*/

const EPS = 1e-6

function intersectsAny(rect, placed, gap) {
  for (const p of placed) {
    if (
      rect.x < p.r + gap - EPS &&
      rect.r + gap > p.x + EPS &&
      rect.y < p.b + gap - EPS &&
      rect.b + gap > p.y + EPS
    ) {
      return true
    }
  }

  return false
}

/*
  Candidatos a canto: a margem e o "depois de" cada item já colocado
  (à direita e abaixo dele). Isso encaixa as peças bem juntas.
*/
function findSpot(w, h, placed, page, margin, gap) {
  const maxX = page.w - margin - w
  const maxY = page.h - margin - h

  if (maxX < margin - EPS || maxY < margin - EPS) return null

  const xs = new Set([margin])
  const ys = new Set([margin])

  for (const p of placed) {
    xs.add(p.r + gap)
    ys.add(p.b + gap)
  }

  const sortedY = [...ys].filter((y) => y <= maxY + EPS).sort((a, b) => a - b)
  const sortedX = [...xs].filter((x) => x <= maxX + EPS).sort((a, b) => a - b)

  for (const y of sortedY) {
    for (const x of sortedX) {
      const rect = { x, y, w, h, r: x + w, b: y + h }

      if (!intersectsAny(rect, placed, gap)) return rect
    }
  }

  return null
}

/*
  items: [{ w, h }] (tamanho em mm, sem giro)
  existing: objetos já na folha (não podem ser cobertos)
  devolve, na mesma ordem: [{ cx, cy, w, h, angle, scale, overflow }]
*/
export function placeNew(
  items,
  existing,
  page,
  { margin = 5, gap = 4, minScale = 0.08, allowRotate = true } = {}
) {
  const base = existing.map((o) => aabb(o))

  const availW = page.w - 2 * margin
  const availH = page.h - 2 * margin

  // cada imagem, no mínimo, precisa caber sozinha na área útil
  const cap = items.map((it) => Math.min(1, availW / it.w, availH / it.h))

  // maiores primeiro encaixam melhor; o resultado volta na ordem original
  const order = items
    .map((_, i) => i)
    .sort((a, b) => items[b].w * items[b].h - items[a].w * items[a].h)

  const attempt = (factor) => {
    const placed = [...base]
    const out = new Array(items.length)

    for (const index of order) {
      const s = cap[index] * factor
      const w = items[index].w * s
      const h = items[index].h * s

      let spot = findSpot(w, h, placed, page, margin, gap)
      let rotated = false

      if (!spot && allowRotate) {
        spot = findSpot(h, w, placed, page, margin, gap)
        rotated = Boolean(spot)
      }

      if (!spot) return null

      placed.push(spot)

      out[index] = {
        cx: spot.x + spot.w / 2,
        cy: spot.y + spot.h / 2,
        w,
        h,
        angle: rotated ? 90 : 0,
        scale: s,
        overflow: false,
      }
    }

    return out
  }

  let result = attempt(1)

  if (!result) {
    // maior fator comum que ainda cabe tudo
    let lo = minScale
    let hi = 1
    let best = attempt(lo)

    if (best) {
      for (let i = 0; i < 14; i += 1) {
        const mid = (lo + hi) / 2
        const tried = attempt(mid)

        if (tried) {
          lo = mid
          best = tried
        } else {
          hi = mid
        }
      }

      result = best
    }
  }

  if (result) return result

  // não coube nem no menor tamanho: empilha no canto (haverá sobreposição, que é avisada)
  return items.map((it, i) => {
    const s = Math.max(minScale, cap[i])
    const w = it.w * s
    const h = it.h * s

    return { cx: margin + w / 2, cy: margin + h / 2, w, h, angle: 0, scale: s, overflow: true }
  })
}

/*
  Reorganiza TODOS os objetos mantendo giro e proporções: se não couberem,
  reduz todos juntos na mesma proporção até caberem.
*/
export function arrangeAll(objects, page, { margin = 5, gap = 4 } = {}) {
  if (!objects.length) return []

  const sizes = objects.map((o) => {
    const b = aabb(o)

    return { w: b.w, h: b.h }
  })

  const spots = placeNew(sizes, [], page, { margin, gap, minScale: 0.08, allowRotate: false })

  if (spots.some((s) => s.overflow)) return null

  return objects.map((o, i) => {
    const b = aabb(o)
    const k = spots[i].w / b.w

    return { ...o, cx: spots[i].cx, cy: spots[i].cy, w: o.w * k, h: o.h * k }
  })
}

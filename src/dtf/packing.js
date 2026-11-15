import { aabb } from './geometry.js'

/*
  ==========================================================
  DISTRIBUIÇÃO AUTOMÁTICA PELA FOLHA

  Procura, da esquerda para a direita e de cima para baixo, o
  primeiro espaço livre para cada imagem (respeitando as que já
  estão na folha). Se não couber, reduz a imagem aos poucos.
  ==========================================================
*/

function intersectsAny(rect, placed, gap) {
  for (const p of placed) {
    if (
      rect.x < p.r + gap &&
      rect.r + gap > p.x &&
      rect.y < p.b + gap &&
      rect.b + gap > p.y
    ) {
      return true
    }
  }

  return false
}

function findSpot(w, h, placed, page, margin, gap, step) {
  const maxX = page.w - margin - w
  const maxY = page.h - margin - h

  if (maxX < margin - 1e-6 || maxY < margin - 1e-6) return null

  for (let y = margin; y <= maxY + 1e-6; y += step) {
    for (let x = margin; x <= maxX + 1e-6; x += step) {
      const rect = { x, y, w, h, r: x + w, b: y + h }

      if (!intersectsAny(rect, placed, gap)) return rect
    }
  }

  return null
}

/*
  items: [{ w, h }] (tamanhos em mm, sem rotação)
  existing: objetos já na folha (para não sobrepor)
  devolve, na mesma ordem: [{ cx, cy, w, h, scale, overflow }]
*/
export function placeNew(items, existing, page, { margin = 5, gap = 4, step = 3, minScale = 0.25 } = {}) {
  const placed = existing.map((o) => aabb(o))
  const out = new Array(items.length)

  // maiores primeiro (encaixa melhor), mas devolve na ordem original
  const order = items.map((_, i) => i).sort((a, b) => items[b].w * items[b].h - items[a].w * items[a].h)

  const availW = page.w - 2 * margin
  const availH = page.h - 2 * margin

  for (const index of order) {
    const item = items[index]

    let scale = Math.min(1, availW / item.w, availH / item.h)
    let spot = null

    while (scale >= minScale - 1e-9) {
      spot = findSpot(item.w * scale, item.h * scale, placed, page, margin, gap, step)

      if (spot) break

      scale *= 0.9
    }

    if (spot) {
      placed.push(spot)

      out[index] = {
        cx: spot.x + spot.w / 2,
        cy: spot.y + spot.h / 2,
        w: spot.w,
        h: spot.h,
        scale: spot.w / item.w,
        overflow: false,
      }
    } else {
      // sem espaço mesmo reduzida: coloca no canto (haverá sobreposição, que é avisada)
      const s = Math.max(minScale, Math.min(1, availW / item.w, availH / item.h))
      const w = item.w * s
      const h = item.h * s

      out[index] = { cx: margin + w / 2, cy: margin + h / 2, w, h, scale: s, overflow: true }
    }
  }

  return out
}

/*
  Reorganiza TODOS os objetos (mantendo os tamanhos): se não couberem,
  reduz todos juntos na mesma proporção até caberem.
*/
export function arrangeAll(objects, page, { margin = 5, gap = 4 } = {}) {
  let factor = 1

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const sizes = objects.map((o) => {
      const b = aabb(o)

      return { w: b.w * factor, h: b.h * factor }
    })

    const spots = placeNew(sizes, [], page, { margin, gap, minScale: 0.999 })

    if (spots.every((s) => !s.overflow)) {
      return objects.map((o, i) => {
        const b = aabb(o)
        const k = spots[i].w / b.w

        return { ...o, cx: spots[i].cx, cy: spots[i].cy, w: o.w * k, h: o.h * k }
      })
    }

    factor *= 0.92
  }

  return null
}

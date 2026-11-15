import { aabb, boxesIntersect, localToWorld, worldToLocal } from './geometry.js'

/*
  ==========================================================
  SOBREPOSIÇÃO REAL (sem contar o fundo transparente)

  Cada imagem tem uma "máscara" de baixa resolução com os pontos
  visíveis (opacos). Duas imagens só contam como sobrepostas se
  algum ponto VISÍVEL de uma cair sobre um ponto VISÍVEL da outra
  — então figuras recortadas (PNG com fundo transparente) que
  apenas têm a "caixa" encostada não geram aviso.
  ==========================================================
*/

export const MASK_SIDE = 96
const ALPHA_VISIBLE = 24
const MIN_CELLS = 3

/* máscara a partir do canal alfa (array RGBA) */
export function maskFromRgba(rgba, width, height) {
  const data = new Uint8Array(width * height)

  for (let i = 0; i < data.length; i += 1) {
    data[i] = rgba[i * 4 + 3] > ALPHA_VISIBLE ? 1 : 0
  }

  return { w: width, h: height, data }
}

/* máscara totalmente opaca (imagem sem transparência) */
export function solidMask(width = 8, height = 8) {
  return { w: width, h: height, data: new Uint8Array(width * height).fill(1) }
}

/* o ponto (x, y) da folha cai sobre uma parte visível do objeto? */
export function visibleAt(o, mask, x, y) {
  const p = worldToLocal(o, x, y)

  if (Math.abs(p.x) > o.w / 2 || Math.abs(p.y) > o.h / 2) return false

  if (!mask) return true

  let u = p.x / o.w + 0.5
  let v = p.y / o.h + 0.5

  if (o.flipX) u = 1 - u
  if (o.flipY) v = 1 - v

  const ix = Math.min(mask.w - 1, Math.max(0, Math.floor(u * mask.w)))
  const iy = Math.min(mask.h - 1, Math.max(0, Math.floor(v * mask.h)))

  return mask.data[iy * mask.w + ix] === 1
}

function countOverlap(a, maskA, b, maskB) {
  let count = 0

  for (let iy = 0; iy < maskA.h; iy += 1) {
    for (let ix = 0; ix < maskA.w; ix += 1) {
      if (!maskA.data[iy * maskA.w + ix]) continue

      let u = (ix + 0.5) / maskA.w
      let v = (iy + 0.5) / maskA.h

      if (a.flipX) u = 1 - u
      if (a.flipY) v = 1 - v

      const world = localToWorld(a, (u - 0.5) * a.w, (v - 0.5) * a.h)

      if (visibleAt(b, maskB, world.x, world.y)) {
        count += 1

        if (count >= MIN_CELLS) return count
      }
    }
  }

  return count
}

export function visibleOverlap(a, b, maskA, maskB) {
  if (!boxesIntersect(aabb(a), aabb(b))) return false

  const ma = maskA || solidMask()
  const mb = maskB || solidMask()

  return countOverlap(a, ma, b, mb) >= MIN_CELLS || countOverlap(b, mb, a, ma) >= MIN_CELLS
}

/* pares de objetos (por id) que se sobrepõem de verdade */
export function findOverlaps(objects, masks) {
  const pairs = []

  for (let i = 0; i < objects.length; i += 1) {
    for (let j = i + 1; j < objects.length; j += 1) {
      const a = objects[i]
      const b = objects[j]

      if (visibleOverlap(a, b, masks.get(a.id), masks.get(b.id))) {
        pairs.push([a.id, b.id])
      }
    }
  }

  return pairs
}

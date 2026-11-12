import { MAX_ARTS, PAPERS } from './presets.js'

/*
  ==========================================================
  CÁLCULO DO GABARITO

  Dada a folha, a medida da arte, as margens e o espaço entre
  artes, descobre a melhor orientação da folha e quantas artes
  cabem. A medida real da arte é sempre respeitada: só é
  reduzida (com aviso) quando não cabe nem uma única vez.
  ==========================================================
*/

const EPS = 1e-6

function paperDims(paperId, orientation) {
  const paper = PAPERS[paperId] || PAPERS.A4
  const short = Math.min(paper.w, paper.h)
  const long = Math.max(paper.w, paper.h)

  return orientation === 'landscape'
    ? { w: long, h: short }
    : { w: short, h: long }
}

function evaluate(paperId, orientation, rotated, art, margin, gap) {
  const page = paperDims(paperId, orientation)

  const baseW = rotated ? art.h : art.w
  const baseH = rotated ? art.w : art.h

  const availW = page.w - 2 * margin
  const availH = page.h - 2 * margin

  if (availW <= 0 || availH <= 0 || baseW <= 0 || baseH <= 0) return null

  const scale = Math.min(1, availW / baseW, availH / baseH)

  const cw = baseW * scale
  const ch = baseH * scale

  const cols = Math.max(1, Math.floor((availW + gap + EPS) / (cw + gap)))
  const rows = Math.max(1, Math.floor((availH + gap + EPS) / (ch + gap)))

  return {
    page,
    orientation,
    rotated,
    scale,
    cw,
    ch,
    cols,
    rows,
    capacity: cols * rows,
    fullSize: scale >= 1 - EPS,
  }
}

function better(a, b) {
  if (!b) return true

  if (a.fullSize !== b.fullSize) return a.fullSize

  if (a.fullSize) {
    if (a.capacity !== b.capacity) return a.capacity > b.capacity
  } else {
    if (Math.abs(a.scale - b.scale) > EPS) return a.scale > b.scale
    if (a.capacity !== b.capacity) return a.capacity > b.capacity
  }

  if (a.rotated !== b.rotated) return !a.rotated

  return a.orientation === 'portrait' && b.orientation !== 'portrait'
}

/*
  Escolhe a melhor combinação de orientação da folha e giro da arte.
*/
export function planSheet({
  paper = 'A4',
  orientation = 'auto',
  artW,
  artH,
  margin = 0,
  gap = 0,
  allowRotate = false,
}) {
  const art = { w: artW, h: artH }
  const orientations =
    orientation === 'auto' ? ['portrait', 'landscape'] : [orientation]
  const rotations = allowRotate ? [false, true] : [false]

  let best = null

  for (const o of orientations) {
    for (const r of rotations) {
      const candidate = evaluate(paper, o, r, art, margin, gap)

      if (candidate && better(candidate, best)) best = candidate
    }
  }

  if (!best) {
    const page = paperDims(paper, orientation === 'landscape' ? 'landscape' : 'portrait')

    return {
      page,
      orientation: 'portrait',
      rotated: false,
      scale: 1,
      cw: 0,
      ch: 0,
      cols: 0,
      rows: 0,
      capacity: 0,
      slots: 0,
      fullSize: false,
      invalid: true,
    }
  }

  return { ...best, slots: Math.min(MAX_ARTS, best.capacity), invalid: false }
}

/*
  Escolhe quantas colunas usar para N artes (menos espaços vazios,
  preferindo mais colunas) respeitando as linhas disponíveis.
*/
function pickColumns(count, cols, rows) {
  let best = 1
  let bestEmpty = Infinity

  for (let c = Math.min(cols, count); c >= 1; c -= 1) {
    const r = Math.ceil(count / c)

    if (r > rows) continue

    const empty = c * r - count

    if (empty < bestEmpty) {
      best = c
      bestEmpty = empty
    }
  }

  return best
}

/*
  Posições (em mm, origem no canto superior esquerdo da folha) das
  primeiras `count` artes: o conjunto fica centralizado na folha e
  a última linha, se incompleta, também é centralizada.
*/
export function placeArts(plan, gap, count) {
  const n = Math.max(0, Math.min(count, plan.slots))

  if (!n || plan.invalid) return []

  const cu = pickColumns(n, plan.cols, plan.rows)
  const rowsUsed = Math.ceil(n / cu)

  const blockH = rowsUsed * plan.ch + (rowsUsed - 1) * gap
  const y0 = (plan.page.h - blockH) / 2

  const items = []

  for (let i = 0; i < n; i += 1) {
    const row = Math.floor(i / cu)
    const col = i % cu

    const inRow = row === rowsUsed - 1 ? n - row * cu : cu
    const rowW = inRow * plan.cw + (inRow - 1) * gap
    const x0 = (plan.page.w - rowW) / 2

    items.push({
      slot: i,
      x: x0 + col * (plan.cw + gap),
      y: y0 + row * (plan.ch + gap),
      w: plan.cw,
      h: plan.ch,
      rotated: plan.rotated,
    })
  }

  return items
}

/*
  Resolução efetiva (DPI) de uma imagem dentro de uma célula.
*/
export function effectiveDpi(imgW, imgH, cellW, cellH, rotated, fit) {
  if (!imgW || !imgH || !cellW || !cellH) return 0

  const frameW = rotated ? cellH : cellW
  const frameH = rotated ? cellW : cellH

  const mmPerPx =
    fit === 'cover'
      ? Math.max(frameW / imgW, frameH / imgH)
      : Math.min(frameW / imgW, frameH / imgH)

  return 25.4 / mmPerPx
}

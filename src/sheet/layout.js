import { MAX_ARTS, PAPERS, SHRINK_TOLERANCE_MM } from './presets.js'

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

function evaluate(paperId, orientation, rotated, art, marginX, marginY, gap) {
  const page = paperDims(paperId, orientation)

  const baseW = rotated ? art.h : art.w
  const baseH = rotated ? art.w : art.h

  const availW = page.w - 2 * marginX
  const availH = page.h - 2 * marginY

  if (availW <= 0 || availH <= 0 || baseW <= 0 || baseH <= 0) return null

  // menor escala aceita "sem aviso": o lado maior perde no máximo 1 mm
  const sMin = Math.max(0.5, 1 - SHRINK_TOLERANCE_MM / Math.max(baseW, baseH))

  /*
    Testa todas as grades colunas × linhas: para cada uma, calcula a maior
    escala (≤ 100%) em que ela cabe. Vale a que tem mais artes cabendo com
    redução de até 1 mm; em empate, a que reduz menos.
  */
  const maxCols = Math.max(1, Math.floor((availW + gap + EPS) / (baseW * sMin + gap)))
  const maxRows = Math.max(1, Math.floor((availH + gap + EPS) / (baseH * sMin + gap)))

  let best = null

  for (let k = 1; k <= maxCols; k += 1) {
    for (let r = 1; r <= maxRows; r += 1) {
      const s = Math.min(
        1,
        (availW - (k - 1) * gap) / (k * baseW),
        (availH - (r - 1) * gap) / (r * baseH)
      )

      if (s < sMin - EPS) continue

      const cap = k * r

      if (!best || cap > best.cap || (cap === best.cap && s > best.s + EPS)) {
        best = { k, r, s, cap }
      }
    }
  }

  let scale
  let cols
  let rows

  if (best) {
    scale = best.s
    cols = best.k
    rows = best.r
  } else {
    // nem uma arte cabe sem reduzir mais de 1 mm: reduz para caber uma
    // (e conta quantas dessa escala cabem)
    scale = Math.min(1, availW / baseW, availH / baseH)

    const cw0 = baseW * scale
    const ch0 = baseH * scale

    cols = Math.max(1, Math.floor((availW + gap + EPS) / (cw0 + gap)))
    rows = Math.max(1, Math.floor((availH + gap + EPS) / (ch0 + gap)))
  }

  return {
    page,
    orientation,
    rotated,
    marginX,
    marginY,
    scale,
    shrinkMM: (1 - scale) * Math.max(baseW, baseH),
    cw: baseW * scale,
    ch: baseH * scale,
    cols,
    rows,
    capacity: cols * rows,
    // "tamanho real": sem redução ou só a redução tolerada de até 1 mm
    fullSize: scale >= sMin - EPS,
  }
}

function better(a, b) {
  if (!b) return true

  if (a.fullSize !== b.fullSize) return a.fullSize

  if (a.fullSize) {
    if (a.capacity !== b.capacity) return a.capacity > b.capacity
    if (Math.abs(a.scale - b.scale) > EPS) return a.scale > b.scale
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
function planCore({
  paper = 'A4',
  orientation = 'auto',
  artW,
  artH,
  margin = 0, // atalho: mesma margem em todos os lados
  marginX = margin, // margens laterais (esquerda e direita)
  marginY = margin, // margens de topo e base
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
      const candidate = evaluate(paper, o, r, art, marginX, marginY, gap)

      if (candidate && better(candidate, best)) best = candidate
    }
  }

  if (!best) {
    const page = paperDims(paper, orientation === 'landscape' ? 'landscape' : 'portrait')

    return {
      page,
      orientation: 'portrait',
      rotated: false,
      marginX,
      marginY,
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
  primeiras `count` artes.

  As artes ficam encostadas no TOPO (logo abaixo da margem de topo),
  para sobrar uma faixa inteira de folha que pode ser reaproveitada
  em outra impressão. Na horizontal cada linha é centralizada.
*/
export function placeArts(plan, gap, count) {
  const n = Math.max(0, Math.min(count, plan.slots))

  if (!n || plan.invalid) return []

  const cu = pickColumns(n, plan.cols, plan.rows)
  const rowsUsed = Math.ceil(n / cu)

  const y0 = plan.marginY

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

  // milímetros por pixel em cada eixo
  const mmX = frameW / imgW
  const mmY = frameH / imgH

  let mmPerPx

  if (fit === 'stretch') mmPerPx = Math.max(mmX, mmY) // o eixo mais "esticado" limita a resolução
  else if (fit === 'cover') mmPerPx = Math.max(mmX, mmY)
  else mmPerPx = Math.min(mmX, mmY)

  return 25.4 / mmPerPx
}

/*
  Diferença entre a proporção da arte e a da medida (0 = igual,
  0,07 = 7%). Serve para avisar que a arte vai sobrar, cortar ou esticar.
*/
export function aspectMismatch(imgW, imgH, cellW, cellH, rotated) {
  if (!imgW || !imgH || !cellW || !cellH) return 0

  const frameW = rotated ? cellH : cellW
  const frameH = rotated ? cellW : cellH

  return Math.abs(imgW / imgH / (frameW / frameH) - 1)
}


/*
  ==========================================================
  PLANO FINAL: o arranjo é decidido SEM margens e as margens apenas
  "encolhem" as artes.

  Assim, ao aumentar a margem, o arranjo não muda (nada troca de
  orientação nem de posição): as artes ficam proporcionalmente menores
  para caber dentro da área útil. Com margem 0 a arte encosta nas
  bordas. Só se a redução passar de 10% o arranjo é recalculado.
  ==========================================================
*/
export const MARGIN_FIT_FLOOR = 0.9

export function planSheet(params) {
  const {
    margin = 0,
    marginX = margin,
    marginY = margin,
    gap = 0,
  } = params

  const ideal = planCore({ ...params, margin: 0, marginX: 0, marginY: 0 })

  if (ideal.invalid || (marginX <= 0 && marginY <= 0)) {
    return planCore({ ...params, marginX, marginY })
  }

  // mesmo arranjo (orientação, giro, colunas × linhas), com a escala das margens
  const baseW = ideal.rotated ? params.artH : params.artW
  const baseH = ideal.rotated ? params.artW : params.artH

  const availW = ideal.page.w - 2 * marginX
  const availH = ideal.page.h - 2 * marginY

  if (availW > 0 && availH > 0) {
    const scale = Math.min(
      1,
      (availW - (ideal.cols - 1) * gap) / (ideal.cols * baseW),
      (availH - (ideal.rows - 1) * gap) / (ideal.rows * baseH)
    )

    if (scale >= MARGIN_FIT_FLOOR) {
      const sMin = Math.max(0.5, 1 - SHRINK_TOLERANCE_MM / Math.max(baseW, baseH))

      return {
        ...ideal,
        marginX,
        marginY,
        scale,
        shrinkMM: (1 - scale) * Math.max(baseW, baseH),
        cw: baseW * scale,
        ch: baseH * scale,
        fullSize: scale >= sMin - EPS,
        slots: Math.min(MAX_ARTS, ideal.capacity),
        invalid: false,
      }
    }
  }

  // redução maior que 10%: recalcula o melhor arranjo para essas margens
  return planCore({ ...params, marginX, marginY })
}

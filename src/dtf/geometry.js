/*
  ==========================================================
  GEOMETRIA DO EDITOR DTF (tudo em milímetros e graus)

  Cada objeto: { cx, cy, w, h, angle, flipX, flipY }
    cx, cy  = centro do objeto na folha
    w, h    = tamanho (antes de girar)
    angle   = rotação em graus (sentido horário)
  ==========================================================
*/

export const DEG = Math.PI / 180
export const MIN_SIZE = 2 // menor tamanho permitido (mm)

export const HANDLES = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
}

export function normalizeAngle(deg) {
  let a = ((deg + 180) % 360 + 360) % 360 - 180

  if (a === -180) a = 180

  return Math.round(a * 1000) / 1000
}

/* retângulo que envolve o objeto girado */
export function aabb(o) {
  const t = o.angle * DEG
  const c = Math.abs(Math.cos(t))
  const s = Math.abs(Math.sin(t))

  const w = o.w * c + o.h * s
  const h = o.w * s + o.h * c

  return { x: o.cx - w / 2, y: o.cy - h / 2, w, h, r: o.cx + w / 2, b: o.cy + h / 2 }
}

export function unionBox(boxes) {
  if (!boxes.length) return null

  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const r = Math.max(...boxes.map((b) => b.r))
  const b = Math.max(...boxes.map((bx) => bx.b))

  return { x, y, w: r - x, h: b - y, r, b }
}

export function boxesIntersect(a, b) {
  return a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b
}

export function localToWorld(o, lx, ly) {
  const t = o.angle * DEG
  const c = Math.cos(t)
  const s = Math.sin(t)

  return { x: o.cx + lx * c - ly * s, y: o.cy + lx * s + ly * c }
}

export function worldToLocal(o, x, y) {
  const t = o.angle * DEG
  const c = Math.cos(t)
  const s = Math.sin(t)
  const dx = x - o.cx
  const dy = y - o.cy

  return { x: dx * c + dy * s, y: -dx * s + dy * c }
}

export function pointInObject(o, x, y) {
  const p = worldToLocal(o, x, y)

  return Math.abs(p.x) <= o.w / 2 && Math.abs(p.y) <= o.h / 2
}

/* ---------- redimensionar ---------- */

/*
  Redimensiona a partir de uma alça, mantendo fixo o ponto oposto.

  - alças dos cantos: proporcionais (Shift = livre)
  - alças dos lados: livres, ou proporcionais se `lock` estiver ligado
*/
export function resizeFromHandle(start, handle, pointer, { lock = true, free = false } = {}) {
  const [hx, hy] = HANDLES[handle]
  const corner = hx !== 0 && hy !== 0

  const p = worldToLocal(start, pointer.x, pointer.y)

  const ax = -hx * (start.w / 2)
  const ay = -hy * (start.h / 2)

  let nw = hx ? hx * (p.x - ax) : start.w
  let nh = hy ? hy * (p.y - ay) : start.h

  const proportional = corner ? !free : lock

  if (proportional) {
    let k

    if (corner) k = Math.max(nw / start.w, nh / start.h)
    else if (hx) k = nw / start.w
    else k = nh / start.h

    k = Math.max(k, MIN_SIZE / Math.min(start.w, start.h))

    nw = start.w * k
    nh = start.h * k
  } else {
    nw = Math.max(MIN_SIZE, nw)
    nh = Math.max(MIN_SIZE, nh)
  }

  const anchor = localToWorld(start, ax, ay)
  const t = start.angle * DEG
  const c = Math.cos(t)
  const s = Math.sin(t)

  const ox = hx * (nw / 2)
  const oy = hy * (nh / 2)

  return {
    cx: anchor.x + ox * c - oy * s,
    cy: anchor.y + ox * s + oy * c,
    w: nw,
    h: nh,
  }
}

/* ---------- girar ---------- */

export function rotateFromPointer(startAngle, center, startPointer, pointer, snap = false) {
  const a0 = Math.atan2(startPointer.y - center.y, startPointer.x - center.x)
  const a1 = Math.atan2(pointer.y - center.y, pointer.x - center.x)

  let angle = startAngle + (a1 - a0) / DEG

  if (snap) angle = Math.round(angle / 15) * 15

  return normalizeAngle(angle)
}

/* ---------- ímãs (guias inteligentes) ---------- */

/*
  Encaixa um retângulo em movimento nas linhas candidatas (bordas e
  centros da folha e de outros objetos). Devolve o ajuste e as guias.
*/
export function snapBox(moving, lines, tolerance) {
  const xs = [moving.x, moving.x + moving.w / 2, moving.r]
  const ys = [moving.y, moving.y + moving.h / 2, moving.b]

  let bestX = null
  let bestY = null

  for (const line of lines.x) {
    for (const value of xs) {
      const d = line - value

      if (Math.abs(d) <= tolerance && (!bestX || Math.abs(d) < Math.abs(bestX.d))) {
        bestX = { d, line }
      }
    }
  }

  for (const line of lines.y) {
    for (const value of ys) {
      const d = line - value

      if (Math.abs(d) <= tolerance && (!bestY || Math.abs(d) < Math.abs(bestY.d))) {
        bestY = { d, line }
      }
    }
  }

  return {
    dx: bestX ? bestX.d : 0,
    dy: bestY ? bestY.d : 0,
    guides: {
      x: bestX ? bestX.line : null,
      y: bestY ? bestY.line : null,
    },
  }
}

export function snapLines(page, margin, others) {
  const x = [0, page.w / 2, page.w]
  const y = [0, page.h / 2, page.h]

  if (margin > 0) {
    x.push(margin, page.w - margin)
    y.push(margin, page.h - margin)
  }

  for (const o of others) {
    const b = aabb(o)

    x.push(b.x, b.x + b.w / 2, b.r)
    y.push(b.y, b.y + b.h / 2, b.b)
  }

  return { x, y }
}

/* ---------- qualidade ---------- */

export const LOW_DPI = 150 // abaixo disso a qualidade é "muito baixa"
export const GOOD_DPI = 300

export function effectiveDpi(o) {
  if (!o.nw || !o.nh || !o.w || !o.h) return 0

  return Math.min(o.nw / (o.w / 25.4), o.nh / (o.h / 25.4))
}

/* tamanho (mm) em que a imagem tem exatamente `dpi` */
export function sizeAtDpi(nw, nh, dpi) {
  return { w: (nw / dpi) * 25.4, h: (nh / dpi) * 25.4 }
}

/* ---------- alinhar à folha ---------- */

export function alignToPage(o, page, how) {
  const b = aabb(o)

  switch (how) {
    case 'left':
      return { ...o, cx: o.cx + (0 - b.x) }
    case 'right':
      return { ...o, cx: o.cx + (page.w - b.r) }
    case 'centerX':
      return { ...o, cx: page.w / 2 + (o.cx - (b.x + b.w / 2)) }
    case 'top':
      return { ...o, cy: o.cy + (0 - b.y) }
    case 'bottom':
      return { ...o, cy: o.cy + (page.h - b.b) }
    case 'centerY':
      return { ...o, cy: page.h / 2 + (o.cy - (b.y + b.h / 2)) }
    default:
      return o
  }
}

/* define a posição pelo canto superior esquerdo do retângulo envolvente */
export function withBoxPosition(o, x, y) {
  const b = aabb(o)

  return { ...o, cx: o.cx + (x - b.x), cy: o.cy + (y - b.y) }
}

/* espelha um objeto em relação ao eixo vertical da folha */
export function mirrorObject(o, pageW) {
  return {
    ...o,
    cx: pageW - o.cx,
    angle: normalizeAngle(-o.angle),
    flipX: !o.flipX,
  }
}

/* objeto totalmente fora da folha ou parcialmente fora */
export function outsidePage(o, page, tolerance = 0.5) {
  const b = aabb(o)

  return (
    b.x < -tolerance ||
    b.y < -tolerance ||
    b.r > page.w + tolerance ||
    b.b > page.h + tolerance
  )
}

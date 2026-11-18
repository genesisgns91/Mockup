import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icons.jsx'
import {
  HANDLES,
  aabb,
  boxesIntersect,
  effectiveDpi,
  pointInObject,
  resizeFromHandle,
  rotateFromPointer,
  snapBox,
  snapLines,
  unionBox,
} from './geometry.js'
import { visibleAt } from './overlap.js'

/*
  ==========================================================
  EDITOR VISUAL DO GABARITO DTF

  Funciona como os programas de desenho (CorelDRAW):
  • clicar seleciona (respeita as partes transparentes);
  • arrastar move; alças dos cantos/lados redimensionam;
    a alça de cima gira (Shift = de 15° em 15°);
  • Shift+clique ou arrastar numa área vazia seleciona vários;
  • guias inteligentes encaixam nas bordas e centros;
  • Ctrl + roda (ou pinça) dá zoom, a roda rola, Espaço + arrastar
    move a folha; no celular, dois dedos dão zoom e deslocam.
  ==========================================================
*/

const REAL_SCALE = 96 / 25.4 // pixels por mm em 100%
const MIN_ZOOM = 0.15
const MAX_ZOOM = 12

function handleCursor(handle, angle) {
  const [hx, hy] = HANDLES[handle]
  const base = Math.atan2(hy, hx) * (180 / Math.PI)
  const a = (((base + angle) % 180) + 180) % 180
  const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']

  return cursors[Math.round(a / 45) % 4]
}

export default function DtfEditor({ dtf, compact = false, onAdd }) {
  const { page, objects, selected, settings } = dtf

  const viewportRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ auto: true, scale: 1, ox: 0, oy: 0 })
  const [guides, setGuides] = useState({ x: null, y: null })
  const [marquee, setMarquee] = useState(null)
  const [readout, setReadout] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [spacePan, setSpacePan] = useState(false)
  const [fileOver, setFileOver] = useState(false)

  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const latest = useRef({})

  // ---------- tamanho da área e enquadramento ----------
  useEffect(() => {
    const el = viewportRef.current

    if (!el) return undefined

    const measure = () => {
      const r = el.getBoundingClientRect()

      setSize({ w: r.width, h: r.height })
    }

    measure()

    const observer = new ResizeObserver(measure)

    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  const fit = useMemo(() => {
    const pad = compact ? 16 : 40
    const availW = Math.max(40, size.w - pad * 2)
    const availH = Math.max(40, size.h - pad * 2 - (compact ? 40 : 0))
    const scale = Math.max(0.3, Math.min(availW / page.w, availH / page.h))

    return {
      scale,
      ox: (size.w - page.w * scale) / 2,
      oy: compact ? 56 + Math.max(0, (availH - page.h * scale) / 2) : (size.h - page.h * scale) / 2,
    }
  }, [size, page, compact])

  const S = view.auto ? fit.scale : view.scale
  const ox = view.auto ? fit.ox : view.ox
  const oy = view.auto ? fit.oy : view.oy

  latest.current = { dtf, S, ox, oy, fit, view, page, settings, objects, selected }

  const toWorld = useCallback((sx, sy) => {
    const { S: s, ox: x0, oy: y0 } = latest.current

    return { x: (sx - x0) / s, y: (sy - y0) / s }
  }, [])

  const localPoint = (e) => {
    const rect = viewportRef.current.getBoundingClientRect()

    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }

  const setZoomAt = useCallback((factor, sx, sy) => {
    setView((v) => {
      const cur = latest.current
      const scale0 = v.auto ? cur.fit.scale : v.scale
      const ox0 = v.auto ? cur.fit.ox : v.ox
      const oy0 = v.auto ? cur.fit.oy : v.oy

      const scale = Math.min(cur.fit.scale * MAX_ZOOM, Math.max(cur.fit.scale * MIN_ZOOM, scale0 * factor))
      const wx = (sx - ox0) / scale0
      const wy = (sy - oy0) / scale0

      return { auto: false, scale, ox: sx - wx * scale, oy: sy - wy * scale }
    })
  }, [])

  const zoomCenter = (factor) => setZoomAt(factor, size.w / 2, size.h / 2)

  const fitView = () => setView({ auto: true, scale: 1, ox: 0, oy: 0 })

  // ---------- localizar objeto sob o ponteiro ----------
  const hitTest = (world) => {
    const { objects: list, selected: sel, dtf: d } = latest.current

    // dentro da caixa de um objeto selecionado (mesmo em área transparente)
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (sel.includes(list[i].id) && pointInObject(list[i], world.x, world.y)) return list[i]
    }

    for (let i = list.length - 1; i >= 0; i -= 1) {
      const o = list[i]

      if (visibleAt(o, d.maskOf(o.id), world.x, world.y)) return o
    }

    return null
  }

  // ---------- gestos ----------
  const startPinch = () => {
    const pts = [...pointers.current.values()]
    const [a, b] = pts
    const cur = latest.current

    gesture.current = {
      type: 'pinch',
      dist: Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1,
      mx: (a.sx + b.sx) / 2,
      my: (a.sy + b.sy) / 2,
      scale: cur.S,
      ox: cur.ox,
      oy: cur.oy,
    }

    setMarquee(null)
    setDragging(false)
  }

  const onPointerDown = (e) => {
    if (e.button === 2) return

    const el = viewportRef.current
    const { sx, sy } = localPoint(e)

    el.focus({ preventScroll: true })

    pointers.current.set(e.pointerId, { sx, sy })

    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // captura indisponível
    }

    if (pointers.current.size === 2) {
      startPinch()
      return
    }

    const cur = latest.current
    const handle = e.target.closest?.('[data-handle]')?.dataset.handle

    if (handle) {
      const o = cur.objects.find((x) => x.id === cur.selected[0])

      if (!o) return

      const world = toWorld(sx, sy)

      gesture.current = {
        type: handle === 'rotate' ? 'rotate' : 'resize',
        handle,
        id: o.id,
        start: { ...o },
        p0: world,
      }

      setDragging(true)
      return
    }

    if (e.button === 1 || spacePan) {
      gesture.current = { type: 'pan', sx0: sx, sy0: sy, ox: cur.ox, oy: cur.oy, scale: cur.S }
      return
    }

    const world = toWorld(sx, sy)
    const hit = hitTest(world)

    if (hit) {
      let ids

      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const set = new Set(cur.selected)

        if (set.has(hit.id)) set.delete(hit.id)
        else set.add(hit.id)

        ids = [...set]
        cur.dtf.select(ids)

        if (!set.has(hit.id)) return
      } else {
        ids = cur.selected.includes(hit.id) ? cur.selected : [hit.id]

        if (ids !== cur.selected) cur.dtf.select(ids)
      }

      const starts = new Map()

      for (const o of cur.objects) if (ids.includes(o.id)) starts.set(o.id, { cx: o.cx, cy: o.cy })

      const group = unionBox(cur.objects.filter((o) => ids.includes(o.id)).map(aabb))

      // clicar (sem arrastar) numa imagem que já está num grupo selecionado
      // deixa só ela selecionada, como nos programas de desenho
      const collapseTo =
        !(e.shiftKey || e.ctrlKey || e.metaKey) && cur.selected.length > 1 && cur.selected.includes(hit.id)
          ? hit.id
          : null

      gesture.current = { type: 'move', ids, starts, group, sx0: sx, sy0: sy, moved: false, collapseTo }

      setDragging(true)
      return
    }

    // área vazia
    if (e.pointerType === 'touch') {
      gesture.current = { type: 'pan', sx0: sx, sy0: sy, ox: cur.ox, oy: cur.oy, scale: cur.S, tap: true }
    } else {
      gesture.current = { type: 'marquee', sx0: sx, sy0: sy, additive: e.shiftKey }

      if (!e.shiftKey) cur.dtf.clearSelection()
    }
  }

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return

    const { sx, sy } = localPoint(e)

    pointers.current.set(e.pointerId, { sx, sy })

    const g = gesture.current

    if (!g) return

    const cur = latest.current

    if (g.type === 'pinch') {
      if (pointers.current.size < 2) return

      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1
      const mx = (a.sx + b.sx) / 2
      const my = (a.sy + b.sy) / 2

      const scale = Math.min(cur.fit.scale * MAX_ZOOM, Math.max(cur.fit.scale * MIN_ZOOM, g.scale * (dist / g.dist)))
      const wx = (g.mx - g.ox) / g.scale
      const wy = (g.my - g.oy) / g.scale

      setView({ auto: false, scale, ox: mx - wx * scale, oy: my - wy * scale })
      return
    }

    if (g.type === 'pan') {
      if (Math.hypot(sx - g.sx0, sy - g.sy0) > 4) g.tap = false

      setView({ auto: false, scale: g.scale, ox: g.ox + (sx - g.sx0), oy: g.oy + (sy - g.sy0) })
      return
    }

    if (g.type === 'marquee') {
      setMarquee({ x0: g.sx0, y0: g.sy0, x1: sx, y1: sy })
      return
    }

    const world = toWorld(sx, sy)

    if (g.type === 'move') {
      let dx = (sx - g.sx0) / cur.S
      let dy = (sy - g.sy0) / cur.S

      if (!g.moved && Math.hypot(sx - g.sx0, sy - g.sy0) < 3) return

      g.moved = true

      let nextGuides = { x: null, y: null }

      if (cur.settings.snap && !e.altKey) {
        const others = cur.objects.filter((o) => !g.ids.includes(o.id))
        const moving = {
          x: g.group.x + dx,
          y: g.group.y + dy,
          w: g.group.w,
          h: g.group.h,
          r: g.group.r + dx,
          b: g.group.b + dy,
        }

        const snap = snapBox(moving, snapLines(cur.page, cur.settings.margin, others), 7 / cur.S)

        dx += snap.dx
        dy += snap.dy
        nextGuides = snap.guides
      }

      setGuides(nextGuides)

      cur.dtf.setObjects((list) =>
        list.map((o) => {
          const s = g.starts.get(o.id)

          return s ? { ...o, cx: s.cx + dx, cy: s.cy + dy } : o
        })
      )

      setReadout({ x: sx, y: sy, text: `${(g.group.x + dx).toFixed(1)} · ${(g.group.y + dy).toFixed(1)} mm` })
      return
    }

    if (g.type === 'resize') {
      const next = resizeFromHandle(g.start, g.handle, world, { lock: g.start.lock, free: e.shiftKey })

      cur.dtf.patchObject(g.id, next)

      const dpi = Math.round(effectiveDpi({ ...g.start, ...next }))

      setReadout({ x: sx, y: sy, text: `${next.w.toFixed(1)} × ${next.h.toFixed(1)} mm · ${dpi} DPI` })
      return
    }

    if (g.type === 'rotate') {
      const angle = rotateFromPointer(g.start.angle, { x: g.start.cx, y: g.start.cy }, g.p0, world, e.shiftKey)

      cur.dtf.patchObject(g.id, { angle })
      setReadout({ x: sx, y: sy, text: `${angle.toFixed(1)}°` })
    }
  }

  const endGesture = (e) => {
    pointers.current.delete(e.pointerId)

    const g = gesture.current

    if (pointers.current.size === 1 && g?.type === 'pinch') {
      // sobrou um dedo: segue como deslocamento da folha
      const [only] = [...pointers.current.values()]
      const cur = latest.current

      gesture.current = { type: 'pan', sx0: only.sx, sy0: only.sy, ox: cur.ox, oy: cur.oy, scale: cur.S }
      return
    }

    if (pointers.current.size > 0) return

    if (g?.type === 'marquee') {
      const { sx, sy } = localPoint(e)
      const moved = Math.hypot(sx - g.sx0, sy - g.sy0) > 4

      if (moved) {
        const a = toWorld(Math.min(g.sx0, sx), Math.min(g.sy0, sy))
        const b = toWorld(Math.max(g.sx0, sx), Math.max(g.sy0, sy))
        const box = { x: a.x, y: a.y, r: b.x, b: b.y }

        const cur = latest.current
        const ids = cur.objects.filter((o) => boxesIntersect(aabb(o), box)).map((o) => o.id)

        cur.dtf.select(g.additive ? [...new Set([...cur.selected, ...ids])] : ids)
      }
    }

    if (g?.type === 'pan' && g.tap) latest.current.dtf.clearSelection()

    if (g?.type === 'move' && !g.moved && g.collapseTo) latest.current.dtf.select([g.collapseTo])

    gesture.current = null

    setMarquee(null)
    setGuides({ x: null, y: null })
    setReadout(null)
    setDragging(false)
  }

  // roda do mouse: rola; Ctrl/⌘ (e pinça do touchpad) dá zoom
  useEffect(() => {
    const el = viewportRef.current

    if (!el) return undefined

    const onWheel = (e) => {
      e.preventDefault()

      const rect = el.getBoundingClientRect()

      if (e.ctrlKey || e.metaKey) {
        setZoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - rect.left, e.clientY - rect.top)
        return
      }

      setView((v) => {
        const cur = latest.current
        const scale = v.auto ? cur.fit.scale : v.scale

        return {
          auto: false,
          scale,
          ox: (v.auto ? cur.fit.ox : v.ox) - (e.shiftKey ? e.deltaY : e.deltaX),
          oy: (v.auto ? cur.fit.oy : v.oy) - (e.shiftKey ? 0 : e.deltaY),
        }
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })

    return () => el.removeEventListener('wheel', onWheel)
  }, [setZoomAt])

  // ---------- teclado ----------
  useEffect(() => {
    const isTyping = (t) =>
      t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)

    const onKeyDown = (e) => {
      if (isTyping(e.target)) return

      const d = latest.current.dtf
      const mod = e.ctrlKey || e.metaKey

      if (e.code === 'Space') {
        setSpacePan(true)
        e.preventDefault()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (d.selected.length) {
          e.preventDefault()
          d.removeSelected()
        }

        return
      }

      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        d.duplicateSelected()
        return
      }

      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        d.selectAll()
        return
      }

      if (mod && e.key === '0') {
        e.preventDefault()
        fitView()
        return
      }

      if (e.key === 'Escape') {
        d.clearSelection()
        return
      }

      if (e.key === ']' || e.key === 'PageUp') {
        d.reorder(mod ? 'front' : 'forward')
        e.preventDefault()
        return
      }

      if (e.key === '[' || e.key === 'PageDown') {
        d.reorder(mod ? 'back' : 'backward')
        e.preventDefault()
        return
      }

      if (e.key.startsWith('Arrow') && d.selected.length) {
        e.preventDefault()

        const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0

        d.patchMany(d.selected, (o) => ({ ...o, cx: o.cx + dx, cy: o.cy + dy }))
      }
    }

    const onKeyUp = (e) => {
      if (e.code === 'Space') setSpacePan(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ---------- arrastar arquivos para a folha ----------
  const onDragOver = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
      setFileOver(true)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setFileOver(false)

    const { sx, sy } = localPoint(e)

    dtf.addFiles(e.dataTransfer.files, { at: toWorld(sx, sy) })
  }

  // ---------- desenho ----------
  const selectedObjs = objects.filter((o) => selected.includes(o.id))
  const single = selectedObjs.length === 1 ? selectedObjs[0] : null
  const group = selectedObjs.length > 1 ? unionBox(selectedObjs.map(aabb)) : null

  const warnIds = useMemo(() => {
    const map = new Map()

    for (const id of dtf.lowQuality) map.set(id, 'Qualidade muito baixa')
    for (const [a, b] of dtf.overlaps) {
      map.set(a, 'Sobreposta a outra imagem')
      map.set(b, 'Sobreposta a outra imagem')
    }
    for (const id of dtf.outside) if (!map.has(id)) map.set(id, 'Parte fora da folha (será cortada)')

    return map
  }, [dtf.lowQuality, dtf.overlaps, dtf.outside])

  const percent = Math.round((S / REAL_SCALE) * 100)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  const toolbarBox = group || (single ? aabb(single) : null)

  return (
    <div
      className={`dtf-editor${compact ? ' compact' : ''}${spacePan ? ' panning' : ''}${dragging ? ' dragging' : ''}${fileOver ? ' file-over' : ''}`}
      ref={viewportRef}
      tabIndex={0}
      role="application"
      aria-label="Folha de impressão DTF. Clique nas imagens para selecionar, arraste para mover."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onDragOver={onDragOver}
      onDragLeave={() => setFileOver(false)}
      onDrop={onDrop}
    >

      {/*
        Folha e imagens desenhadas direto em PIXELS DE TELA (nada de ampliar
        por CSS): assim cada imagem é reduzida pelo navegador a partir do
        arquivo original, em vez de ser ampliada de uma versão pequena.
      */}
      <div className="dtf-world">

        <div
          className="dtf-page"
          style={{
            left: ox,
            top: oy,
            width: page.w * S,
            height: page.h * S,
            backgroundSize: `${10 * S}px ${10 * S}px`,
          }}
        />

        {settings.margin > 0 && (
          <div
            className="dtf-page-margin"
            style={{
              left: ox + settings.margin * S,
              top: oy + settings.margin * S,
              width: (page.w - 2 * settings.margin) * S,
              height: (page.h - 2 * settings.margin) * S,
            }}
          />
        )}

        {objects.map((o) => {
          const plain = o.angle === 0 && !o.flipX && !o.flipY

          // sem giro nem espelho, alinha ao pixel do aparelho (bordas nítidas)
          const snapPx = (v) => (plain ? Math.round(v * dpr) / dpr : v)

          const preview = dtf.previewOf ? dtf.previewOf(o.id) : null
          const useOriginal = !preview || o.w * S * dpr > preview.longest * 1.1

          return (
            <div
              key={o.id}
              className="dtf-obj"
              data-obj={o.id}
              data-cx={o.cx}
              data-cy={o.cy}
              data-w={o.w}
              data-h={o.h}
              data-angle={o.angle}
              style={{
                left: snapPx(ox + (o.cx - o.w / 2) * S),
                top: snapPx(oy + (o.cy - o.h / 2) * S),
                width: snapPx(o.w * S),
                height: snapPx(o.h * S),
                transform: plain
                  ? undefined
                  : `rotate(${o.angle}deg) scale(${o.flipX ? -1 : 1}, ${o.flipY ? -1 : 1})`,
              }}
            >
              <img src={useOriginal ? o.url : preview.url} alt={o.name} draggable={false} decoding="async" />
            </div>
          )
        })}

      </div>


      {/* camada de seleção (em pixels de tela) */}
      <div className="dtf-overlay">

        <div
          className="dtf-page-outline"
          style={{ left: ox, top: oy, width: page.w * S, height: page.h * S }}
        />

        {guides.x !== null && <div className="dtf-guide v" style={{ left: ox + guides.x * S }} />}
        {guides.y !== null && <div className="dtf-guide h" style={{ top: oy + guides.y * S }} />}

        {objects.map((o) => {
          const msg = warnIds.get(o.id)

          if (!msg) return null

          const b = aabb(o)

          return (
            <span
              key={`w${o.id}`}
              className="dtf-warn-badge"
              style={{ left: ox + b.x * S, top: oy + b.y * S }}
              title={msg}
            >
              <Icon name="warning" size={13} />
            </span>
          )
        })}

        {selectedObjs.map((o) => (
          <div
            key={`s${o.id}`}
            className={`dtf-frame${single ? ' single' : ''}`}
            style={{
              left: ox + (o.cx - o.w / 2) * S,
              top: oy + (o.cy - o.h / 2) * S,
              width: o.w * S,
              height: o.h * S,
              transform: `rotate(${o.angle}deg)`,
            }}
          >
            {single && (
              <>
                {Object.keys(HANDLES).map((h) => (
                  <span
                    key={h}
                    className={`dtf-handle h-${h}`}
                    data-handle={h}
                    style={{ cursor: handleCursor(h, o.angle) }}
                  />
                ))}

                <span className="dtf-rotate-line" />

                <span className="dtf-handle rotate" data-handle="rotate" title="Girar (Shift = de 15° em 15°)">
                  <Icon name="rotate-cw" size={compact ? 16 : 13} />
                </span>
              </>
            )}
          </div>
        ))}

        {group && (
          <div
            className="dtf-group-box"
            style={{ left: ox + group.x * S, top: oy + group.y * S, width: group.w * S, height: group.h * S }}
          />
        )}

        {marquee && (
          <div
            className="dtf-marquee"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}

        {readout && (
          <div className="dtf-readout" style={{ left: readout.x + 16, top: readout.y + 16 }}>
            {readout.text}
          </div>
        )}

        {/* barra rápida acima da seleção */}
        {toolbarBox && !dragging && (
          <div
            className="dtf-quickbar"
            style={{
              left: Math.min(Math.max(ox + (toolbarBox.x + toolbarBox.w / 2) * S, 110), Math.max(110, size.w - 110)),
              top: Math.max(8, oy + toolbarBox.y * S - (compact ? 74 : 62)),
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => dtf.reorder('front')} aria-label="Trazer para frente" title="Trazer para frente">
              <Icon name="to-front" size={17} />
            </button>
            <button type="button" onClick={() => dtf.reorder('back')} aria-label="Enviar para trás" title="Enviar para trás">
              <Icon name="to-back" size={17} />
            </button>
            <span className="dtf-quickbar-sep" />
            <button type="button" onClick={() => dtf.rotateSelected(90)} aria-label="Girar 90°" title="Girar 90°">
              <Icon name="rotate-cw" size={17} />
            </button>
            <button type="button" onClick={dtf.duplicateSelected} aria-label="Duplicar" title="Duplicar (Ctrl+D)">
              <Icon name="copy" size={17} />
            </button>
            <button type="button" className="danger" onClick={dtf.removeSelected} aria-label="Excluir" title="Excluir (Delete)">
              <Icon name="trash" size={17} />
            </button>
          </div>
        )}

        {/* folha vazia */}
        {!objects.length && !dtf.restoring && (
          <div className="dtf-empty">
            <div className="dtf-empty-card">
              <span className="dtf-empty-icon" aria-hidden="true">
                <Icon name="upload" size={26} />
              </span>
              <strong>Insira suas imagens</strong>
              <p>Arraste arquivos para cá, cole com Ctrl+V ou escolha várias de uma vez — elas são distribuídas pela folha.</p>
              <button type="button" className="btn btn-primary" onClick={onAdd}>
                Adicionar imagens
              </button>
            </div>
          </div>
        )}

        {fileOver && (
          <div className="drop-overlay" aria-hidden="true">
            <span>Solte para inserir na folha</span>
          </div>
        )}

      </div>


      {/* zoom */}
      <div className="dtf-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomCenter(1 / 1.25)} aria-label="Diminuir zoom" title="Diminuir zoom">
          <Icon name="minus" size={16} />
        </button>

        <button type="button" className="dtf-zoom-value" onClick={fitView} title="Ajustar à tela (Ctrl+0)">
          {percent}%
        </button>

        <button type="button" onClick={() => zoomCenter(1.25)} aria-label="Aumentar zoom" title="Aumentar zoom">
          <Icon name="plus" size={16} />
        </button>

        <button type="button" onClick={fitView} aria-label="Ajustar à tela" title="Ajustar à tela">
          <Icon name="fit" size={16} />
        </button>
      </div>

      {!compact && (
        <div className="dtf-hint" aria-hidden="true">
          Arraste para mover · alça de cima gira · Shift = proporção livre · Ctrl + roda = zoom · Espaço + arrastar = mover a folha
        </div>
      )}

    </div>
  )
}

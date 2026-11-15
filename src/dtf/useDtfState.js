import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../components/Toast.jsx'
import { useHistory } from '../hooks/useHistory.js'
import { isImageFile, prepareImage } from '../utils/imageFiles.js'
import { putBlob, getBlob, deleteBlob } from '../utils/persistence.js'
import { PAPERS } from '../sheet/presets.js'
import { bakeFree } from '../sheet/bake.js'
import { exportSheetPdf, exportSheetPng, saveBlob } from '../sheet/exporter.js'
import {
  LOW_DPI,
  aabb,
  alignToPage,
  effectiveDpi,
  mirrorObject,
  normalizeAngle,
  outsidePage,
  sizeAtDpi,
  withBoxPosition,
} from './geometry.js'
import { arrangeAll, placeNew } from './packing.js'
import { findOverlaps } from './overlap.js'
import { buildMask } from './masks.js'

/*
  ==========================================================
  ESTADO DO EDITOR DTF

  Objetos livres (imagens) sobre uma folha A4/A3: posição, tamanho,
  giro, ordem (camadas), avisos de sobreposição/qualidade, histórico
  (desfazer/refazer), salvamento automático e exportação.
  ==========================================================
*/

const KEY = 'almatie-mockup:dtf:v1'
const MAX_PX = 6000

export const DTF_DEFAULTS = {
  paper: 'A4',
  orientation: 'portrait',
  margin: 5,
  gap: 4,
  mirror: false,
  dpi: 300,
  snap: true,
}

const clamp = (v, min, max, fb) => {
  const n = Number(v)

  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb
}

function sanitize(raw) {
  const s = { ...DTF_DEFAULTS }

  if (!raw || typeof raw !== 'object') return s

  if (PAPERS[raw.paper]) s.paper = raw.paper
  if (raw.orientation === 'landscape') s.orientation = 'landscape'

  s.margin = clamp(raw.margin, 0, 10, 5)
  s.gap = clamp(raw.gap, 0, 20, 4)
  s.mirror = Boolean(raw.mirror)
  s.dpi = [300, 600].includes(raw.dpi) ? raw.dpi : 300
  s.snap = raw.snap !== false

  return s
}

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null
  } catch {
    return null
  }
}

export function pageDims(paper, orientation) {
  const p = PAPERS[paper] || PAPERS.A4
  const short = Math.min(p.w, p.h)
  const long = Math.max(p.w, p.h)

  return orientation === 'landscape' ? { w: long, h: short } : { w: short, h: long }
}

let counter = 0

const newId = () => {
  counter += 1

  return `d${Date.now().toString(36)}${counter}`
}

const baseName = (name) => String(name || 'imagem').replace(/\.[^.]+$/, '').slice(0, 40)

export function useDtfState() {
  const toast = useToast()

  const [settings, setSettings] = useState(() => sanitize(readSaved()))
  const [objects, setObjects] = useState([])
  const [selected, setSelected] = useState([])
  const [overlaps, setOverlaps] = useState([])
  const [busy, setBusy] = useState(null)
  const [progress, setProgress] = useState(0)
  const [restoring, setRestoring] = useState(true)

  const masks = useRef(new Map())
  const latest = useRef({})

  const page = useMemo(() => pageDims(settings.paper, settings.orientation), [settings.paper, settings.orientation])

  latest.current = { objects, settings, page, selected }

  // ---------- configurações da folha ----------
  const update = useCallback((patch) => setSettings((s) => sanitize({ ...s, ...patch })), [])

  // ---------- seleção ----------
  const select = useCallback((ids, additive = false) => {
    setSelected((current) => {
      const list = Array.isArray(ids) ? ids : [ids]

      if (!additive) return list

      const set = new Set(current)

      for (const id of list) {
        if (set.has(id)) set.delete(id)
        else set.add(id)
      }

      return [...set]
    })
  }, [])

  const selectAll = useCallback(() => setSelected(latest.current.objects.map((o) => o.id)), [])
  const clearSelection = useCallback(() => setSelected([]), [])

  // ---------- inserir imagens ----------
  const addFiles = useCallback(
    async (fileList, { at } = {}) => {
      const files = [...(fileList || [])].filter(isImageFile)

      if (!files.length) {
        if (fileList && fileList.length) toast.error('Envie arquivos de imagem (PNG, JPG ou WEBP).')

        return []
      }

      const prepared = []

      for (const file of files) {
        try {
          const p = await prepareImage(file, file.name, { maxSize: MAX_PX, track: false })

          prepared.push({ file, p })

          if (p.resized) toast.info(`“${baseName(file.name)}” era muito grande e foi reduzida para ${MAX_PX} px.`)
        } catch (error) {
          toast.error(error.message)
        }
      }

      if (!prepared.length) return []

      const { settings: st, page: pg, objects: current } = latest.current

      // tamanho natural a 300 DPI (a distribuição reduz se não couber)
      const sizes = prepared.map(({ p }) => sizeAtDpi(p.width, p.height, 300))

      let spots

      if (prepared.length === 1 && at) {
        const s = sizes[0]
        const fit = Math.min(1, (pg.w - 2 * st.margin) / s.w, (pg.h - 2 * st.margin) / s.h, (pg.w * 0.6) / s.w)
        const w = s.w * fit
        const h = s.h * fit

        spots = [{
          cx: Math.min(pg.w - w / 2, Math.max(w / 2, at.x)),
          cy: Math.min(pg.h - h / 2, Math.max(h / 2, at.y)),
          w,
          h,
          overflow: false,
        }]
      } else {
        spots = placeNew(sizes, current, pg, { margin: st.margin, gap: st.gap })
      }

      const created = prepared.map(({ file, p }, i) => ({
        id: newId(),
        name: baseName(file.name),
        url: p.url,
        blob: p.blob,
        img: p.img,
        nw: p.width,
        nh: p.height,
        cx: spots[i].cx,
        cy: spots[i].cy,
        w: spots[i].w,
        h: spots[i].h,
        angle: 0,
        flipX: false,
        flipY: false,
        lock: true,
      }))

      for (const o of created) masks.current.set(o.id, buildMask(o.img))

      setObjects((list) => [...list, ...created])
      setSelected(created.map((o) => o.id))

      if (spots.some((s) => s.overflow)) {
        toast.warning('Algumas imagens não couberam na folha e ficaram sobrepostas. Reduza-as ou use “Organizar”.')
      } else if (created.length > 1) {
        toast.success(`${created.length} imagens distribuídas pela folha.`)
      }

      return created.map((o) => o.id)
    },
    [toast]
  )

  // ---------- editar objetos ----------
  const patchObject = useCallback((id, patch) => {
    setObjects((list) => list.map((o) => (o.id === id ? { ...o, ...(typeof patch === 'function' ? patch(o) : patch) } : o)))
  }, [])

  const patchMany = useCallback((ids, fn) => {
    const set = new Set(ids)

    setObjects((list) => list.map((o) => (set.has(o.id) ? fn(o) : o)))
  }, [])

  /*
    Edita pelos campos numéricos. x/y = canto do retângulo que envolve o
    objeto; w/h = tamanho (a trava de proporção é respeitada); angle em graus.
  */
  const applyProps = useCallback((id, props) => {
    setObjects((list) =>
      list.map((o) => {
        if (o.id !== id) return o

        let next = { ...o }

        if (props.w !== undefined || props.h !== undefined) {
          let w = props.w ?? o.w
          let h = props.h ?? o.h

          if (o.lock) {
            if (props.w !== undefined) h = (o.h / o.w) * w
            else w = (o.w / o.h) * h
          }

          next = { ...next, w: Math.max(2, w), h: Math.max(2, h) }
        }

        if (props.angle !== undefined) next.angle = normalizeAngle(props.angle)

        if (props.x !== undefined || props.y !== undefined) {
          const b = aabb(next)

          next = withBoxPosition(next, props.x ?? b.x, props.y ?? b.y)
        }

        return next
      })
    )
  }, [])

  const removeSelected = useCallback(() => {
    const set = new Set(latest.current.selected)

    if (!set.size) return

    setObjects((list) => list.filter((o) => !set.has(o.id)))
    setSelected([])
  }, [])

  const duplicateSelected = useCallback(() => {
    const set = new Set(latest.current.selected)

    if (!set.size) return

    const copies = []

    for (const o of latest.current.objects) {
      if (set.has(o.id)) copies.push({ ...o, id: newId(), cx: o.cx + 6, cy: o.cy + 6, name: `${o.name} (cópia)` })
    }

    const mask = masks.current

    copies.forEach((c, i) => {
      const source = latest.current.objects.filter((o) => set.has(o.id))[i]

      mask.set(c.id, mask.get(source.id))
    })

    setObjects((list) => [...list, ...copies])
    setSelected(copies.map((c) => c.id))
  }, [])

  // ordem das camadas (o último da lista fica por cima)
  const reorder = useCallback((how, ids) => {
    const set = new Set(ids || latest.current.selected)

    if (!set.size) return

    setObjects((list) => {
      const picked = list.filter((o) => set.has(o.id))
      const rest = list.filter((o) => !set.has(o.id))

      if (how === 'front') return [...rest, ...picked]
      if (how === 'back') return [...picked, ...rest]

      const next = [...list]

      if (how === 'forward') {
        for (let i = next.length - 2; i >= 0; i -= 1) {
          if (set.has(next[i].id) && !set.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]]
        }
      }

      if (how === 'backward') {
        for (let i = 1; i < next.length; i += 1) {
          if (set.has(next[i].id) && !set.has(next[i - 1].id)) [next[i], next[i - 1]] = [next[i - 1], next[i]]
        }
      }

      return next
    })
  }, [])

  const alignSelected = useCallback((how) => {
    const { selected: ids, page: pg } = latest.current

    patchMany(ids, (o) => alignToPage(o, pg, how))
  }, [patchMany])

  const rotateSelected = useCallback((deg) => {
    patchMany(latest.current.selected, (o) => ({ ...o, angle: normalizeAngle(o.angle + deg) }))
  }, [patchMany])

  const flipSelected = useCallback((axis) => {
    patchMany(latest.current.selected, (o) => (axis === 'x' ? { ...o, flipX: !o.flipX } : { ...o, flipY: !o.flipY }))
  }, [patchMany])

  /* tamanho em que a imagem tem exatamente 300 DPI (mantém o centro) */
  const realSize = useCallback((id) => {
    patchObject(id, (o) => {
      const s = sizeAtDpi(o.nw, o.nh, 300)

      return { w: s.w, h: s.h }
    })
  }, [patchObject])

  const fitToWidth = useCallback((id) => {
    const { page: pg, settings: st } = latest.current

    patchObject(id, (o) => {
      const w = pg.w - 2 * st.margin
      const k = w / o.w

      return { w, h: o.h * k, cx: pg.w / 2, angle: 0 }
    })
  }, [patchObject])

  const arrange = useCallback(() => {
    const { objects: list, page: pg, settings: st } = latest.current

    if (!list.length) return

    const result = arrangeAll(list, pg, { margin: st.margin, gap: st.gap })

    if (!result) {
      toast.warning('Não foi possível encaixar tudo na folha. Remova ou reduza algumas imagens.')
      return
    }

    setObjects(result)
    toast.success('Imagens reorganizadas pela folha.')
  }, [toast])

  const clearAll = useCallback(() => {
    setObjects([])
    setSelected([])
  }, [])

  // ---------- desfazer / refazer ----------
  const snapshot = useMemo(() => ({ objects }), [objects])

  const restoreSnapshot = useCallback((snap) => {
    setObjects(snap.objects)
    setSelected((current) => current.filter((id) => snap.objects.some((o) => o.id === id)))
  }, [])

  const history = useHistory(snapshot, restoreSnapshot)

  // ---------- avisos ----------
  const lowQuality = useMemo(
    () => objects.filter((o) => effectiveDpi(o) < LOW_DPI).map((o) => o.id),
    [objects]
  )

  const outside = useMemo(
    () => objects.filter((o) => outsidePage(o, page)).map((o) => o.id),
    [objects, page]
  )

  const knownPairs = useRef(new Set())
  const notifiedLow = useRef(new Set())

  useEffect(() => {
    const timer = setTimeout(() => {
      const pairs = findOverlaps(objects, masks.current)

      setOverlaps(pairs)

      if (restoring) {
        knownPairs.current = new Set(pairs.map((p) => p.join('|')))
        notifiedLow.current = new Set(lowQuality)

        return
      }

      const keys = new Set(pairs.map((p) => p.join('|')))
      const fresh = pairs.filter((p) => !knownPairs.current.has(p.join('|')))

      knownPairs.current = keys

      if (fresh.length) {
        const byId = new Map(objects.map((o) => [o.id, o]))
        const [a, b] = fresh[0]

        toast.warning(
          fresh.length === 1
            ? `“${byId.get(a)?.name}” está sobrepondo “${byId.get(b)?.name}” (só conta o que é visível, sem o fundo transparente).`
            : `${fresh.length} imagens estão se sobrepondo na folha.`
        )
      }

      for (const id of lowQuality) {
        if (!notifiedLow.current.has(id)) {
          const o = objects.find((x) => x.id === id)

          toast.warning(
            `“${o?.name}” está com cerca de ${Math.round(effectiveDpi(o))} DPI neste tamanho: a qualidade ficará muito baixa. Reduza-a ou use uma imagem maior.`,
            { duration: 7000 }
          )
        }
      }

      notifiedLow.current = new Set(lowQuality)
    }, 250)

    return () => clearTimeout(timer)
  }, [objects, lowQuality, restoring, toast])

  // ---------- salvamento automático ----------
  const persisted = useRef({})

  useEffect(() => {
    if (restoring) return undefined

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({
            ...settings,
            objects: objects.map((o) => ({
              id: o.id, name: o.name, nw: o.nw, nh: o.nh,
              cx: o.cx, cy: o.cy, w: o.w, h: o.h, angle: o.angle,
              flipX: o.flipX, flipY: o.flipY, lock: o.lock,
            })),
          })
        )
      } catch {
        // armazenamento indisponível
      }

      const ids = new Set(objects.map((o) => o.id))

      for (const o of objects) {
        const key = `dtf:${o.id}`

        if (!persisted.current[key]) {
          putBlob(key, o.blob, o.name)
          persisted.current[key] = true
        }
      }

      for (const key of Object.keys(persisted.current)) {
        if (!ids.has(key.slice(4))) {
          deleteBlob(key)
          delete persisted.current[key]
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [settings, objects, restoring])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const saved = readSaved()
      const metas = Array.isArray(saved?.objects) ? saved.objects : []
      const restored = []

      for (const meta of metas) {
        const record = await getBlob(`dtf:${meta.id}`)

        if (!record || cancelled) continue

        try {
          const p = await prepareImage(record.blob, record.name, { maxSize: MAX_PX, track: false })

          if (cancelled) return

          const o = {
            id: meta.id,
            name: meta.name || baseName(record.name),
            url: p.url,
            blob: p.blob,
            img: p.img,
            nw: p.width,
            nh: p.height,
            cx: Number(meta.cx) || 0,
            cy: Number(meta.cy) || 0,
            w: Math.max(2, Number(meta.w) || 50),
            h: Math.max(2, Number(meta.h) || 50),
            angle: normalizeAngle(Number(meta.angle) || 0),
            flipX: Boolean(meta.flipX),
            flipY: Boolean(meta.flipY),
            lock: meta.lock !== false,
          }

          masks.current.set(o.id, buildMask(o.img))
          persisted.current[`dtf:${o.id}`] = true
          restored.push(o)
        } catch {
          // arquivo guardado ilegível
        }
      }

      if (cancelled) return

      if (restored.length) setObjects((current) => (current.length ? current : restored))

      setRestoring(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // ---------- exportação ----------
  const fileName = useCallback(
    (ext) => {
      const count = objects.length

      return `gabarito-dtf-${settings.paper.toLowerCase()}-${settings.orientation === 'landscape' ? 'paisagem' : 'retrato'}-${count}-${count === 1 ? 'imagem' : 'imagens'}${settings.mirror ? '-espelhado' : ''}.${ext}`
    },
    [objects.length, settings.paper, settings.orientation, settings.mirror]
  )

  const exportAs = useCallback(
    async (format) => {
      if (busy) return

      if (!objects.length) {
        toast.warning('Insira ao menos uma imagem para gerar o gabarito.')
        return
      }

      setBusy(format)
      setProgress(0)

      try {
        const list = settings.mirror ? objects.map((o) => mirrorObject(o, page.w)) : objects

        const items = list
          .map((o) => ({ o, box: aabb(o) }))
          .filter(({ box }) => box.r > 0 && box.b > 0 && box.x < page.w && box.y < page.h)
          .map(({ o, box }) => ({
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
            bake: (pw, ph, dpi) => bakeFree(o.img, o, dpi, pw, ph),
          }))

        const common = { page, items, dpi: settings.dpi }

        const blob =
          format === 'pdf'
            ? await exportSheetPdf({ ...common, title: `Gabarito DTF ${settings.paper}` })
            : await exportSheetPng({ ...common, onProgress: setProgress })

        saveBlob(blob, fileName(format))

        toast.success(`Gabarito DTF salvo em ${format.toUpperCase()} (${settings.dpi} DPI, fundo transparente).`)
      } catch (error) {
        console.error(error)

        toast.error('Não foi possível gerar o arquivo. Tente 300 DPI ou menos imagens.')
      } finally {
        setBusy(null)
        setProgress(0)
      }
    },
    [busy, objects, settings, page, fileName, toast]
  )

  const maskOf = useCallback((id) => masks.current.get(id) || null, [])

  return {
    settings,
    update,
    page,
    objects,
    setObjects,
    selected,
    select,
    selectAll,
    clearSelection,
    addFiles,
    patchObject,
    patchMany,
    applyProps,
    removeSelected,
    duplicateSelected,
    reorder,
    alignSelected,
    rotateSelected,
    flipSelected,
    realSize,
    fitToWidth,
    arrange,
    clearAll,
    history,
    overlaps,
    lowQuality,
    outside,
    busy,
    progress,
    exportAs,
    fileName,
    maskOf,
    restoring,
  }
}

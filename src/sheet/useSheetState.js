import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../components/Toast.jsx'
import { isImageFile, prepareImage } from '../utils/imageFiles.js'
import { putBlob, getBlob, deleteBlob } from '../utils/persistence.js'
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET_ID,
  MARGIN_MAX,
  MARGIN_MIN,
  GAP_MAX,
  MAX_ARTS,
  PAPERS,
  ART_PRESETS,
  DPI_OPTIONS,
  getPreset,
  resolveArtSize,
} from './presets.js'
import { planSheet, placeArts, effectiveDpi } from './layout.js'
import { exportSheetPdf, exportSheetPng, saveBlob } from './exporter.js'

/*
  ==========================================================
  ESTADO DO GABARITO

  Configurações ficam no localStorage; as imagens enviadas, no
  IndexedDB (como no mockup). Tudo é restaurado ao reabrir.
  ==========================================================
*/

const KEY = 'almatie-mockup:sheet:v1'
const SHEET_MAX_PX = 6000 // artes grandes (A3 a 300 DPI) precisam de mais pixels

export const SHEET_DEFAULTS = {
  paper: 'A4',
  orientation: 'auto', // auto | portrait | landscape
  presetId: DEFAULT_PRESET_ID,
  custom: { w: 210, h: 95 },
  margin: 0,
  gap: 2,
  fit: 'contain', // contain (arte inteira) | cover (preenche e corta)
  allowRotate: false,
  mirror: false,
  sameArt: false,
  dpi: 300,
}

const clampNum = (value, min, max, fallback) => {
  const n = Number(value)

  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function sanitize(raw) {
  const s = { ...SHEET_DEFAULTS }

  if (!raw || typeof raw !== 'object') return s

  if (PAPERS[raw.paper]) s.paper = raw.paper
  if (['auto', 'portrait', 'landscape'].includes(raw.orientation)) s.orientation = raw.orientation

  if (raw.presetId === CUSTOM_PRESET_ID || ART_PRESETS.some((p) => p.id === raw.presetId)) {
    s.presetId = raw.presetId
  }

  s.custom = {
    w: clampNum(raw.custom?.w, 20, 420, 210),
    h: clampNum(raw.custom?.h, 20, 420, 95),
  }

  s.margin = clampNum(raw.margin, MARGIN_MIN, MARGIN_MAX, 0)
  s.gap = clampNum(raw.gap, 0, GAP_MAX, 2)
  s.fit = raw.fit === 'cover' ? 'cover' : 'contain'
  s.allowRotate = Boolean(raw.allowRotate)
  s.mirror = Boolean(raw.mirror)
  s.sameArt = Boolean(raw.sameArt)
  s.dpi = DPI_OPTIONS.includes(raw.dpi) ? raw.dpi : 300

  return s
}

function loadSaved() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY)))
  } catch {
    return { ...SHEET_DEFAULTS }
  }
}

export function useSheetState() {
  const toast = useToast()

  const [settings, setSettings] = useState(loadSaved)
  const [arts, setArts] = useState(() => Array(MAX_ARTS).fill(null))
  const [busy, setBusy] = useState(null) // null | 'pdf' | 'png'
  const [progress, setProgress] = useState(0)

  const artsRef = useRef(arts)
  artsRef.current = arts

  const update = useCallback((patch) => {
    setSettings((s) => sanitize({ ...s, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setSettings({ ...SHEET_DEFAULTS })
  }, [])

  // ---------- cálculo da folha ----------
  const artSize = useMemo(
    () => resolveArtSize(settings.presetId, settings.custom),
    [settings.presetId, settings.custom]
  )

  const plan = useMemo(
    () =>
      planSheet({
        paper: settings.paper,
        orientation: settings.orientation,
        artW: artSize.w,
        artH: artSize.h,
        margin: settings.margin,
        gap: settings.gap,
        allowRotate: settings.allowRotate,
      }),
    [settings.paper, settings.orientation, artSize, settings.margin, settings.gap, settings.allowRotate]
  )

  const slots = plan.slots

  /*
    No modo automático a folha prioriza o tamanho real da arte. Se a outra
    orientação coubesse mais artes (mesmo reduzidas), avisamos o usuário.
  */
  const alt = useMemo(() => {
    if (settings.orientation !== 'auto' || plan.invalid) return null

    const other = planSheet({
      paper: settings.paper,
      orientation: plan.orientation === 'portrait' ? 'landscape' : 'portrait',
      artW: artSize.w,
      artH: artSize.h,
      margin: settings.margin,
      gap: settings.gap,
      allowRotate: settings.allowRotate,
    })

    return !other.invalid && !other.fullSize && other.capacity > plan.capacity ? other : null
  }, [settings.paper, settings.orientation, settings.margin, settings.gap, settings.allowRotate, artSize, plan])

  const items = useMemo(() => {
    const visible = arts.slice(0, slots)

    let sources

    if (settings.sameArt) {
      const first = visible.find(Boolean)

      sources = first ? Array(slots).fill(first) : []
    } else {
      sources = visible.filter(Boolean)
    }

    return placeArts(plan, settings.gap, sources.length).map((place, i) => {
      const art = sources[i]

      return {
        ...place,
        art,
        dpi: effectiveDpi(art.w, art.h, place.w, place.h, place.rotated, settings.fit),
      }
    })
  }, [arts, slots, plan, settings.gap, settings.sameArt, settings.fit])

  const filledCount = useMemo(() => arts.slice(0, slots).filter(Boolean).length, [arts, slots])

  const lowestDpi = items.length ? Math.min(...items.map((i) => i.dpi)) : 0

  // ---------- envio de imagens ----------
  const loadArt = useCallback(
    async (file) => {
      if (!isImageFile(file)) {
        toast.error('Envie um arquivo de imagem (PNG, JPG ou WEBP).')
        return null
      }

      try {
        const p = await prepareImage(file, file.name, { maxSize: SHEET_MAX_PX, track: false })

        if (p.resized) {
          toast.info(`Imagem muito grande: reduzida para ${SHEET_MAX_PX} px no lado maior.`)
        }

        return { img: p.img, url: p.url, blob: p.blob, name: p.name, w: p.width, h: p.height }
      } catch (error) {
        toast.error(error.message)

        return null
      }
    },
    [toast]
  )

  const setArtAt = useCallback((index, art) => {
    setArts((current) => {
      const next = [...current]

      if (next[index]?.url && next[index].url !== art?.url) URL.revokeObjectURL(next[index].url)

      next[index] = art

      return next
    })
  }, [])

  const uploadAt = useCallback(
    async (index, file) => {
      const art = await loadArt(file)

      if (art) setArtAt(index, art)
    },
    [loadArt, setArtAt]
  )

  const clearAt = useCallback((index) => setArtAt(index, null), [setArtAt])

  /*
    Vários arquivos de uma vez (botão ou arrastar): preenchem os
    espaços vazios na ordem e, se faltar espaço, avisam.
  */
  const uploadMany = useCallback(
    async (fileList) => {
      const files = [...(fileList || [])].filter(isImageFile)

      if (!files.length) return

      const free = []

      for (let i = 0; i < slots; i += 1) if (!artsRef.current[i]) free.push(i)

      const targets = free.length ? free : [...Array(slots).keys()]

      if (files.length > targets.length) {
        toast.warning(`Nesta folha cabem ${slots} arte${slots > 1 ? 's' : ''}. As demais não foram adicionadas.`)
      }

      await Promise.all(files.slice(0, targets.length).map((file, i) => uploadAt(targets[i], file)))
    },
    [slots, toast, uploadAt]
  )

  // ---------- salvamento automático ----------
  const persisted = useRef({})

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(settings))
      } catch {
        // armazenamento indisponível
      }

      arts.forEach((art, i) => {
        const key = `sheet:${i}`

        if (art && persisted.current[key] !== art.url) {
          putBlob(key, art.blob, art.name)
          persisted.current[key] = art.url
        }

        if (!art && persisted.current[key]) {
          deleteBlob(key)
          delete persisted.current[key]
        }
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [settings, arts])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      for (let i = 0; i < MAX_ARTS; i += 1) {
        const record = await getBlob(`sheet:${i}`)

        if (!record || cancelled) continue

        try {
          const p = await prepareImage(record.blob, record.name, { maxSize: SHEET_MAX_PX, track: false })

          if (cancelled) return

          setArts((current) => {
            if (current[i]) return current

            const next = [...current]

            next[i] = { img: p.img, url: p.url, blob: p.blob, name: record.name, w: p.width, h: p.height }
            persisted.current[`sheet:${i}`] = p.url

            return next
          })
        } catch {
          // arquivo guardado ilegível
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // ---------- exportação ----------
  const fileName = useCallback(
    (ext) => {
      const preset = settings.presetId === CUSTOM_PRESET_ID
        ? `${artSize.w}x${artSize.h}mm`
        : getPreset(settings.presetId).id

      const sheet = `${settings.paper.toLowerCase()}-${plan.orientation === 'landscape' ? 'paisagem' : 'retrato'}`

      return `gabarito-${sheet}-${items.length}-${items.length === 1 ? 'arte' : 'artes'}-${preset}${settings.mirror ? '-espelhado' : ''}.${ext}`
    },
    [settings.paper, settings.presetId, settings.mirror, artSize, plan.orientation, items.length]
  )

  const exportAs = useCallback(
    async (format) => {
      if (busy) return

      if (!items.length) {
        toast.warning('Envie ao menos uma arte para gerar o gabarito.')
        return
      }

      setBusy(format)
      setProgress(0)

      try {
        const common = {
          page: plan.page,
          items,
          dpi: settings.dpi,
          mirror: settings.mirror,
          fit: settings.fit,
        }

        const blob =
          format === 'pdf'
            ? await exportSheetPdf({ ...common, title: `Gabarito ${settings.paper}` })
            : await exportSheetPng({ ...common, onProgress: setProgress })

        saveBlob(blob, fileName(format))

        toast.success(`Gabarito salvo em ${format.toUpperCase()} (${settings.dpi} DPI, fundo transparente).`)
      } catch (error) {
        console.error(error)

        toast.error('Não foi possível gerar o arquivo. Tente 300 DPI ou menos artes por folha.')
      } finally {
        setBusy(null)
        setProgress(0)
      }
    },
    [busy, items, plan.page, settings, fileName, toast]
  )

  return {
    settings,
    update,
    reset,
    arts,
    artSize,
    plan,
    alt,
    slots,
    items,
    filledCount,
    lowestDpi,
    uploadAt,
    uploadMany,
    clearAt,
    busy,
    progress,
    exportAs,
    fileName,
  }
}

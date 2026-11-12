import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ROTATE_SECONDS } from './components/scene/constants.js'
import ControlsPanel from './components/ControlsPanel.jsx'
import Viewport from './components/Viewport.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import MobileShell from './components/MobileShell.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import SheetStudio from './sheet/SheetStudio.jsx'
import { useSheetState } from './sheet/useSheetState.js'
import {
  FormatSwitch,
  ViewSizeSwitch,
  QuickActions,
} from './components/StageControls.jsx'
import { useToast } from './components/Toast.jsx'
import { useIsMobile } from './hooks/useIsMobile.js'
import { EXPORT_FORMATS } from './config/exportFormats.js'
import { getModel, DEFAULT_MODEL_ID, MODELS } from './config/models.js'
import { MIN_PX_PER_MM } from './components/controls/constants.js'
import { useHistory } from './hooks/useHistory.js'
import {
  isImageFile,
  prepareImage,
  getBlobForUrl,
} from './utils/imageFiles.js'
import {
  loadSettings,
  saveSettings,
  putBlob,
  getBlob,
  deleteBlob,
} from './utils/persistence.js'
import { Icon } from './components/Icons.jsx'

import { ALMATIE_URL } from './config/links.js'


function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename

  document.body.appendChild(a)
  a.click()
  a.remove()

  setTimeout(
    () => URL.revokeObjectURL(url),
    2000
  )
}


/*
  ==========================================================
  MODAL DE PRÉVIA

  Mostra o resultado final (imagem ou vídeo, já no formato,
  fundo e recorte escolhidos) antes de confirmar o download.
  ==========================================================
*/
function ExportPreviewModal({ data, onClose, onConfirm }) {

  /*
    Fecha a prévia com a tecla Esc, para quem prefere
    teclado a mouse — comportamento padrão esperado em
    qualquer modal.
  */
  useEffect(() => {
    if (!data) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [data, onClose])

  if (!data) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>

      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={
          data.type === 'video'
            ? 'Seu vídeo está pronto'
            : 'Sua imagem está pronta'
        }
        onClick={(e) => e.stopPropagation()}
      >

        <div className="modal-header">

          <div>
            <span className="section-kicker">
              PRÉVIA
            </span>

            <h3>
              {data.type === 'video'
                ? 'Seu vídeo está pronto'
                : 'Sua imagem está pronta'}
            </h3>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar prévia"
          >
            ×
          </button>

        </div>


        <div className="modal-preview">

          {data.type === 'video' ? (

            <video
              src={data.url}
              controls
              autoPlay
              loop
              muted
              playsInline
            />

          ) : (

            <img
              src={data.url}
              alt="Prévia do mockup"
            />

          )}

        </div>


        <div className="modal-actions">

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Descartar
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
          >
            <span className="button-symbol">
              ↓
            </span>
            Baixar {data.type === 'video' ? 'vídeo' : 'imagem'}
          </button>

        </div>

      </div>

    </div>
  )
}


export default function App() {
  const toast = useToast()
  const isMobile = useIsMobile()

  /*
    Estado de "processando" só para dar feedback visual
    imediato no botão de PNG — a geração em si é rápida,
    mas sem isso o clique parece não ter feito nada.
  */
  const [isExportingImage, setIsExportingImage] =
    useState(false)

  /*
    Estado por modelo: cada modelo declara suas próprias
    "printZones" (áreas de arte) e "colorParts" (peças
    colorí­veis) — ver src/config/models.js. artZones/partColors
    guardam um valor por CHAVE dessas listas, então a mesma
    chave (ex: "body", "main") é preservada ao trocar de
    modelo, e chaves novas ganham valores padrão automaticamente.
  */
  /*
    Salvamento automático: lê o que foi guardado na última visita
    (as imagens são restauradas logo depois, mais abaixo).
  */
  const [saved] = useState(loadSettings)

  const savedModelId =
    saved && MODELS[saved.modelId] && !MODELS[saved.modelId].hidden
      ? saved.modelId
      : DEFAULT_MODEL_ID

  const [artZones, setArtZones] = useState(() => {
    const initial = {}

    for (const zone of getModel(savedModelId).printZones) {
      initial[zone.key] = {
        image: null,
        fileName: null,
        widthMM: 210,
        heightMM: 92,
        offsetXMM: 0,
        offsetYMM: 0,
        mugRealHeightMM: 95,
      }
    }

    // medidas guardadas de qualquer área (as imagens voltam depois)
    for (const [key, zone] of Object.entries(saved?.artZones || {})) {
      initial[key] = {
        image: null,
        fileName: null,
        widthMM: zone.widthMM ?? 210,
        heightMM: zone.heightMM ?? 92,
        offsetXMM: zone.offsetXMM ?? 0,
        offsetYMM: zone.offsetYMM ?? 0,
        mugRealHeightMM: zone.mugRealHeightMM ?? 95,
      }
    }

    return initial
  })


  const [background, setBackground] = useState({
    type: 'color',
    color: saved?.background?.color || '#F3ECE3',
    image: null,

    /*
      Encaixe ('cover' | 'contain' | 'width' | 'height'), zoom
      (0,25 a 5) e posição de arraste (0 a 1) da imagem de fundo.
    */
    fit: saved?.background?.fit || 'cover',
    zoom: saved?.background?.zoom ?? 1,
    offsetXFrac: saved?.background?.offsetXFrac ?? 0.5,
    offsetYFrac: saved?.background?.offsetYFrac ?? 0.5,
  })


  const [partColors, setPartColors] = useState(() => {
    const initial = {}

    for (const part of getModel(savedModelId).colorParts) {
      initial[part.key] = part.default
    }

    return { ...initial, ...(saved?.partColors || {}) }
  })


  /*
    Transparência (só usada por modelos de vidro —
    ver config.glassOpacity em src/config/models.js).
  */
  const [glassOpacity, setGlassOpacity] =
    useState(
      saved?.glassOpacity ??
        getModel(savedModelId).glassOpacity?.default ??
        0.8
    )


  /*
    Controle de brilho das canecas.

    0 = fosco
    1 = brilho máximo
  */
  const [mugShine, setMugShine] =
    useState(saved?.mugShine ?? 0.5)


  const [modelId, setModelId] =
    useState(savedModelId)

  const [magicPlaying, setMagicPlaying] =
    useState(false)

  /*
    Ao trocar de modelo, garante que toda "printZone" e todo
    "colorPart" do modelo novo tenham um valor no estado —
    sem apagar o que já existia (uma chave compartilhada como
    "body" continua com a cor que o usuário escolheu antes).
  */
  const prevModelRef = useRef(modelId)

  useEffect(() => {
    const config = getModel(modelId)

    setArtZones((zones) => {
      let changed = false
      const next = { ...zones }

      for (const zone of config.printZones) {
        if (!next[zone.key]) {
          changed = true
          next[zone.key] = {
            image: null,
            fileName: null,
            widthMM: 210,
            heightMM: 92,
            offsetXMM: 0,
            offsetYMM: 0,
            mugRealHeightMM: 95,
          }
        }
      }

      return changed ? next : zones
    })

    setPartColors((colors) => {
      let changed = false
      const next = { ...colors }

      for (const part of config.colorParts) {
        if (next[part.key] === undefined) {
          changed = true
          next[part.key] = part.default
        }
      }

      return changed ? next : colors
    })

    // só redefine a transparência quando o modelo MUDA de verdade
    // (na abertura do app vale o valor restaurado)
    if (prevModelRef.current !== modelId) {
      setGlassOpacity(config.glassOpacity?.default ?? 0.8)
    }

    prevModelRef.current = modelId

    // toda troca de modelo começa pausada — o usuário decide quando ver a animação
    setMagicPlaying(false)
  }, [modelId])

  const [warning, setWarning] =
    useState(null)

  const [isRecording, setIsRecording] =
    useState(false)

    const [videoSpeed, setVideoSpeed] =
    useState(saved?.videoSpeed ?? 1)

const [videoEffect, setVideoEffect] =
    useState(saved?.videoEffect || 'mug')
    
    const [videoQuality, setVideoQuality] =
    useState(saved?.videoQuality || 'standard')

  const [recordProgress, setRecordProgress] =
    useState(0)

  const [exportError, setExportError] =
    useState(null)


  /*
    Formato de exportação (proporção),
    fundo transparente e deslocamento do
    recorte (posição do guia arrastável).
  */
  const [exportFormatId, setExportFormatId] =
    useState(
      EXPORT_FORMATS.some((f) => f.id === saved?.exportFormatId)
        ? saved.exportFormatId
        : 'free'
    )

  const [transparentBg, setTransparentBg] =
    useState(Boolean(saved?.transparentBg))

  // arquivo da imagem exportada: png | jpeg | webp, e multiplicador de resolução
  const [imageFormat, setImageFormat] =
    useState(
      ['png', 'jpeg', 'webp'].includes(saved?.imageFormat)
        ? saved.imageFormat
        : 'png'
    )

  const [imageScale, setImageScale] =
    useState([1, 2, 3].includes(saved?.imageScale) ? saved.imageScale : 1)

  const [cropOffsetXFrac, setCropOffsetXFrac] =
    useState(0.5)

  const [cropOffsetYFrac, setCropOffsetYFrac] =
    useState(0.5)

  const [previewModal, setPreviewModal] =
    useState(null)

  /*
    Arte: "mesma imagem em todas as áreas" (opcional) e qual
    área está sendo ajustada. Ficam aqui no App para
    sobreviver à troca de abas no celular.
  */
  const [linkArt, setLinkArt] =
    useState(Boolean(saved?.linkArt))

  const [activeZoneKey, setActiveZoneKey] =
    useState(null)

  /*
    Edição do fundo direto na cena e "recentralizar modelo".
  */
  const [bgEditMode, setBgEditMode] =
    useState(false)

  /*
    Tamanho da visualização no desktop (estilo YouTube):
      wide     — retangular, painel à esquerda (padrão)
      square   — quadrada, com a exportação ao lado
      expanded — cena em tela cheia com controles flutuantes
    A escolha fica salva neste navegador.
  */
  const [viewMode, setViewMode] =
    useState(() => {
      try {
        const saved = localStorage.getItem('almatie-mockup:view-mode')
        return ['wide', 'square', 'expanded'].includes(saved) ? saved : 'wide'
      } catch {
        return 'wide'
      }
    })

  /*
    Ferramenta aberta: "mockup" (3D) ou "sheet" (gabarito de impressão).
    Lembra a última e aceita o endereço com #gabarito.
  */
  const [section, setSection] = useState(() => {
    try {
      if (window.location.hash === '#gabarito') return 'sheet'
      if (window.location.hash === '#mockup') return 'mockup'

      return localStorage.getItem('almatie-mockup:section') === 'sheet' ? 'sheet' : 'mockup'
    } catch {
      return 'mockup'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('almatie-mockup:section', section)

      const url = `${window.location.pathname}${window.location.search}${section === 'sheet' ? '#gabarito' : ''}`

      window.history.replaceState(null, '', url)
    } catch {
      // ambiente sem histórico/armazenamento
    }
  }, [section])

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#gabarito') setSection('sheet')
      if (window.location.hash === '#mockup') setSection('mockup')
    }

    window.addEventListener('hashchange', onHash)

    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const sheet = useSheetState()

  useEffect(() => {
    try {
      localStorage.setItem('almatie-mockup:view-mode', viewMode)
    } catch {
      // armazenamento indisponível: segue sem salvar
    }
  }, [viewMode])

  // atalhos: 1 · 2 · 3 trocam o tamanho; Esc sai do modo expandido / fecha exportação
  useEffect(() => {
    if (isMobile) return undefined

    const onKey = (e) => {
      const tag = e.target?.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        e.target?.isContentEditable

      if (e.key === 'Escape') {
        if (viewMode === 'expanded') setViewMode('wide')
        return
      }

      if (typing || e.ctrlKey || e.metaKey || e.altKey) return

      if (e.key === '1') setViewMode('wide')
      if (e.key === '2') setViewMode('square')
      if (e.key === '3') setViewMode('expanded')
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile, viewMode])

  const [resetToken, setResetToken] =
    useState(0)


  const activeFormat =
    EXPORT_FORMATS.find(
      (f) => f.id === exportFormatId
    ) || EXPORT_FORMATS[0]


  /*
    Recentraliza o guia de corte sempre que o
    formato muda, para não herdar um
    deslocamento que não faz sentido no novo
    enquadramento.
  */
  useEffect(() => {
    setCropOffsetXFrac(0.5)
    setCropOffsetYFrac(0.5)
  }, [exportFormatId])


  const apiRef = useRef(null)

  const spinTargetRef =
    useRef(null)

  const viewportRef =
    useRef(null)

  /*
    Elemento de imagem "de verdade" (fora do DOM
    visível), carregado sempre que a imagem de
    fundo muda, para poder ser desenhado em um
    canvas na hora de exportar PNG/vídeo.
  */
  const bgImageElRef =
    useRef(null)

  const [bgImageReady, setBgImageReady] =
    useState(false)


  useEffect(() => {
    if (
      background.type !== 'image' ||
      !background.image
    ) {
      bgImageElRef.current = null
      setBgImageReady(false)
      return undefined
    }

    let cancelled = false
    const img = new Image()

    img.onload = () => {
      if (cancelled) return
      bgImageElRef.current = img
      setBgImageReady(true)
    }

    img.src = background.image

    return () => {
      cancelled = true
    }
  }, [background.type, background.image])


  /*
    ==========================================================
    ENVIO DE IMAGENS (arte e fundo)

    Centralizado aqui para servir ao painel, ao arrastar-e-soltar
    sobre a cena e ao "colar" (Ctrl+V). Imagens gigantes são
    reduzidas para um tamanho seguro de textura.
    ==========================================================
  */
  const latest = useRef({})
  latest.current = { modelId, artZones, linkArt, activeZoneKey }

  const applyArtFile = useCallback(async (zoneKey, file) => {
    if (!file) return

    if (!isImageFile(file)) {
      toast.error('Envie um arquivo de imagem (PNG, JPG ou WEBP).')
      return
    }

    let prepared

    try {
      prepared = await prepareImage(file, file.name)
    } catch (error) {
      toast.error(error.message)
      return
    }

    const { img, resized } = prepared

    if (resized) {
      toast.info('Imagem muito grande: foi reduzida para 4096 px para funcionar bem em qualquer aparelho.')
    }

    const zone = latest.current.artZones[zoneKey] || {}

    /*
      Avisa quando a imagem tem poucos pixels para o tamanho
      físico configurado — evita descobrir a baixa qualidade só
      depois de exportar.
    */
    const pxPerMm = Math.min(
      img.naturalWidth / (zone.widthMM || 210),
      img.naturalHeight / (zone.heightMM || 92)
    )

    if (pxPerMm < MIN_PX_PER_MM) {
      toast.warning(
        'A imagem enviada tem resolução baixa para o tamanho configurado — pode sair borrada na impressão.',
        { duration: 6000 }
      )
    }

    setActiveZoneKey(zoneKey)

    setArtZones((zones) => {
      const targets = latest.current.linkArt
        ? getModel(latest.current.modelId).printZones.map((z) => z.key)
        : [zoneKey]

      const next = { ...zones }

      for (const key of targets) {
        next[key] = {
          ...(zones[key] || zone),
          image: img,
          fileName: file.name,
        }
      }

      return next
    })
  }, [toast])


  const applyBackgroundFile = useCallback(async (file) => {
    if (!file) return

    if (!isImageFile(file)) {
      toast.error('Envie um arquivo de imagem (PNG, JPG ou WEBP).')
      return
    }

    let prepared

    try {
      prepared = await prepareImage(file, file.name)
    } catch (error) {
      toast.error(error.message)
      return
    }

    if (prepared.resized) {
      toast.info('Imagem de fundo muito grande: foi reduzida para 4096 px.')
    }

    setBackground((b) => ({
      ...b,
      type: 'image',
      image: prepared.url,
      bgName: file.name,

      // reinicia encaixe/zoom/posição a cada nova imagem
      fit: 'cover',
      zoom: 1,
      offsetXFrac: 0.5,
      offsetYFrac: 0.5,
    }))
  }, [toast])


  /*
    Arquivos soltos na cena ou colados: com várias áreas de arte,
    preenche as vazias na ordem, começando pela área selecionada.
  */
  const handleDroppedFiles = useCallback((fileList) => {
    const files = [...(fileList || [])].filter(isImageFile)

    if (!files.length) return false

    const { modelId: id, artZones: zonesState, linkArt: linked, activeZoneKey: active } =
      latest.current

    const keys = getModel(id).printZones.map((z) => z.key)
    const start = Math.max(0, keys.indexOf(active))

    if (linked || keys.length === 1) {
      applyArtFile(keys[start], files[0])
      return true
    }

    const order = [...keys.slice(start), ...keys.slice(0, start)]
    const empty = order.filter((k) => !zonesState[k]?.image)
    const targets = empty.length ? empty : order

    files.slice(0, targets.length).forEach((file, i) => {
      applyArtFile(targets[i], file)
    })

    return true
  }, [applyArtFile])


  // Ctrl+V com uma imagem na área de transferência
  useEffect(() => {
    const onPaste = (e) => {
      const tag = e.target?.tagName

      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (handleDroppedFiles(e.clipboardData?.files)) e.preventDefault()
    }

    window.addEventListener('paste', onPaste)

    return () => window.removeEventListener('paste', onPaste)
  }, [handleDroppedFiles])


  /*
    ==========================================================
    SALVAMENTO AUTOMÁTICO + RESTAURAÇÃO

    O que você configura fica guardado neste navegador e volta
    ao reabrir a página (as imagens ficam no IndexedDB).
    ==========================================================
  */
  useEffect(() => {
    if (!saved) return undefined

    let cancelled = false

    ;(async () => {
      for (const key of Object.keys(saved.artZones || {})) {
        const record = await getBlob(`art:${key}`)

        if (!record || cancelled) continue

        try {
          const prepared = await prepareImage(record.blob, record.name)

          if (cancelled) return

          setArtZones((zones) =>
            zones[key] && !zones[key].image
              ? {
                  ...zones,
                  [key]: {
                    ...zones[key],
                    image: prepared.img,
                    fileName: record.name,
                  },
                }
              : zones
          )
        } catch {
          // arquivo guardado ilegível: ignora
        }
      }

      const bg = await getBlob('bg')

      if (!bg || cancelled) return

      try {
        const prepared = await prepareImage(bg.blob, bg.name)

        if (cancelled) return

        setBackground((b) =>
          b.image
            ? b
            : {
                ...b,
                image: prepared.url,
                bgName: bg.name,
                type: saved.background?.type === 'image' ? 'image' : b.type,
              }
        )
      } catch {
        // ignora
      }
    })()

    return () => {
      cancelled = true
    }
  }, [saved])


  const persistedBlobs = useRef({})

  useEffect(() => {
    const timer = setTimeout(() => {
      const zonesToSave = {}

      for (const [key, zone] of Object.entries(artZones)) {
        zonesToSave[key] = {
          widthMM: zone.widthMM,
          heightMM: zone.heightMM,
          offsetXMM: zone.offsetXMM,
          offsetYMM: zone.offsetYMM,
          mugRealHeightMM: zone.mugRealHeightMM,
        }
      }

      saveSettings({
        modelId,
        artZones: zonesToSave,
        partColors,
        glassOpacity,
        mugShine,
        background: {
          type: background.type,
          color: background.color,
          fit: background.fit,
          zoom: background.zoom,
          offsetXFrac: background.offsetXFrac,
          offsetYFrac: background.offsetYFrac,
        },
        exportFormatId,
        transparentBg,
        imageFormat,
        imageScale,
        videoSpeed,
        videoEffect,
        videoQuality,
        linkArt,
      })

      // imagens: grava as novas e apaga as removidas
      const wanted = {}

      for (const [key, zone] of Object.entries(artZones)) {
        if (zone.image?.src) {
          wanted[`art:${key}`] = { url: zone.image.src, name: zone.fileName }
        }
      }

      if (background.image) {
        wanted.bg = { url: background.image, name: background.bgName }
      }

      for (const [key, item] of Object.entries(wanted)) {
        if (persistedBlobs.current[key] === item.url) continue

        const blob = getBlobForUrl(item.url)

        if (blob) {
          putBlob(key, blob, item.name || 'imagem')
          persistedBlobs.current[key] = item.url
        }
      }

      for (const key of Object.keys(persistedBlobs.current)) {
        if (!wanted[key]) {
          deleteBlob(key)
          delete persistedBlobs.current[key]
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [
    artZones, background, partColors, glassOpacity, mugShine, modelId,
    exportFormatId, transparentBg, imageFormat, imageScale,
    videoSpeed, videoEffect, videoQuality, linkArt,
  ])


  /*
    ==========================================================
    DESFAZER / REFAZER (Ctrl+Z · Ctrl+Shift+Z / Ctrl+Y)
    ==========================================================
  */
  const snapshot = useMemo(
    () => ({ modelId, artZones, partColors, background, glassOpacity, mugShine }),
    [modelId, artZones, partColors, background, glassOpacity, mugShine]
  )

  const restoreSnapshot = useCallback((snap) => {
    setModelId(snap.modelId)
    setArtZones(snap.artZones)
    setPartColors(snap.partColors)
    setBackground(snap.background)
    setGlassOpacity(snap.glassOpacity)
    setMugShine(snap.mugShine)
  }, [])

  const { undo, redo, canUndo, canRedo } = useHistory(snapshot, restoreSnapshot)

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName

      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (!(e.ctrlKey || e.metaKey) || e.altKey) return

      const key = e.key.toLowerCase()

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])


  const registerApi =
    useCallback((api) => {
      apiRef.current = api
    }, [])


  const buildFileName = (ext) => {
    const formatSuffix =
      activeFormat.id !== 'free'
        ? `-${activeFormat.id}`
        : ''

    const transparencySuffix =
      (ext === 'png' || ext === 'webp') && transparentBg
        ? '-transparente'
        : ''

    return `mockup-caneca${formatSuffix}${transparencySuffix}.${ext}`
  }


  const buildBackgroundOptions = () => {
    if (
      background.type !== 'image' ||
      !bgImageReady ||
      !bgImageElRef.current
    ) {
      return null
    }

    return {
      color: background.color,
      image: bgImageElRef.current,
      naturalWidth: bgImageElRef.current.naturalWidth,
      naturalHeight: bgImageElRef.current.naturalHeight,
      fit: background.fit,
      zoom: background.zoom,
      offsetXFrac: background.offsetXFrac,
      offsetYFrac: background.offsetYFrac,
    }
  }


  const handleScreenshot = () => {
    if (!apiRef.current || isExportingImage) return

    setExportError(null)
    setIsExportingImage(true)

    const format =
      activeFormat.width
        ? activeFormat
        : null

    const wantsTransparent =
      transparentBg && imageFormat !== 'jpeg'

    const backgroundOptions =
      wantsTransparent
        ? null
        : buildBackgroundOptions()

    /*
      requestAnimationFrame dá tempo do navegador pintar o
      estado "Gerando..." antes do trabalho síncrono do
      screenshot travar a thread principal por um instante.
    */
    requestAnimationFrame(() => {
      try {
        const dataUrl =
          apiRef.current.screenshot({
            multiplier: 3,
            transparent: wantsTransparent,
            imageType: imageFormat,
            scale: imageScale,
            format,
            backgroundOptions,
            cropOffsetXFrac,
            cropOffsetYFrac,
          })

        setPreviewModal({
          type: 'image',
          url: dataUrl,
          filename: buildFileName(imageFormat === 'jpeg' ? 'jpg' : imageFormat),
        })
      } catch {
        setExportError('Não foi possível gerar a imagem. Tente novamente.')
        toast.error('Não foi possível gerar a imagem.')
      } finally {
        setIsExportingImage(false)
      }
    })
  }


  const handleRecord = () => {
    if (
      !apiRef.current ||
      isRecording
    ) {
      return
    }
  
    setExportError(null)
    setIsRecording(true)
    setRecordProgress(0)
  
    const format =
      activeFormat.width
        ? activeFormat
        : null
  
    const backgroundOptions =
      buildBackgroundOptions()
  
    const duration =
      ROTATE_SECONDS /
      Number(videoSpeed)
  
    const startTime =
      Date.now()
  
    const progressTimer =
      setInterval(() => {
        const elapsed =
          Date.now() - startTime
  
        setRecordProgress(
          Math.min(
            100,
            (elapsed /
              (duration * 1000)) *
              100
          )
        )
      }, 100)
  
    apiRef.current.startRecording(
      (
        blob,
        mimeType,
        error
      ) => {
        clearInterval(
          progressTimer
        )
  
        setIsRecording(false)
        setRecordProgress(0)
  
        if (
          error ||
          !blob
        ) {
          const message =
            error ||
            'Não foi possível gravar o vídeo.'

          setExportError(message)
          toast.error(message)
  
          return
        }
  
        const isMp4 =
          mimeType &&
          mimeType.includes('mp4')
  
        setPreviewModal({
          type: 'video',
          url:
            URL.createObjectURL(
              blob
            ),
          blob,
          isMp4,
          filename:
            buildFileName(
              isMp4
                ? 'mp4'
                : 'webm'
            ),
        })
      },
      {
        format,
        backgroundOptions,
        cropOffsetXFrac,
        cropOffsetYFrac,
        speed: videoSpeed,
        effect: videoEffect,
        quality: videoQuality,
      }
    )
  }


  const handleClosePreview = () => {
    if (
      previewModal?.type === 'video' &&
      previewModal.url
    ) {
      URL.revokeObjectURL(previewModal.url)
    }

    setPreviewModal(null)
  }


  const handleConfirmDownload = () => {
    if (!previewModal) return

    if (previewModal.type === 'image') {

      const a = document.createElement('a')
      a.href = previewModal.url
      a.download = previewModal.filename

      document.body.appendChild(a)
      a.click()
      a.remove()

      toast.success('Imagem baixada com sucesso!')

    } else {

      downloadBlob(
        previewModal.blob,
        previewModal.filename
      )

      if (!previewModal.isMp4) {
        setExportError(
          'Seu navegador não suporta MP4 diretamente. O vídeo foi salvo em WebM.'
        )
        toast.warning('Vídeo salvo em WebM (seu navegador não suporta MP4 direto).')
      } else {
        toast.success('Vídeo baixado com sucesso!')
      }

    }

    handleClosePreview()
  }


  useEffect(() => {
    if (background.type !== 'image' || !background.image) {
      setBgEditMode(false)
    }
  }, [background.type, background.image])

  const handleBgEditStart = useCallback(() => setBgEditMode(true), [])
  const handleBgEditDone = useCallback(() => setBgEditMode(false), [])

  const handleResetView = useCallback(() => {
    setResetToken((n) => n + 1)
  }, [])

  const frameAspect = activeFormat.width
    ? activeFormat.width / activeFormat.height
    : null

  const handleCropOffsetChange = useCallback((x, y) => {
    setCropOffsetXFrac(x)
    setCropOffsetYFrac(y)
  }, [])

  const exportProps = {
    exportFormatId,
    setExportFormatId,
    transparentBg,
    setTransparentBg,
    imageFormat,
    setImageFormat,
    imageScale,
    setImageScale,
    videoQuality,
    setVideoQuality,
    videoSpeed,
    setVideoSpeed,
    videoEffect,
    setVideoEffect,
    isRecording,
    isExportingImage,
    handleScreenshot,
    handleRecord,
    recordProgress,
    exportError,
  }

  const viewportProps = {
    viewportRef,
    artZones,
    background,
    setBackground,
    partColors,
    glassOpacity,
    mugShine,
    modelId,
    magicPlaying,
    setMagicPlaying,
    setWarning,
    registerApi,
    spinTargetRef,
    videoSpeed,
    videoEffect,
    videoQuality,
    activeFormat,
    cropOffsetXFrac,
    cropOffsetYFrac,
    onCropOffsetChange: handleCropOffsetChange,
    bgEditMode,
    onBgEditStart: handleBgEditStart,
    onBgEditDone: handleBgEditDone,
    resetToken,
    onResetView: handleResetView,
    onDropFiles: handleDroppedFiles,
  }

  const controlsProps = {
    artZones,
    setArtZones,
    background,
    setBackground,
    partColors,
    setPartColors,
    glassOpacity,
    setGlassOpacity,
    mugShine,
    setMugShine,
    modelId,
    setModelId,
    warning,

    linkArt,
    setLinkArt,
    activeZoneKey,
    setActiveZoneKey,
    frameAspect,
    onEditBackground: handleBgEditStart,
    onArtFile: applyArtFile,
    onBackgroundFile: applyBackgroundFile,
  }


  /*
    ==========================================================
    LAYOUT DE CELULAR

    Em telas pequenas o site vira um "app": cena 3D em tela
    cheia, abas inferiores e painel deslizante (bottom sheet).
    Todo o estado continua aqui no App — o MobileShell só
    organiza a apresentação.
    ==========================================================
  */
  if (section === 'sheet') {
    return (
      <SheetStudio
        sheet={sheet}
        isMobile={isMobile}
        onSection={setSection}
      />
    )
  }

  if (isMobile) {
    return (
      <>
        <MobileShell
          onOpenSheet={() => setSection('sheet')}
          controlsProps={controlsProps}
          viewportProps={viewportProps}
          exportProps={exportProps}
          almatieUrl={ALMATIE_URL}
          isBusy={isRecording || isExportingImage}
          history={{ undo, redo, canUndo, canRedo }}
        />

        <ExportPreviewModal
          data={previewModal}
          onClose={handleClosePreview}
          onConfirm={handleConfirmDownload}
        />
      </>
    )
  }


  if (viewMode === 'expanded') {
    return (
      <>
        <MobileShell
          desktop
          viewMode={viewMode}
          onViewMode={setViewMode}
          controlsProps={controlsProps}
          viewportProps={viewportProps}
          exportProps={exportProps}
          almatieUrl={ALMATIE_URL}
          isBusy={isRecording || isExportingImage}
          history={{ undo, redo, canUndo, canRedo }}
        />

        <ExportPreviewModal
          data={previewModal}
          onClose={handleClosePreview}
          onConfirm={handleConfirmDownload}
        />
      </>
    )
  }


  return (
    <div className="app" data-view={viewMode}>

      {/* CABEÇALHO */}

      <SiteHeader
        section="mockup"
        onSection={setSection}
        subtitle="Mockup 3D de Canecas"
      >

          <div className="history-buttons">

            <button
              type="button"
              className="history-btn"
              onClick={undo}
              disabled={!canUndo}
              data-tip="Desfazer · Ctrl+Z"
              aria-label="Desfazer"
            >
              <Icon name="undo" size={17} />
            </button>

            <button
              type="button"
              className="history-btn"
              onClick={redo}
              disabled={!canRedo}
              data-tip="Refazer · Ctrl+Shift+Z"
              aria-label="Refazer"
            >
              <Icon name="redo" size={17} />
            </button>

          </div>

          <ViewSizeSwitch
            value={viewMode}
            onChange={setViewMode}
          />

          <span className="editor-status">

            <span className="status-dot" />

            Editor

          </span>

      </SiteHeader>


      {/* ÁREA PRINCIPAL */}

      <div className="workspace">

        <ControlsPanel {...controlsProps} />


        <main className="stage" data-view={viewMode}>

          <div className="stage-header">

            <div className="stage-title-group">

              <div>

                <span className="section-kicker">
                  CRIADOR DE MOCKUP
                </span>

                <h2>
                  Visualização 3D
                </h2>

              </div>

              <div className="scene-badge" key={modelId}>
                {getModel(modelId).name}
              </div>

            </div>


            <div className="stage-tools">

              <FormatSwitch
                value={exportFormatId}
                onChange={setExportFormatId}
              />

              <span className="stage-tools-sep" aria-hidden="true" />

              <QuickActions {...exportProps} />

            </div>

          </div>


          <div className="stage-body">

            <div className="viewport-card">
              <Viewport {...viewportProps} />
            </div>

            {viewMode === 'square' && (
              <aside className="export-side">
                <div className="export-card">
                  <ExportPanel {...exportProps} />
                </div>
              </aside>
            )}

          </div>


          {viewMode === 'wide' && (
            <div className="export-card">
              <ExportPanel {...exportProps} />
            </div>
          )}

        </main>

      </div>


      <ExportPreviewModal
        data={previewModal}
        onClose={handleClosePreview}
        onConfirm={handleConfirmDownload}
      />

    </div>
  )
}

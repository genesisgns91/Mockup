import { useCallback, useEffect, useRef, useState } from 'react'
import { ROTATE_SECONDS } from './components/MugScene.jsx'
import ControlsPanel from './components/ControlsPanel.jsx'
import Viewport from './components/Viewport.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import MobileShell from './components/MobileShell.jsx'
import { useToast } from './components/Toast.jsx'
import { useIsMobile } from './hooks/useIsMobile.js'
import { EXPORT_FORMATS } from './config/exportFormats.js'
import { getModel, DEFAULT_MODEL_ID } from './config/models.js'

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
  const [artZones, setArtZones] = useState(() => {
    const initial = {}
    for (const zone of getModel(DEFAULT_MODEL_ID).printZones) {
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
    return initial
  })


  const [background, setBackground] = useState({
    type: 'color',
    color: '#F3ECE3',
    image: null,

    /*
      NOVO:
      Encaixe ('cover' | 'width' | 'height'), zoom (1 a 3)
      e posição de arraste (0 a 1) da imagem de fundo.
    */
    fit: 'cover',
    zoom: 1,
    offsetXFrac: 0.5,
    offsetYFrac: 0.5,
  })


  const [partColors, setPartColors] = useState(() => {
    const initial = {}
    for (const part of getModel(DEFAULT_MODEL_ID).colorParts) {
      initial[part.key] = part.default
    }
    return initial
  })


  /*
    Transparência (só usada por modelos de vidro —
    ver config.glassOpacity em src/config/models.js).
  */
  const [glassOpacity, setGlassOpacity] =
    useState(getModel(DEFAULT_MODEL_ID).glassOpacity?.default ?? 0.8)


  /*
    Controle de brilho das canecas.

    0 = fosco
    1 = brilho máximo
  */
  const [mugShine, setMugShine] =
    useState(0.5)


  const [modelId, setModelId] =
    useState(DEFAULT_MODEL_ID)

  const [magicPlaying, setMagicPlaying] =
    useState(false)

  /*
    Ao trocar de modelo, garante que toda "printZone" e todo
    "colorPart" do modelo novo tenham um valor no estado —
    sem apagar o que já existia (uma chave compartilhada como
    "body" continua com a cor que o usuário escolheu antes).
  */
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

    setGlassOpacity(config.glassOpacity?.default ?? 0.8)

    // toda troca de modelo começa pausada — o usuário decide quando ver a animação
    setMagicPlaying(false)
  }, [modelId])

  const [warning, setWarning] =
    useState(null)

  const [isRecording, setIsRecording] =
    useState(false)

    const [videoSpeed, setVideoSpeed] =
    useState(1)

const [videoEffect, setVideoEffect] =
    useState('mug')
    
    const [videoQuality, setVideoQuality] =
    useState('standard')

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
    useState('free')

  const [transparentBg, setTransparentBg] =
    useState(false)

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
    useState(false)

  const [activeZoneKey, setActiveZoneKey] =
    useState(null)

  /*
    Edição do fundo direto na cena e "recentralizar modelo".
  */
  const [bgEditMode, setBgEditMode] =
    useState(false)

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
      ext === 'png' && transparentBg
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

    const backgroundOptions =
      transparentBg
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
            transparent: transparentBg,
            format,
            backgroundOptions,
            cropOffsetXFrac,
            cropOffsetYFrac,
          })

        setPreviewModal({
          type: 'image',
          url: dataUrl,
          filename: buildFileName('png'),
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
  if (isMobile) {
    return (
      <>
        <MobileShell
          controlsProps={controlsProps}
          viewportProps={viewportProps}
          exportProps={exportProps}
          almatieUrl={ALMATIE_URL}
          isBusy={isRecording || isExportingImage}
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
    <div className="app">

      {/* CABEÇALHO */}

      <header className="site-header">

        <div className="brand-container">

          <div className="brand-symbol">
            A
          </div>

          <div className="brand">

            <h1>
              Almatiê
            </h1>

            <span>
              Mockup 3D de Canecas
            </span>

          </div>

        </div>


        <div className="header-right">

          <a
            className="almatie-link"
            href={ALMATIE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Ir para o site Almatiê"
            aria-label="Ir para o site Almatiê (abre em nova aba)"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17 17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>

          <span className="editor-status">

            <span className="status-dot" />

            Editor

          </span>

        </div>

      </header>


      {/* ÁREA PRINCIPAL */}

      <div className="workspace">

        <ControlsPanel {...controlsProps} />


        <main
          className="stage"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            minWidth: 0,
          }}
        >

          <div className="stage-header">

            <div>

              <span className="section-kicker">
                CRIADOR DE MOCKUP
              </span>

              <h2>
                Visualização 3D
              </h2>

            </div>

            <div className="scene-badge">
              {getModel(modelId).name}
            </div>

          </div>


          <div
            className="viewport-card"
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              flexShrink: 0,
              marginBottom: '24px',
            }}
          >
            <Viewport {...viewportProps} />
          </div>


          {/* EXPORTAÇÃO */}

          <div
            className="export-card"
            style={{
              position: 'relative',
              zIndex: 10,
              width: '100%',
              flexShrink: 0,
              marginTop: '0',
              clear: 'both',
            }}
          >
            <ExportPanel {...exportProps} />
          </div>

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

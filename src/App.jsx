import { useCallback, useEffect, useRef, useState } from 'react'
import MugScene, { ROTATE_SECONDS } from './components/MugScene.jsx'
import ControlsPanel from './components/ControlsPanel.jsx'
import { clamp01, getImageLayout } from './utils/exportLayout.js'


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
  FORMATOS DE EXPORTAÇÃO

  "free" mantém o comportamento original (tamanho do
  viewport). Os demais recortam a imagem/vídeo final para
  encaixar perfeitamente nas redes sociais, em alta
  qualidade (1080px no lado maior).
  ==========================================================
*/
const EXPORT_FORMATS = [
  {
    id: 'free',
    label: 'Livre',
    hint: 'Tamanho original',
    width: null,
    height: null,
  },
  {
    id: 'square',
    label: 'Quadrado',
    hint: '1080×1080 · Feed',
    width: 1080,
    height: 1080,
  },
  {
    id: 'portrait',
    label: 'Retrato',
    hint: '1080×1350 · Feed',
    width: 1080,
    height: 1350,
  },
  {
    id: 'story',
    label: 'Story',
    hint: '1080×1920 · Stories/Reels/TikTok',
    width: 1080,
    height: 1920,
  },
]


/*
  ==========================================================
  CAMADA DE FUNDO (IMAGEM)

  Renderizada em HTML, atrás do canvas 3D (que fica
  transparente quando o fundo é uma imagem). Aplica o
  encaixe (cobrir / largura / altura), o zoom e a posição
  de arraste vindos do painel de controle.

  Fica só de leitura aqui: a interação de arrastar acontece
  na pequena prévia dentro do painel, para não conflitar
  com o gesto de girar a caneca no viewport.
  ==========================================================
*/
function BackgroundImageLayer({ background, containerRef }) {
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [natural, setNatural] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current

    if (!el) return undefined

    const compute = () => {
      const rect = el.getBoundingClientRect()
      setBox({ width: rect.width, height: rect.height })
    }

    compute()

    const ro = new ResizeObserver(compute)
    ro.observe(el)

    return () => ro.disconnect()
  }, [containerRef])

  useEffect(() => {
    setNatural({ width: 0, height: 0 })
  }, [background.image])

  if (!background.image) return null

  const layout = getImageLayout(
    natural.width,
    natural.height,
    box.width,
    box.height,
    background.fit,
    background.zoom,
    background.offsetXFrac,
    background.offsetYFrac
  )

  return (
    <div className="bg-image-layer">
      <img
        src={background.image}
        alt=""
        draggable={false}
        onLoad={(e) =>
          setNatural({
            width: e.target.naturalWidth,
            height: e.target.naturalHeight,
          })
        }
        style={{
          width: `${layout.drawW}px`,
          height: `${layout.drawH}px`,
          transform: `translate(${layout.x}px, ${layout.y}px)`,
          opacity: natural.width ? 1 : 0,
        }}
      />
    </div>
  )
}


/*
  ==========================================================
  GUIA DE CORTE

  Sobrepõe ao viewport 3D um recorte que mostra exatamente
  a área que será mantida na exportação final. Pode ser
  arrastado (quando há espaço sobrando em algum eixo) para
  escolher o que fica visível no formato escolhido.
  ==========================================================
*/
function CropGuideOverlay({
  containerRef,
  format,
  offsetXFrac,
  offsetYFrac,
  onOffsetChange,
}) {
  const [box, setBox] = useState(null)
  const [containerSize, setContainerSize] = useState(null)
  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = containerRef.current

    if (!el || !format) {
      setBox(null)
      setContainerSize(null)
      return undefined
    }

    const compute = () => {
      const rect = el.getBoundingClientRect()

      if (!rect.width || !rect.height) return

      const targetAspect = format.width / format.height
      const containerAspect = rect.width / rect.height

      let w
      let h

      if (targetAspect < containerAspect) {
        h = rect.height
        w = rect.height * targetAspect
      } else {
        w = rect.width
        h = rect.width / targetAspect
      }

      setBox({ w, h })
      setContainerSize({ w: rect.width, h: rect.height })
    }

    compute()

    const ro = new ResizeObserver(compute)
    ro.observe(el)

    return () => ro.disconnect()
  }, [containerRef, format])

  if (!format || !box || !containerSize) return null

  const slackX = Math.max(0, containerSize.w - box.w)
  const slackY = Math.max(0, containerSize.h - box.h)
  const canDrag = slackX > 2 || slackY > 2

  const left = slackX * clamp01(offsetXFrac)
  const top = slackY * clamp01(offsetYFrac)

  const handlePointerDown = (e) => {
    if (!canDrag) return

    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offsetXFrac,
      startOffsetY: offsetYFrac,
    }
  }

  const handlePointerMove = (e) => {
    if (!dragRef.current) return

    e.stopPropagation()

    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY

    const nextX = slackX
      ? clamp01(
          dragRef.current.startOffsetX + deltaX / slackX
        )
      : 0.5

    const nextY = slackY
      ? clamp01(
          dragRef.current.startOffsetY + deltaY / slackY
        )
      : 0.5

    onOffsetChange(nextX, nextY)
  }

  const handlePointerUp = (e) => {
    dragRef.current = null
    setDragging(false)

    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignora se o ponteiro já foi liberado
      }
    }
  }

  return (
    <div className="crop-guide">
      <div
        className={
          canDrag
            ? `crop-guide-frame draggable${dragging ? ' dragging' : ''}`
            : 'crop-guide-frame'
        }
        style={{
          width: `${box.w}px`,
          height: `${box.h}px`,
          left: `${left}px`,
          top: `${top}px`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >

        <span className="crop-guide-tag">
          {format.hint}
        </span>

        {canDrag && (
          <span className="crop-guide-drag-hint">
            ⇕ Arraste para ajustar o enquadramento
          </span>
        )}

      </div>
    </div>
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
  if (!data) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>

      <div
        className="modal-card"
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
            aria-label="Fechar"
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
  const [art, setArt] = useState({
    image: null,
    fileName: null,
    widthMM: 210,
    heightMM: 92,
    offsetXMM: 0,
    offsetYMM: 0,
    mugRealHeightMM: 95,
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


  const [mugColors, setMugColors] = useState({
    body: '#ffffff',
    handle: '#ffffff',
    inside: '#ffffff',
  })


  /*
    Controle de brilho das canecas.

    0 = fosco
    1 = brilho máximo
  */
  const [mugShine, setMugShine] =
    useState(0.5)


  const [modelId, setModelId] =
    useState('single')

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
    if (!apiRef.current) return

    setExportError(null)

    const format =
      activeFormat.width
        ? activeFormat
        : null

    const backgroundOptions =
      transparentBg
        ? null
        : buildBackgroundOptions()

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
          setExportError(
            error ||
            'Não foi possível gravar o vídeo.'
          )
  
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

    } else {

      downloadBlob(
        previewModal.blob,
        previewModal.filename
      )

      if (!previewModal.isMp4) {
        setExportError(
          'Seu navegador não suporta MP4 diretamente. O vídeo foi salvo em WebM.'
        )
      }

    }

    handleClosePreview()
  }


  return (
    <div className="app">

      {/* ==================================================
          CABEÇALHO
      ================================================== */}

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

          <span className="editor-status">

            <span className="status-dot" />

            Editor

          </span>

        </div>

      </header>


      {/* ==================================================
          ÁREA PRINCIPAL
      ================================================== */}

      <div className="workspace">


        <ControlsPanel
          art={art}
          setArt={setArt}

          background={background}
          setBackground={setBackground}

          mugColors={mugColors}
          setMugColors={setMugColors}

          mugShine={mugShine}
          setMugShine={setMugShine}

          modelId={modelId}
          setModelId={setModelId}

          warning={warning}
        />


        {/* ==================================================
            ÁREA 3D
        ================================================== */}

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

              {modelId === 'single' &&
                '1 caneca'}

              {modelId === 'duo' &&
                '2 canecas'}

              {modelId === 'trio' &&
                '3 canecas'}

              {modelId === 'trioPaper' &&
                '3 canecas + folha'}

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

  <div
    className="viewport"
    ref={viewportRef}
    style={{
      position: 'relative',
      overflow: 'hidden',
      isolation: 'isolate',
    }}
  >

    {/* FUNDO SÓLIDO DO VIEWPORT */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          background.type === 'color'
            ? background.color
            : 'transparent',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />


    {/* FUNDO DE IMAGEM */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <BackgroundImageLayer
        background={background}
        containerRef={viewportRef}
      />
    </div>


    {/* CANECA 3D */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
      }}
    >
      <MugScene
        art={{
          ...art,
          onWarning: setWarning,
        }}

        background={background}

        mugColors={mugColors}

        mugShine={mugShine}

        modelId={modelId}

        registerApi={registerApi}

        spinTargetRef={spinTargetRef}

        videoSpeed={videoSpeed}

        videoEffect={videoEffect}

        videoQuality={videoQuality}
      />
    </div>


    {/* GUIA DE CORTE */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 4,
        pointerEvents: 'none',
      }}
    >
      <CropGuideOverlay
        containerRef={viewportRef}
        format={
          activeFormat.width
            ? activeFormat
            : null
        }
        offsetXFrac={cropOffsetXFrac}
        offsetYFrac={cropOffsetYFrac}
        onOffsetChange={(x, y) => {
          setCropOffsetXFrac(x)
          setCropOffsetYFrac(y)
        }}
      />
    </div>


    {/* AJUDA */}
    <div
      className="viewport-help"
      style={{
        position: 'absolute',
        zIndex: 5,
      }}
    >

      <span className="help-icon">
        ↔
      </span>

      Arraste para girar

      <span className="help-divider">
        •
      </span>

      Scroll para aproximar

    </div>

  </div>

</div>


          {/* ==================================================
              EXPORTAÇÃO
          ================================================== */}

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

            <div className="export-heading">

              <div>

                <span>
                  FINALIZE SEU MOCKUP
                </span>

                <strong>
                  Exporte sua criação
                </strong>

              </div>


              <div className="ink-mark">
                ✦
              </div>

            </div>


            {/* ==================================================
                FORMATO DE EXPORTAÇÃO
            ================================================== */}

            <div className="format-selector">

              <div className="format-selector-heading">
                <strong>
                  Formato de exportação
                </strong>

                <small>
                  Escolha a proporção ideal para cada rede social
                </small>
              </div>


              <div className="format-options">

                {EXPORT_FORMATS.map((format) => (

                  <button
                    key={format.id}
                    type="button"
                    className={
                      exportFormatId === format.id
                        ? 'format-option active'
                        : 'format-option'
                    }
                    onClick={() =>
                      setExportFormatId(format.id)
                    }
                  >

                    <span
                      className={`format-shape shape-${format.id}`}
                    />

                    <span className="format-option-text">
                      <strong>
                        {format.label}
                      </strong>

                      <small>
                        {format.hint}
                      </small>
                    </span>

                  </button>

                ))}

              </div>


              <label className="transparent-toggle">

                <span className="transparent-toggle-text">
                  <strong>
                    Fundo transparente
                  </strong>

                  <small>
                    Remove o fundo da imagem (apenas PNG)
                  </small>
                </span>

                <span className="switch">

                  <input
                    type="checkbox"
                    checked={transparentBg}
                    onChange={(e) =>
                      setTransparentBg(e.target.checked)
                    }
                  />

                  <span className="switch-track">
                    <span className="switch-thumb" />
                  </span>

                </span>

              </label>

            </div>

            <div
  className="video-settings"
  style={{
    marginBottom: '16px',
    display: 'grid',
    gap: '12px',
  }}
>
  <div>
  <div>
  <strong>
    Qualidade do vídeo
  </strong>

  <div
    style={{
      display: 'flex',
      gap: '8px',
      marginTop: '8px',
      flexWrap: 'wrap',
    }}
  >
    {[
      {
        id: 'low',
        label: 'Baixo',
        hint: '360p',
      },
      {
        id: 'standard',
        label: 'Padrão',
        hint: '720p',
      },
      {
        id: 'high',
        label: 'Alto',
        hint: '1080p',
      },
    ].map((quality) => (
      <button
        key={quality.id}
        type="button"
        className={
          videoQuality === quality.id
            ? 'btn btn-primary'
            : 'btn btn-secondary'
        }
        onClick={() =>
          setVideoQuality(quality.id)
        }
        disabled={isRecording}
      >
        {quality.label}
        <small
          style={{
            display: 'block',
            marginTop: '2px',
          }}
        >
          {quality.hint}
        </small>
      </button>
    ))}
  </div>
</div>

    <strong>
      Velocidade do vídeo
    </strong>

    <div
      style={{
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
      }}
    >
      {[0.5, 1, 2].map(
        (speed) => (
          <button
            key={speed}
            type="button"
            className={
              videoSpeed === speed
                ? 'btn btn-primary'
                : 'btn btn-secondary'
            }
            onClick={() =>
              setVideoSpeed(speed)
            }
            disabled={isRecording}
          >
            {speed}x
          </button>
        )
      )}
    </div>
  </div>

  <div>
    <strong>
      Efeito
    </strong>

    <select
      value={videoEffect}
      onChange={(e) =>
        setVideoEffect(
          e.target.value
        )
      }
      disabled={isRecording}
      style={{
        width: '100%',
        marginTop: '8px',
        padding: '10px',
        borderRadius: '8px',
      }}
    >
      <option value="mug">
        Giro da caneca
      </option>

      <option value="zoom">
        Zoom lento
      </option>

      <option value="camera-up">
        Câmera subindo
      </option>

      <option value="camera-spin">
        Giro da câmera
      </option>

      <option value="zoom-mug">
        Giro + zoom
      </option>

      <option value="none">
        Sem movimento
      </option>
    </select>
  </div>
</div>

            <div className="export-actions">


              <button
                className="btn btn-primary export-button"
                onClick={handleScreenshot}
              >

                <span className="button-symbol">
                  ↓
                </span>

                <span>

                  <strong>
                    Salvar PNG
                  </strong>

                  <small>
                    Imagem em alta qualidade
                  </small>

                </span>

              </button>


              <button
                className="btn btn-secondary export-button"
                onClick={handleRecord}
                disabled={isRecording}
              >

                <span className="button-symbol">

                  {isRecording
                    ? '●'
                    : '▶'}

                </span>

                <span>

                  <strong>

                    {isRecording
                      ? 'Gravando...'
                      : 'Vídeo 360°'}

                  </strong>

                  <small>
                    Apresentação animada
                  </small>

                </span>

              </button>


            </div>


            {isRecording && (

              <div className="record-progress">
                <div
                  className="record-progress-fill"
                  style={{ width: `${recordProgress}%` }}
                />
              </div>

            )}


            {exportError && (

              <div className="export-note">

                <span>
                  !
                </span>

                {exportError}

              </div>

            )}

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

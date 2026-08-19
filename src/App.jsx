import { useCallback, useEffect, useRef, useState } from 'react'
import MugScene, { ROTATE_SECONDS } from './components/MugScene.jsx'
import ControlsPanel from './components/ControlsPanel.jsx'


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
  GUIA DE CORTE

  Sobrepõe ao viewport 3D um recorte que mostra exatamente
  a área que será mantida na exportação final, para o
  usuário compor a cena antes de salvar.
  ==========================================================
*/
function CropGuideOverlay({ containerRef, format }) {
  const [box, setBox] = useState(null)

  useEffect(() => {
    const el = containerRef.current

    if (!el || !format) {
      setBox(null)
      return undefined
    }

    const compute = () => {
      const rect = el.getBoundingClientRect()

      if (!rect.width || !rect.height) return

      const targetAspect =
        format.width / format.height

      const containerAspect =
        rect.width / rect.height

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
    }

    compute()

    const ro = new ResizeObserver(compute)
    ro.observe(el)

    return () => ro.disconnect()
  }, [containerRef, format])

  if (!format || !box) return null

  return (
    <div className="crop-guide">
      <div
        className="crop-guide-frame"
        style={{
          width: `${box.w}px`,
          height: `${box.h}px`,
        }}
      >
        <span className="crop-guide-tag">
          {format.hint}
        </span>
      </div>
    </div>
  )
}


/*
  ==========================================================
  MODAL DE PRÉVIA

  Mostra o resultado final (imagem ou vídeo, já no formato
  e recorte escolhidos) antes de confirmar o download.
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
  })


  const [mugColors, setMugColors] = useState({
    body: '#ffffff',
    handle: '#ffffff',
    inside: '#ffffff',
  })


  /*
    NOVO:
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

  const [recordProgress, setRecordProgress] =
    useState(0)

  const [exportError, setExportError] =
    useState(null)


  /*
    NOVO:
    Formato de exportação (proporção) e
    opção de fundo transparente para PNG.
  */
  const [exportFormatId, setExportFormatId] =
    useState('free')

  const [transparentBg, setTransparentBg] =
    useState(false)

  const [previewModal, setPreviewModal] =
    useState(null)


  const activeFormat =
    EXPORT_FORMATS.find(
      (f) => f.id === exportFormatId
    ) || EXPORT_FORMATS[0]


  const apiRef = useRef(null)

  const spinTargetRef =
    useRef(null)

  const viewportRef =
    useRef(null)


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


  const handleScreenshot = () => {
    if (!apiRef.current) return

    setExportError(null)

    const format =
      activeFormat.width
        ? activeFormat
        : null

    const dataUrl =
      apiRef.current.screenshot({
        multiplier: 3,
        transparent: transparentBg,
        format,
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

    const startTime = Date.now()

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime

      setRecordProgress(
        Math.min(
          100,
          (elapsed / (ROTATE_SECONDS * 1000)) * 100
        )
      )
    }, 100)

    apiRef.current.startRecording(
      (
        blob,
        mimeType,
        error
      ) => {
        clearInterval(progressTimer)
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
          url: URL.createObjectURL(blob),
          blob,
          isMp4,
          filename: buildFileName(
            isMp4 ? 'mp4' : 'webm'
          ),
        })
      },
      { format }
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

        <main className="stage">

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


          <div className="viewport-card">

            <div
              className="viewport"
              ref={viewportRef}
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
              />


              <CropGuideOverlay
                containerRef={viewportRef}
                format={
                  activeFormat.width
                    ? activeFormat
                    : null
                }
              />


              <div className="viewport-help">

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

          <div className="export-card">

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

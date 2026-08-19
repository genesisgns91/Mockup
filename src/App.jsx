import { useCallback, useRef, useState } from 'react'
import MugScene from './components/MugScene.jsx'
import ControlsPanel from './components/ControlsPanel.jsx'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename

  document.body.appendChild(a)
  a.click()
  a.remove()

  setTimeout(() => URL.revokeObjectURL(url), 2000)
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
    color: '#e7e2da',
    image: null,
  })

  const [mugColors, setMugColors] = useState({
    body: '#ffffff',
    handle: '#ffffff',
    inside: '#ffffff',
  })

  const [mugCount, setMugCount] = useState(1)
  const [warning, setWarning] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [exportError, setExportError] = useState(null)

  const apiRef = useRef(null)
  const spinTargetRef = useRef(null)

  const registerApi = useCallback((api) => {
    apiRef.current = api
  }, [])

  const handleScreenshot = () => {
    if (!apiRef.current) return

    setExportError(null)

    const dataUrl = apiRef.current.screenshot(3)

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'mockup-caneca.png'

    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleRecord = () => {
    if (!apiRef.current || isRecording) return

    setExportError(null)
    setIsRecording(true)

    apiRef.current.startRecording((blob, mimeType, error) => {
      setIsRecording(false)

      if (error || !blob) {
        setExportError(error || 'Não foi possível gravar o vídeo.')
        return
      }

      const isMp4 = mimeType && mimeType.includes('mp4')

      downloadBlob(
        blob,
        isMp4 ? 'mockup-caneca.mp4' : 'mockup-caneca.webm'
      )

      if (!isMp4) {
        setExportError(
          'Seu navegador não suporta gravação direta em MP4. O vídeo foi salvo em WebM.'
        )
      }
    })
  }

  return (
    <div className="app">

      {/* =========================
          BARRA SUPERIOR
      ========================== */}

      <header className="topbar">

        <div className="brand">
          <div className="brand-mark">
            M
          </div>

          <div className="brand-info">
            <strong>Mockup 3D</strong>
            <span>Canecas</span>
          </div>
        </div>

        <div className="topbar-status">
          <span className="status-dot" />
          <span>Editor ativo</span>
        </div>

      </header>


      {/* =========================
          ÁREA PRINCIPAL
      ========================== */}

      <div className="workspace">

        <ControlsPanel
          art={art}
          setArt={setArt}
          background={background}
          setBackground={setBackground}
          mugColors={mugColors}
          setMugColors={setMugColors}
          mugCount={mugCount}
          setMugCount={setMugCount}
          warning={warning}
        />


        {/* =========================
            CANVAS / CENA 3D
        ========================== */}

        <main className="stage">

          <div className="stage-header">

            <div>
              <span className="stage-eyebrow">
                VISUALIZAÇÃO
              </span>

              <h1>
                Mockup da sua caneca
              </h1>
            </div>

            <div className="scene-info">
              <span>
                {mugCount} {mugCount === 1 ? 'caneca' : 'canecas'}
              </span>
            </div>

          </div>


          <div className="viewport-wrapper">

            <div className="viewport">

              <MugScene
                art={{
                  ...art,
                  onWarning: setWarning,
                }}
                background={background}
                mugColors={mugColors}
                mugCount={mugCount}
                registerApi={registerApi}
                spinTargetRef={spinTargetRef}
              />

              <div className="viewport-hint">
                <span className="mouse-icon">↔</span>
                Arraste para girar
                <span className="hint-separator">•</span>
                Scroll para aproximar
              </div>

            </div>

          </div>


          {/* =========================
              EXPORTAÇÃO
          ========================== */}

          <div className="export-area">

            <div className="export-title">
              <span>EXPORTAR MOCKUP</span>
              <small>Alta qualidade</small>
            </div>

            <div className="toolbar">

              <button
                className="action-button primary"
                onClick={handleScreenshot}
              >
                <span className="button-icon">↓</span>

                <span>
                  <strong>Salvar PNG</strong>
                  <small>Imagem em alta resolução</small>
                </span>
              </button>


              <button
                className="action-button secondary"
                onClick={handleRecord}
                disabled={isRecording}
              >
                <span className="button-icon">
                  {isRecording ? '●' : '▶'}
                </span>

                <span>
                  <strong>
                    {isRecording
                      ? 'Gravando...'
                      : 'Vídeo 360°'}
                  </strong>

                  <small>
                    {isRecording
                      ? 'Aguarde a gravação terminar'
                      : 'Exportar apresentação'}
                  </small>
                </span>
              </button>

            </div>

            {exportError && (
              <div className="export-note">
                <span>!</span>
                {exportError}
              </div>
            )}

          </div>

        </main>

      </div>

    </div>
  )
}
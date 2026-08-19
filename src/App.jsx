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

  setTimeout(
    () => URL.revokeObjectURL(url),
    2000
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

  const [exportError, setExportError] =
    useState(null)


  const apiRef = useRef(null)

  const spinTargetRef =
    useRef(null)


  const registerApi =
    useCallback((api) => {
      apiRef.current = api
    }, [])


  const handleScreenshot = () => {
    if (!apiRef.current) return

    setExportError(null)

    const dataUrl =
      apiRef.current.screenshot(3)

    const a =
      document.createElement('a')

    a.href = dataUrl
    a.download =
      'mockup-caneca.png'

    document.body.appendChild(a)
    a.click()
    a.remove()
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

    apiRef.current.startRecording(
      (
        blob,
        mimeType,
        error
      ) => {
        setIsRecording(false)

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

        downloadBlob(
          blob,
          isMp4
            ? 'mockup-caneca.mp4'
            : 'mockup-caneca.webm'
        )

        if (!isMp4) {
          setExportError(
            'Seu navegador não suporta MP4 diretamente. O vídeo foi salvo em WebM.'
          )
        }
      }
    )
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

            <div className="viewport">

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

    </div>
  )
}
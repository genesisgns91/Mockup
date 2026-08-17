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
      downloadBlob(blob, isMp4 ? 'mockup-caneca.mp4' : 'mockup-caneca.webm')
      if (!isMp4) {
        setExportError(
          'Seu navegador não suporta gravação direta em MP4; o vídeo foi salvo em WebM (você pode converter para MP4 em qualquer conversor online, sem perda de qualidade).'
        )
      }
    })
  }

  return (
    <div className="app">
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
      <main className="stage">
        <div className="viewport">
          <MugScene
            art={{ ...art, onWarning: setWarning }}
            background={background}
            mugColors={mugColors}
            mugCount={mugCount}
            registerApi={registerApi}
            spinTargetRef={spinTargetRef}
          />
        </div>
        <div className="toolbar">
          <button onClick={handleScreenshot}>📷 Salvar imagem (PNG, alta qualidade)</button>
          <button onClick={handleRecord} disabled={isRecording}>
            {isRecording ? '🎥 Gravando...' : '🎥 Salvar vídeo 360° (MP4)'}
          </button>
        </div>
        {exportError && <p className="export-note">{exportError}</p>}
      </main>
    </div>
  )
}

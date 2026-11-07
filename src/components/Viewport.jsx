import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { clamp01, clampZoom, getImageLayout } from '../utils/exportLayout.js'
import { getModel } from '../config/models.js'

/*
  A cena 3D (Three.js) é a parte mais pesada do site: é carregada
  sob demanda, para a interface aparecer mais rápido.
*/
const MugScene = lazy(() => import('./MugScene.jsx'))


/*
  Proteção contra falhas: se o 3D não carregar (rede, modelo
  corrompido, memória), mostra uma mensagem com "Tentar de novo"
  em vez de deixar a tela em branco. Trocar de modelo também
  reinicia a tentativa automaticamente.
*/
class SceneErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <SceneNotice
        title="Não foi possível carregar o modelo 3D"
        text="Verifique sua conexão e tente de novo, ou escolha outro modelo."
        action="Tentar de novo"
        onAction={() => {
          this.setState({ error: null })
          this.props.onRetry()
        }}
      />
    )
  }
}

function SceneNotice({ title, text, action, onAction }) {
  return (
    <div className="scene-notice" role="alert">
      <div className="scene-notice-card">
        <strong>{title}</strong>
        <p>{text}</p>
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {action}
        </button>
      </div>
    </div>
  )
}

function SceneLoader({ label }) {
  return (
    <div className="scene-loader" role="status" aria-live="polite">
      <span className="scene-loader-ring" aria-hidden="true" />
      <span className="scene-loader-text">{label}</span>
    </div>
  )
}


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
  EDIÇÃO DO FUNDO DIRETO NA CENA

  Camada transparente por cima do 3D: um dedo (ou o mouse)
  arrasta a imagem de fundo; pinça (ou scroll) muda o zoom.
  Enquanto está ativa, o gesto NÃO gira o modelo.
  ==========================================================
*/
function BackgroundEditOverlay({
  background,
  setBackground,
  containerRef,
  onDone,
}) {
  const overlayRef = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const [natural, setNatural] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!background.image) return undefined

    let cancelled = false
    const img = new Image()

    img.onload = () => {
      if (!cancelled) {
        setNatural({ width: img.naturalWidth, height: img.naturalHeight })
      }
    }

    img.src = background.image

    return () => {
      cancelled = true
    }
  }, [background.image])

  const boxSize = () => {
    const rect = containerRef.current?.getBoundingClientRect()
    return { w: rect?.width || 1, h: rect?.height || 1 }
  }

  const beginGesture = () => {
    const pts = [...pointers.current.values()]
    if (!pts.length) {
      gesture.current = null
      return
    }

    const dist = pts.length > 1
      ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      : 0

    gesture.current = {
      cx: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      cy: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      dist,
      zoom: background.zoom || 1,
      ox: background.offsetXFrac ?? 0.5,
      oy: background.offsetYFrac ?? 0.5,
    }
  }

  const apply = () => {
    const g = gesture.current
    const pts = [...pointers.current.values()]
    if (!g || !pts.length) return

    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length

    let zoom = g.zoom

    if (pts.length > 1 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      zoom = clampZoom(g.zoom * (dist / g.dist))
    }

    const { w, h } = boxSize()

    const layout = getImageLayout(
      natural.width, natural.height, w, h,
      background.fit, zoom, 0.5, 0.5
    )

    // (caixa − imagem) é o "curso" de movimento em cada eixo
    const travelX = w - layout.drawW
    const travelY = h - layout.drawH

    const nextX = Math.abs(travelX) > 1
      ? clamp01(g.ox + (cx - g.cx) / travelX)
      : g.ox

    const nextY = Math.abs(travelY) > 1
      ? clamp01(g.oy + (cy - g.cy) / travelY)
      : g.oy

    setBackground((b) => ({
      ...b,
      zoom,
      offsetXFrac: nextX,
      offsetYFrac: nextY,
    }))
  }

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    beginGesture()
  }

  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    apply()
  }

  const onUp = (e) => {
    pointers.current.delete(e.pointerId)
    beginGesture()
  }

  // scroll do mouse = zoom (precisa de listener não-passivo)
  useEffect(() => {
    const el = overlayRef.current
    if (!el) return undefined

    const onWheel = (e) => {
      e.preventDefault()

      setBackground((b) => ({
        ...b,
        zoom: clampZoom((b.zoom || 1) * Math.exp(-e.deltaY * 0.0015)),
      }))
    }

    el.addEventListener('wheel', onWheel, { passive: false })

    return () => el.removeEventListener('wheel', onWheel)
  }, [setBackground])

  return (
    <div
      ref={overlayRef}
      className="bg-edit-overlay"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="bg-edit-hint">
        Arraste para mover o fundo
        <small>Pinça ou scroll para o zoom</small>
      </div>

      <button
        type="button"
        className="bg-edit-done"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onDone}
      >
        ✓ Concluir
      </button>
    </div>
  )
}


/*
  ==========================================================
  VIEWPORT 3D

  Conjunto completo da cena (fundo, caneca 3D, guia de corte,
  botão de efeito e ajuda). Usado tanto no layout de desktop
  quanto no de celular.

  QUADRO DE EXPORTAÇÃO: quando um formato (quadrado, retrato,
  story…) está escolhido, o próprio quadro da cena passa a ter
  essa proporção e fica centralizado na área disponível. Fundo,
  modelo 3D e arquivo exportado coincidem exatamente — o que
  aparece no quadro é o que sai no PNG/vídeo.
  ==========================================================
*/
export default function Viewport({
  viewportRef,
  className = 'viewport-area',
  helpText = null,
  showHelp = true,

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
  onCropOffsetChange,

  bgEditMode = false,
  onBgEditStart,
  onBgEditDone,
  resetToken = 0,
  onResetView,
  onDropFiles,
}) {
  const areaRef = useRef(null)
  const [frameSize, setFrameSize] = useState(null)

  const [modelLoading, setModelLoading] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [sceneKey, setSceneKey] = useState(0)
  const [dragging, setDragging] = useState(false)

  const handleLoadingChange = useCallback((value) => setModelLoading(value), [])
  const handleContextLost = useCallback(() => setContextLost(true), [])
  const handleContextRestored = useCallback(() => setContextLost(false), [])

  const reloadScene = useCallback(() => {
    setContextLost(false)
    setModelLoading(true)
    setSceneKey((k) => k + 1)
  }, [])

  const aspect = activeFormat?.width
    ? activeFormat.width / activeFormat.height
    : null

  useEffect(() => {
    const el = areaRef.current

    if (!el || !aspect) {
      setFrameSize(null)
      return undefined
    }

    const compute = () => {
      const rect = el.getBoundingClientRect()
      const pad = 14
      const availW = Math.max(40, rect.width - pad * 2)
      const availH = Math.max(40, rect.height - pad * 2)

      let w = availW
      let h = w / aspect

      if (h > availH) {
        h = availH
        w = h * aspect
      }

      setFrameSize({ w: Math.floor(w), h: Math.floor(h) })
    }

    compute()

    const ro = new ResizeObserver(compute)
    ro.observe(el)

    return () => ro.disconnect()
  }, [aspect])

  const framed = Boolean(aspect && frameSize)
  const hasBgImage = background.type === 'image' && background.image

  return (
    <div
      className={`${className}${framed ? ' has-frame' : ''}${dragging ? ' dragging' : ''}`}
      ref={areaRef}
      onDragOver={(e) => {
        if (onDropFiles && e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false)
      }}
      onDrop={(e) => {
        if (!onDropFiles) return

        e.preventDefault()
        setDragging(false)
        onDropFiles(e.dataTransfer.files)
      }}
    >

      <div
        className="viewport viewport-frame"
        ref={viewportRef}
        style={{
          position: 'relative',
          overflow: 'hidden',
          isolation: 'isolate',
          width: framed ? `${frameSize.w}px` : '100%',
          height: framed ? `${frameSize.h}px` : '100%',
          flex: 'none',
        }}
      >

        {/* FUNDO SÓLIDO (também aparece atrás de imagens menores que o quadro) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: background.color,
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
          <SceneErrorBoundary resetKey={modelId} onRetry={reloadScene}>
          <Suspense fallback={<SceneLoader label="Preparando a cena 3D…" />}>
          <MugScene
            key={sceneKey}
            onLoadingChange={handleLoadingChange}
            onContextLost={handleContextLost}
            onContextRestored={handleContextRestored}
            artZones={artZones}
            background={background}
            partColors={partColors}
            glassOpacity={glassOpacity}
            mugShine={mugShine}
            modelId={modelId}
            magicPlaying={magicPlaying}
            onWarning={setWarning}
            registerApi={registerApi}
            spinTargetRef={spinTargetRef}
            videoSpeed={videoSpeed}
            videoEffect={videoEffect}
            videoQuality={videoQuality}
            reframeKey={activeFormat?.id || 'free'}
            resetToken={resetToken}
          />
          </Suspense>
          </SceneErrorBoundary>
        </div>


        {/* CARREGANDO MODELO */}
        {modelLoading && !contextLost && (
          <SceneLoader label="Carregando modelo…" />
        )}

        {/* CONTEXTO WEBGL PERDIDO (pouca memória do aparelho) */}
        {contextLost && (
          <SceneNotice
            title="A cena 3D foi interrompida"
            text="O aparelho ficou sem memória gráfica. Toque para recarregar — seu trabalho continua salvo."
            action="Recarregar cena"
            onAction={reloadScene}
          />
        )}

        {/* ARRASTAR IMAGEM SOBRE A CENA */}
        {dragging && (
          <div className="drop-overlay" aria-hidden="true">
            <span>Solte a imagem para usar como arte</span>
          </div>
        )}


        {/* GUIA DE CORTE (só útil se o quadro não tiver a proporção exata) */}
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
            format={activeFormat?.width ? activeFormat : null}
            offsetXFrac={cropOffsetXFrac}
            offsetYFrac={cropOffsetYFrac}
            onOffsetChange={onCropOffsetChange}
          />
        </div>


        {/* BOTÃO DE PLAY — só aparece em modelos com animação (Caneca Mágica) */}
        {getModel(modelId).magicAnimation && !magicPlaying && (
          <button
            type="button"
            className="magic-play-button"
            style={{
              position: 'absolute',
              zIndex: 6,
            }}
            onClick={() => setMagicPlaying(true)}
          >
            <span className="magic-play-icon">
              ▶
            </span>

            Ver efeito térmico
          </button>
        )}


        {/* FERRAMENTAS RÁPIDAS DO QUADRO */}
        {!bgEditMode && (
          <div className="viewport-tools">
            <button
              type="button"
              className="viewport-tool"
              onClick={onResetView}
              aria-label="Recentralizar o modelo no quadro"
              title="Recentralizar o modelo"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3.2" />
                <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
              </svg>
            </button>

            {hasBgImage && (
              <button
                type="button"
                className="viewport-tool"
                onClick={onBgEditStart}
                aria-label="Ajustar o fundo na cena"
                title="Ajustar o fundo"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
                  <circle cx="9" cy="10" r="1.6" />
                  <path d="m4 17 5-4.5 3.5 3L16 12l4 4.5" />
                </svg>
              </button>
            )}
          </div>
        )}


        {/* AJUSTE DO FUNDO DIRETO NA CENA */}
        {bgEditMode && hasBgImage && (
          <BackgroundEditOverlay
            background={background}
            setBackground={setBackground}
            containerRef={viewportRef}
            onDone={onBgEditDone}
          />
        )}


        {/* AJUDA */}
        {showHelp && !bgEditMode && (
          <div
            className="viewport-help"
            style={{
              position: 'absolute',
              zIndex: 5,
            }}
          >
            {helpText || (
              <>
                <span className="help-icon">
                  ↔
                </span>

                Arraste para girar

                <span className="help-divider">
                  •
                </span>

                Scroll para aproximar
              </>
            )}
          </div>
        )}

      </div>

    </div>
  )
}

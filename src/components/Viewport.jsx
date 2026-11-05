import { useEffect, useRef, useState } from 'react'
import MugScene from './MugScene.jsx'
import { clamp01, getImageLayout } from '../utils/exportLayout.js'
import { getModel } from '../config/models.js'


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
  VIEWPORT 3D

  Conjunto completo da cena (fundo, caneca 3D, guia de corte,
  botão de efeito e ajuda). Usado tanto no layout de desktop
  quanto no de celular — só muda o texto de ajuda e a classe.
  ==========================================================
*/
export default function Viewport({
  viewportRef,
  className = 'viewport',
  helpText = null,
  showHelp = true,

  artZones,
  background,
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
}) {
  return (
    <div
      className={className}
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
          format={activeFormat.width ? activeFormat : null}
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


      {/* AJUDA */}
      {showHelp && (
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
  )
}

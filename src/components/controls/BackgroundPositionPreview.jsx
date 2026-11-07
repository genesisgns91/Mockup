import { useEffect, useRef, useState } from 'react'
import { clamp01, getImageLayout } from '../../utils/exportLayout.js'


/*
  ==========================================================
  PRÉVIA ARRASTÁVEL DO FUNDO

  Mostra a imagem de fundo já com o encaixe/zoom aplicados,
  e permite clicar e arrastar para escolher qual parte da
  imagem fica visível (equivalente ao offsetXFrac/offsetYFrac
  usados também na exportação).
  ==========================================================
*/
export function BackgroundPositionPreview({ background, setBackground, aspect = 16 / 10 }) {
  const containerRef = useRef(null)

  const [box, setBox] = useState({ width: 0, height: 0 })
  const [natural, setNatural] = useState({ width: 0, height: 0 })

  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)


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
  }, [])


  useEffect(() => {
    setNatural({ width: 0, height: 0 })
  }, [background.image])


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

  // "curso" de movimento: negativo quando a imagem é maior que a caixa
  const travelX = box.width - layout.drawW
  const travelY = box.height - layout.drawH
  const canDrag = Math.abs(travelX) > 1 || Math.abs(travelY) > 1


  const handlePointerDown = (e) => {
    if (!canDrag) return

    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: background.offsetXFrac ?? 0.5,
      startOffsetY: background.offsetYFrac ?? 0.5,
    }
  }


  const handlePointerMove = (e) => {
    if (!dragRef.current) return

    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY

    const nextX = Math.abs(travelX) > 1
      ? clamp01(
          dragRef.current.startOffsetX + deltaX / travelX
        )
      : dragRef.current.startOffsetX

    const nextY = Math.abs(travelY) > 1
      ? clamp01(
          dragRef.current.startOffsetY + deltaY / travelY
        )
      : dragRef.current.startOffsetY

    setBackground((b) => ({
      ...b,
      offsetXFrac: nextX,
      offsetYFrac: nextY,
    }))
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
    <div
      className="bg-position-preview"
      ref={containerRef}
      style={{
        aspectRatio: aspect,
        background: background.color,
      }}
    >

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={
          canDrag
            ? `bg-position-image draggable${dragging ? ' dragging' : ''}`
            : 'bg-position-image'
        }
        style={{
          width: `${layout.drawW}px`,
          height: `${layout.drawH}px`,
          transform: `translate(${layout.x}px, ${layout.y}px)`,
          opacity: natural.width ? 1 : 0,
        }}
      />

      {canDrag && (
        <span className="bg-position-hint">
          ⇕ Arraste para posicionar
        </span>
      )}

    </div>
  )
}

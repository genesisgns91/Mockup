import { useEffect, useRef, useState } from 'react'
import { placeArts } from './layout.js'

/*
  ==========================================================
  PRÉVIA DA FOLHA

  Desenha a folha em escala real (1 mm = N pixels): margens,
  artes (já espelhadas se for o caso) e o fundo em "xadrez" para
  deixar claro que o arquivo exportado é transparente.
  ==========================================================
*/
export default function SheetPreview({ sheet, onPickSlot }) {
  const { plan, items, settings, artSize, slots } = sheet

  const areaRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = areaRef.current

    if (!el) return undefined

    const measure = () => {
      const rect = el.getBoundingClientRect()

      setBox({ w: rect.width, h: rect.height })
    }

    measure()

    const observer = new ResizeObserver(measure)

    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  // sobra espaço embaixo para as "etiquetas" de informação
  const availW = box.w - 40
  const availH = box.h - 24 - 56

  const scale =
    box.w && box.h && !plan.invalid
      ? Math.max(0.2, Math.min(availW / plan.page.w, availH / plan.page.h))
      : 0

  const ghosts = !items.length ? placeArts(plan, settings.gap, slots) : []
  const shrunk = !plan.fullSize && !plan.invalid

  return (
    <div className="sheet-preview-area" ref={areaRef}>

      {scale > 0 && (
        <div
          className="sheet-paper"
          style={{
            width: plan.page.w * scale,
            height: plan.page.h * scale,
          }}
        >

          {/* margem de impressão */}
          <div
            className="sheet-margin"
            style={{
              left: settings.marginX * scale,
              right: settings.marginX * scale,
              top: settings.marginY * scale,
              bottom: settings.marginY * scale,
            }}
          />

          {/* espaços vazios (convite para enviar a arte) */}
          {ghosts.map((cell) => (
            <button
              key={`g${cell.slot}`}
              type="button"
              className="sheet-ghost"
              style={{
                left: cell.x * scale,
                top: cell.y * scale,
                width: cell.w * scale,
                height: cell.h * scale,
              }}
              onClick={() => onPickSlot && onPickSlot(cell.slot)}
              aria-label={`Enviar a arte ${cell.slot + 1}`}
            >
              <span className="sheet-ghost-plus">+</span>
              <span className="sheet-ghost-text">Arte {cell.slot + 1}</span>
            </button>
          ))}

          {/* artes */}
          {items.map((item, i) => {
            const frameW = (item.rotated ? item.h : item.w) * scale
            const frameH = (item.rotated ? item.w : item.h) * scale

            return (
              <div
                key={`${item.slot}-${item.art.url}`}
                className="sheet-art"
                style={{
                  left: item.x * scale,
                  top: item.y * scale,
                  width: item.w * scale,
                  height: item.h * scale,
                }}
              >
                <div
                  className="sheet-art-frame"
                  style={{
                    width: frameW,
                    height: frameH,
                    transform: `translate(-50%, -50%)${item.rotated ? ' rotate(90deg)' : ''}${settings.mirror ? ' scaleX(-1)' : ''}`,
                  }}
                >
                  <img
                    src={item.art.url}
                    alt={`Arte ${i + 1}`}
                    draggable={false}
                    style={{ objectFit: settings.fit === 'cover' ? 'cover' : 'contain' }}
                  />
                </div>

                <span className="sheet-art-tag">
                  {i + 1} · {Math.round(item.w * 10) / 10} × {Math.round(item.h * 10) / 10} mm
                </span>
              </div>
            )
          })}

        </div>
      )}

      {plan.invalid && (
        <p className="sheet-empty">
          Essa combinação de margem e medida não deixa espaço na folha.
        </p>
      )}

      <div className="sheet-chips" aria-live="polite">

        <span className="sheet-chip strong">
          {settings.paper} · {plan.orientation === 'landscape' ? 'paisagem' : 'retrato'}
        </span>

        <span className="sheet-chip">
          {artSize.w} × {artSize.h} mm
        </span>

        <span className="sheet-chip">
          {items.length} {items.length === 1 ? 'arte' : 'artes'} · cabem {plan.slots}
        </span>

        <span className="sheet-chip ok">Fundo transparente</span>

        {settings.mirror && <span className="sheet-chip accent">↔ Espelhado</span>}

        {shrunk && (
          <span className="sheet-chip warn">
            Reduzida a {Math.round(plan.scale * 100)}% pela margem
          </span>
        )}

      </div>

    </div>
  )
}

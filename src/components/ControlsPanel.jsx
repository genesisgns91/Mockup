import { useEffect, useRef, useState } from 'react'
import { clamp01, getImageLayout } from '../utils/exportLayout.js'


function Section({
  icon,
  title,
  description,
  children,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`control-section ${open ? 'open' : ''}`}>

      <button
        type="button"
        className="section-header"
        onClick={() => setOpen((value) => !value)}
      >

        <div className="section-title">

          <span className="section-icon">
            {icon}
          </span>

          <div>

            <strong>
              {title}
            </strong>

            {description && (
              <small>
                {description}
              </small>
            )}

          </div>

        </div>

        <span className="section-arrow">
          {open ? '−' : '+'}
        </span>

      </button>


      {open && (
        <div className="section-content">
          {children}
        </div>
      )}

    </section>
  )
}


/*
  ==========================================================
  PRÉVIA ARRASTÁVEL DO FUNDO

  Mostra a imagem de fundo já com o encaixe/zoom aplicados,
  e permite clicar e arrastar para escolher qual parte da
  imagem fica visível (equivalente ao offsetXFrac/offsetYFrac
  usados também na exportação).
  ==========================================================
*/
function BackgroundPositionPreview({ background, setBackground }) {
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

  const overflowX = Math.max(0, layout.drawW - box.width)
  const overflowY = Math.max(0, layout.drawH - box.height)
  const canDrag = overflowX > 1 || overflowY > 1


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

    const nextX = overflowX
      ? clamp01(
          dragRef.current.startOffsetX - deltaX / overflowX
        )
      : 0.5

    const nextY = overflowY
      ? clamp01(
          dragRef.current.startOffsetY - deltaY / overflowY
        )
      : 0.5

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


export default function ControlsPanel({
  art,
  setArt,
  background,
  setBackground,
  mugColors,
  setMugColors,

  mugShine,
  setMugShine,

  modelId,
  setModelId,
  warning,
}) {

  const [showCalibration, setShowCalibration] =
    useState(false)


  const handleArtUpload = (e) => {

    const file = e.target.files?.[0]

    if (!file) return

    const url = URL.createObjectURL(file)

    const img = new Image()

    img.onload = () => {
      setArt((a) => ({
        ...a,
        image: img,
        fileName: file.name,
      }))
    }

    img.src = url
  }


  const handleBgImageUpload = (e) => {

    const file = e.target.files?.[0]

    if (!file) return

    const url = URL.createObjectURL(file)

    setBackground((b) => ({
      ...b,
      type: 'image',
      image: url,

      /*
        NOVO:
        Reinicia encaixe/zoom/posição a cada
        nova imagem enviada.
      */
      fit: 'cover',
      zoom: 1,
      offsetXFrac: 0.5,
      offsetYFrac: 0.5,
    }))
  }


  const models = [
    {
      id: 'single',
      number: '1',
      label: 'Caneca',
    },
    {
      id: 'duo',
      number: '2',
      label: 'Canecas',
    },
    {
      id: 'trio',
      number: '3',
      label: 'Canecas',
    },
    {
      id: 'trioPaper',
      number: '3',
      label: 'Canecas + Folha',
    },
  ]


  return (
    <aside className="panel">

      {/* ==================================================
          CABEÇALHO DO PAINEL
      ================================================== */}

      <div className="panel-heading">

        <span className="section-kicker">
          PERSONALIZAÇÃO
        </span>

        <h2>
          Seu mockup
        </h2>

        <p>
          Configure a caneca e visualize o resultado em 3D.
        </p>

      </div>


      {/* ==================================================
          MODELO
      ================================================== */}

      <Section
        icon="▣"
        title="Modelo"
        description="Escolha o modelo de caneca"
      >

        <div className="mug-selector">

          {models.map((model) => (

            <button
              key={model.id}
              type="button"
              className={
                modelId === model.id
                  ? 'mug-option active'
                  : 'mug-option'
              }
              onClick={() => setModelId(model.id)}
            >

              <span className="mug-number">
                {model.number}
              </span>

              <span>
                {model.label}
              </span>

            </button>

          ))}

        </div>

      </Section>


      {/* ==================================================
          ARTE
      ================================================== */}

      <Section
        icon="✦"
        title="Sua arte"
        description="Imagem e posicionamento"
      >

        <label className="upload-area">

          <input
            type="file"
            accept="image/*"
            onChange={handleArtUpload}
            hidden
          />

          {art.fileName ? (

            <div className="uploaded-art">

              <div className="upload-check">
                ✓
              </div>

              <div className="upload-info">

                <strong>
                  Arte carregada
                </strong>

                <span>
                  {art.fileName}
                </span>

              </div>

              <span className="upload-change">
                Trocar
              </span>

            </div>

          ) : (

            <div className="upload-empty">

              <span className="upload-icon">
                ↑
              </span>

              <strong>
                Enviar sua arte
              </strong>

              <span>
                PNG, JPG ou WEBP
              </span>

            </div>

          )}

        </label>


        <div className="field-group">

          <div className="field-label">

            <span>
              Tamanho da arte
            </span>

            <small>
              milímetros
            </small>

          </div>


          <div className="input-grid">

            <label className="input-field">

              <span>
                Largura
              </span>

              <div className="number-input">

                <input
                  type="number"
                  value={art.widthMM}
                  min={10}
                  max={400}
                  onChange={(e) =>
                    setArt((a) => ({
                      ...a,
                      widthMM: Number(
                        e.target.value
                      ),
                    }))
                  }
                />

                <span>
                  mm
                </span>

              </div>

            </label>


            <label className="input-field">

              <span>
                Altura
              </span>

              <div className="number-input">

                <input
                  type="number"
                  value={art.heightMM}
                  min={10}
                  max={200}
                  onChange={(e) =>
                    setArt((a) => ({
                      ...a,
                      heightMM: Number(
                        e.target.value
                      ),
                    }))
                  }
                />

                <span>
                  mm
                </span>

              </div>

            </label>

          </div>

        </div>


        {/* HORIZONTAL */}

        <div className="range-field">

          <div className="range-header">

            <span>
              Posição horizontal
            </span>

            <strong>
              {art.offsetXMM} mm
            </strong>

          </div>

          <input
            type="range"
            min="-60"
            max="60"
            value={art.offsetXMM}
            onChange={(e) =>
              setArt((a) => ({
                ...a,
                offsetXMM: Number(
                  e.target.value
                ),
              }))
            }
          />

          <div className="range-limits">
            <span>−60</span>
            <span>0</span>
            <span>+60</span>
          </div>

        </div>


        {/* VERTICAL */}

        <div className="range-field">

          <div className="range-header">

            <span>
              Posição vertical
            </span>

            <strong>
              {art.offsetYMM} mm
            </strong>

          </div>

          <input
            type="range"
            min="-20"
            max="20"
            value={art.offsetYMM}
            onChange={(e) =>
              setArt((a) => ({
                ...a,
                offsetYMM: Number(
                  e.target.value
                ),
              }))
            }
          />

          <div className="range-limits">
            <span>−20</span>
            <span>0</span>
            <span>+20</span>
          </div>

        </div>


        {/* CALIBRAÇÃO */}

        <button
          type="button"
          className="advanced-toggle"
          onClick={() =>
            setShowCalibration((value) => !value)
          }
        >

          <span>
            ⚙ Calibração da caneca
          </span>

          <span>
            {showCalibration ? '−' : '+'}
          </span>

        </button>


        {showCalibration && (

          <div className="calibration-box">

            <label className="input-field">

              <span>
                Altura real da caneca
              </span>

              <div className="number-input">

                <input
                  type="number"
                  value={art.mugRealHeightMM}
                  min={60}
                  max={140}
                  onChange={(e) =>
                    setArt((a) => ({
                      ...a,
                      mugRealHeightMM:
                        Number(
                          e.target.value
                        ),
                    }))
                  }
                />

                <span>
                  mm
                </span>

              </div>

            </label>

            <p>
              Ajuste conforme a altura real da parede
              da sua caneca para manter a escala da arte.
            </p>

          </div>

        )}


        {warning && (

          <div className="warning">

            <span>
              !
            </span>

            <div>

              <strong>
                Atenção
              </strong>

              <p>
                {warning}
              </p>

            </div>

          </div>

        )}

      </Section>


      {/* ==================================================
          FUNDO
      ================================================== */}

      <Section
        icon="◉"
        title="Fundo"
        description="Ambiente da cena"
      >

        <div className="segmented-control">

          <button
            type="button"
            className={
              background.type === 'color'
                ? 'active'
                : ''
            }
            onClick={() =>
              setBackground((b) => ({
                ...b,
                type: 'color',
              }))
            }
          >
            Cor sólida
          </button>

          <button
            type="button"
            className={
              background.type === 'image'
                ? 'active'
                : ''
            }
            onClick={() =>
              setBackground((b) => ({
                ...b,
                type: 'image',
              }))
            }
          >
            Imagem
          </button>

        </div>


        {background.type === 'color' ? (

          <label className="color-picker">

            <span>
              Cor do ambiente
            </span>

            <div className="color-picker-control">

              <input
                type="color"
                value={background.color}
                onChange={(e) =>
                  setBackground((b) => ({
                    ...b,
                    color: e.target.value,
                  }))
                }
              />

              <span>
                {background.color.toUpperCase()}
              </span>

            </div>

          </label>

        ) : (

          <>

            <label className="upload-area small">

              <input
                type="file"
                accept="image/*"
                onChange={handleBgImageUpload}
                hidden
              />

              {background.image ? (

                <div className="uploaded-art">

                  <div className="upload-check">
                    ✓
                  </div>

                  <div className="upload-info">

                    <strong>
                      Imagem de fundo carregada
                    </strong>

                    <span>
                      Clique para trocar a imagem
                    </span>

                  </div>

                  <span className="upload-change">
                    Trocar
                  </span>

                </div>

              ) : (

                <div className="upload-empty">

                  <span className="upload-icon">
                    ↑
                  </span>

                  <strong>
                    Enviar imagem de fundo
                  </strong>

                  <span>
                    Use uma foto ou cenário
                  </span>

                </div>

              )}

            </label>


            {background.image && (

              <>

                <BackgroundPositionPreview
                  background={background}
                  setBackground={setBackground}
                />


                <div className="field-group">

                  <div className="field-label">

                    <span>
                      Encaixe da imagem
                    </span>

                    <small>
                      como ela preenche o fundo
                    </small>

                  </div>


                  <div className="segmented-control three-col">

                    <button
                      type="button"
                      className={
                        background.fit === 'cover'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setBackground((b) => ({
                          ...b,
                          fit: 'cover',
                        }))
                      }
                    >
                      Cobrir
                    </button>

                    <button
                      type="button"
                      className={
                        background.fit === 'width'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setBackground((b) => ({
                          ...b,
                          fit: 'width',
                        }))
                      }
                    >
                      Largura
                    </button>

                    <button
                      type="button"
                      className={
                        background.fit === 'height'
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setBackground((b) => ({
                          ...b,
                          fit: 'height',
                        }))
                      }
                    >
                      Altura
                    </button>

                  </div>

                </div>


                <div className="range-field">

                  <div className="range-header">

                    <span>
                      Zoom da imagem
                    </span>

                    <strong>
                      {Math.round(
                        (background.zoom || 1) * 100
                      )}%
                    </strong>

                  </div>

                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={background.zoom || 1}
                    onChange={(e) =>
                      setBackground((b) => ({
                        ...b,
                        zoom: Number(e.target.value),
                      }))
                    }
                  />

                  <div className="range-limits">
                    <span>100%</span>
                    <span>300%</span>
                  </div>

                </div>


                <p className="control-hint">
                  Escolha "Cobrir" para preencher todo o
                  fundo (recortando o excesso), ou
                  "Largura"/"Altura" para ajustar por um
                  dos lados. Depois, aumente o zoom e
                  arraste a prévia acima para escolher a
                  área visível.
                </p>

              </>

            )}

          </>

        )}

      </Section>


      {/* ==================================================
          CORES
      ================================================== */}

      <Section
        icon="●"
        title="Cores da caneca"
        description="Personalize o acabamento"
        defaultOpen={false}
      >

        <div className="color-list">

          <label className="color-row">

            <span>
              Corpo externo
            </span>

            <div className="color-input">

              <input
                type="color"
                value={mugColors.body}
                onChange={(e) =>
                  setMugColors((c) => ({
                    ...c,
                    body: e.target.value,
                  }))
                }
              />

              <span>
                {mugColors.body.toUpperCase()}
              </span>

            </div>

          </label>


          <label className="color-row">

            <span>
              Alça
            </span>

            <div className="color-input">

              <input
                type="color"
                value={mugColors.handle}
                onChange={(e) =>
                  setMugColors((c) => ({
                    ...c,
                    handle: e.target.value,
                  }))
                }
              />

              <span>
                {mugColors.handle.toUpperCase()}
              </span>

            </div>

          </label>


          <label className="color-row">

            <span>
              Parte interna
            </span>

            <div className="color-input">

              <input
                type="color"
                value={mugColors.inside}
                onChange={(e) =>
                  setMugColors((c) => ({
                    ...c,
                    inside: e.target.value,
                  }))
                }
              />

              <span>
                {mugColors.inside.toUpperCase()}
              </span>

            </div>

          </label>

        </div>


        {/* ==================================================
            BRILHO DA CANECA
        ================================================== */}

        <div className="range-field">

          <div className="range-header">

            <span>
              Brilho da caneca
            </span>

            <strong>
              {Math.round(mugShine * 100)}%
            </strong>

          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={mugShine}
            onChange={(e) =>
              setMugShine(
                Number(e.target.value)
              )
            }
          />

          <div className="range-limits">
            <span>Fosco</span>
            <span>Brilhante</span>
          </div>

        </div>


        <p className="control-hint">
          O brilho afeta apenas o acabamento das canecas.
          A folha permanece fosca.
        </p>


        <p className="control-hint">
          O corpo também define a cor das áreas onde
          não existe impressão.
        </p>

      </Section>


      <div className="panel-footer">
        Almatiê · Mockup 3D
      </div>

    </aside>
  )
}

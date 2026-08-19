import { useState } from 'react'

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
            <strong>{title}</strong>

            {description && (
              <small>{description}</small>
            )}
          </div>

        </div>

        <span className="section-arrow">
          {open ? '⌃' : '⌄'}
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


export default function ControlsPanel({
  art,
  setArt,
  background,
  setBackground,
  mugColors,
  setMugColors,
  mugCount,
  setMugCount,
  warning,
}) {

  const [showCalibration, setShowCalibration] = useState(false)


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

    setBackground({
      type: 'image',
      image: url,
    })
  }


  return (
    <aside className="panel">

      {/* =========================
          PAINEL HEADER
      ========================== */}

      <div className="panel-header">

        <div>
          <span className="panel-eyebrow">
            CONFIGURAÇÕES
          </span>

          <h2>
            Personalizar
          </h2>
        </div>

        <div className="panel-version">
          3D
        </div>

      </div>


      {/* =========================
          MODELO
      ========================== */}

      <Section
        icon="▣"
        title="Modelo"
        description="Quantidade de canecas"
      >

        <div className="mug-selector">

          {[1, 2, 3].map((count) => (

            <button
              key={count}
              type="button"
              className={
                mugCount === count
                  ? 'mug-option active'
                  : 'mug-option'
              }
              onClick={() => setMugCount(count)}
            >

              <span className="mug-number">
                {count}
              </span>

              <span>
                {count === 1
                  ? 'Caneca'
                  : 'Canecas'}
              </span>

            </button>

          ))}

        </div>

      </Section>


      {/* =========================
          ARTE
      ========================== */}

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
            <span>Tamanho da arte</span>
            <small>milímetros</small>
          </div>

          <div className="input-grid">

            <label className="input-field">

              <span>Largura</span>

              <div className="number-input">

                <input
                  type="number"
                  value={art.widthMM}
                  min={10}
                  max={400}
                  onChange={(e) =>
                    setArt((a) => ({
                      ...a,
                      widthMM: Number(e.target.value),
                    }))
                  }
                />

                <span>mm</span>

              </div>

            </label>


            <label className="input-field">

              <span>Altura</span>

              <div className="number-input">

                <input
                  type="number"
                  value={art.heightMM}
                  min={10}
                  max={200}
                  onChange={(e) =>
                    setArt((a) => ({
                      ...a,
                      heightMM: Number(e.target.value),
                    }))
                  }
                />

                <span>mm</span>

              </div>

            </label>

          </div>

        </div>


        {/* POSIÇÃO HORIZONTAL */}

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
            min={-60}
            max={60}
            value={art.offsetXMM}
            onChange={(e) =>
              setArt((a) => ({
                ...a,
                offsetXMM: Number(e.target.value),
              }))
            }
          />

          <div className="range-limits">
            <span>−60</span>
            <span>0</span>
            <span>+60</span>
          </div>

        </div>


        {/* POSIÇÃO VERTICAL */}

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
            min={-20}
            max={20}
            value={art.offsetYMM}
            onChange={(e) =>
              setArt((a) => ({
                ...a,
                offsetYMM: Number(e.target.value),
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
            {showCalibration ? '⌃' : '⌄'}
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
                      mugRealHeightMM: Number(
                        e.target.value
                      ),
                    }))
                  }
                />

                <span>mm</span>

              </div>

            </label>

            <p>
              Informe a altura real da parede da sua
              caneca. Isso mantém a escala da arte
              proporcional ao tamanho físico.
            </p>

          </div>

        )}


        {warning && (

          <div className="warning">

            <span>!</span>

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


      {/* =========================
          FUNDO
      ========================== */}

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

          <label className="upload-area small">

            <input
              type="file"
              accept="image/*"
              onChange={handleBgImageUpload}
              hidden
            />

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

          </label>

        )}

      </Section>


      {/* =========================
          CORES DA CANECA
      ========================== */}

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


        <p className="control-hint">
          O corpo também define a cor das áreas
          onde não existe impressão.
        </p>

      </Section>


      <div className="panel-footer">

        <span>
          Mockup 3D
        </span>

        <span>
          •
        </span>

        <span>
          Editor
        </span>

      </div>

    </aside>
  )
}
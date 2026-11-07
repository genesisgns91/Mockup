import { ZOOM_MIN, ZOOM_MAX } from '../../utils/exportLayout.js'
import { TabSection } from './Section.jsx'
import { BackgroundPositionPreview } from './BackgroundPositionPreview.jsx'


export function BackgroundPane({
  background,
  bgDragActive,
  bgDropHandlers,
  currentTab,
  frameAspect,
  handleBgImageUpload,
  onEditBackground,
  setBackground,
  tabbed,
}) {
  return (
    <TabSection
    mobileTab={currentTab}
    tabbed={tabbed}
    id="background"
    step={4}
    totalSteps={4}
    iconName="layers"
    icon="◉"
    title="Fundo"
    badge={{
      text: background.type === 'image' && background.image ? 'Imagem' : 'Cor',
      done: background.type === 'image' && Boolean(background.image),
    }}
    description="Escolha a cor ou a imagem que fica atrás do modelo."
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

        <label
          className={`upload-area small${bgDragActive ? ' drag-active' : ''}`}
          {...bgDropHandlers}
        >

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
                Arraste aqui ou clique · foto ou cenário
              </span>

            </div>

          )}

        </label>


        {background.image && (

          <>

            <BackgroundPositionPreview
              background={background}
              setBackground={setBackground}
              aspect={frameAspect || 16 / 10}
            />

            <div className="bg-actions">

              <button
                type="button"
                className="btn btn-primary bg-action-main"
                onClick={onEditBackground}
              >
                ✥ Ajustar direto na cena
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setBackground((b) => ({
                    ...b,
                    fit: 'cover',
                    zoom: 1,
                    offsetXFrac: 0.5,
                    offsetYFrac: 0.5,
                  }))
                }
              >
                ⟲ Centralizar
              </button>

            </div>


            <label className="color-picker">

              <span>
                Cor atrás da imagem
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


            <div className="field-group">

              <div className="field-label">

                <span>
                  Encaixe da imagem
                </span>

                <small>
                  como ela preenche o fundo
                </small>

              </div>


              <div className="segmented-control four-col">

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
                    background.fit === 'contain'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setBackground((b) => ({
                      ...b,
                      fit: 'contain',
                    }))
                  }
                >
                  Conter
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
                min={ZOOM_MIN}
                max={ZOOM_MAX}
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
                <span>{Math.round(ZOOM_MIN * 100)}%</span>
                <span>100%</span>
                <span>{Math.round(ZOOM_MAX * 100)}%</span>
              </div>

            </div>


            <p className="control-hint">
              "Cobrir" preenche todo o quadro (recortando o
              excesso); "Conter" mostra a imagem inteira.
              Com zoom abaixo de 100% a imagem fica menor
              e a cor de fundo aparece ao redor. A prévia
              acima tem a mesma proporção do quadro de
              exportação escolhido.
            </p>

          </>

        )}

      </>

    )}

  </TabSection>
  )
}

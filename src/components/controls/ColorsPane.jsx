import { TabSection } from './Section.jsx'


export function ColorsPane({
  activeModel,
  currentTab,
  glassOpacity,
  mugShine,
  partColors,
  setGlassOpacity,
  setMugShine,
  setPartColors,
  tabbed,
}) {
  return (
    <TabSection
    mobileTab={currentTab}
    tabbed={tabbed}
    id="colors"
    step={3}
    totalSteps={4}
    iconName="palette"
    icon="●"
    title="Cores"
    description="Pinte cada parte da peça e ajuste o acabamento."
    defaultOpen={false}
  >

    <div className="color-list">

      {activeModel.colorParts.map((part) => (

        <label className="color-row" key={part.key}>

          <span>
            {part.label}
          </span>

          <div className="color-input">

            <input
              type="color"
              value={partColors[part.key] || part.default}
              onChange={(e) =>
                setPartColors((c) => ({
                  ...c,
                  [part.key]: e.target.value,
                }))
              }
            />

            <span>
              {(partColors[part.key] || part.default).toUpperCase()}
            </span>

          </div>

        </label>

      ))}

    </div>


    {activeModel.glassOpacity && (

      <div className="range-field">

        <div className="range-header">

          <span>
            {activeModel.glassOpacity.label}
          </span>

          <strong>
            {Math.round((glassOpacity ?? activeModel.glassOpacity.default) * 100)}%
          </strong>

        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={glassOpacity ?? activeModel.glassOpacity.default}
          onChange={(e) =>
            setGlassOpacity(Number(e.target.value))
          }
        />

        <div className="range-limits">
          <span>Opaco</span>
          <span>Transparente</span>
        </div>

      </div>

    )}


    {/* ==================================================
        BRILHO
    ================================================== */}

    <div className="range-field">

      <div className="range-header">

        <span>
          Brilho
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
      O brilho afeta o acabamento das peças que aceitam
      esse ajuste (cerâmica e plástico). A folha e o mouse
      do mousepad permanecem foscos.
    </p>


    <p className="control-hint">
      O "Corpo" também define a cor das áreas onde não
      existe impressão.
    </p>

  </TabSection>
  )
}

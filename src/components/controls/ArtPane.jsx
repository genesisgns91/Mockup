import { TabSection } from './Section.jsx'
import { ArtSlots } from './ArtSlots.jsx'


export function ArtPane({
  activeModel,
  artDragActive,
  artZones,
  clearArt,
  copyMeasuresToAll,
  currentTab,
  currentZoneKey,
  linkArt,
  makeZoneDropHandlers,
  processArtFile,
  setActiveZoneKey,
  setArtZones,
  setShowCalibration,
  showCalibration,
  tabbed,
  toggleLinkArt,
  visibleZones,
  warning,
}) {
  return (
    <TabSection
    mobileTab={currentTab}
    tabbed={tabbed}
    id="art"
    step={2}
    totalSteps={4}
    iconName="image"
    icon="✦"
    title="Sua arte"
    badge={{
      text: `${activeModel.printZones.filter((z) => artZones[z.key]?.fileName).length}/${activeModel.printZones.length}`,
      done: activeModel.printZones.every((z) => artZones[z.key]?.fileName),
    }}
    description={
      activeModel.printZones.length > 1
        ? 'Esta peça tem mais de uma área: envie uma imagem para cada uma.'
        : 'Envie a imagem que será estampada e ajuste tamanho e posição.'
    }
  >

    <ArtSlots
      zones={activeModel.printZones}
      artZones={artZones}
      activeKey={currentZoneKey}
      onSelect={setActiveZoneKey}
      onFile={processArtFile}
      onClear={clearArt}
      dragActive={artDragActive}
      makeDropHandlers={makeZoneDropHandlers}
    />

    {activeModel.printZones.length > 1 && (

      <label className="link-art-toggle">

        <span className="link-art-text">
          <strong>Usar a mesma imagem em todas</strong>
          <small>Replica a arte em todas as áreas da peça</small>
        </span>

        <span className="switch">

          <input
            type="checkbox"
            checked={linkArt}
            onChange={(e) => toggleLinkArt(e.target.checked)}
          />

          <span className="switch-track">
            <span className="switch-thumb" />
          </span>

        </span>

      </label>

    )}

    {visibleZones.map((zone, zoneIndex) => {
      const zoneArt = artZones[zone.key] || {
        image: null,
        fileName: null,
        widthMM: 210,
        heightMM: 92,
        offsetXMM: 0,
        offsetYMM: 0,
        mugRealHeightMM: 95,
      }

      const updateZone = (updater) => {
        setArtZones((zones) => ({
          ...zones,
          [zone.key]: {
            ...(zones[zone.key] || zoneArt),
            ...updater(zones[zone.key] || zoneArt),
          },
        }))
      }

      return (
        <div
          key={zone.key}
          className="art-zone-block"
          style={
            zoneIndex > 0
              ? { marginTop: '22px', paddingTop: '22px', borderTop: '1px dashed var(--border-soft, #e2dccf)' }
              : undefined
          }
        >

          {activeModel.printZones.length > 1 && (
            <div className="field-label zone-settings-label">
              <span>Ajustes · {zone.label}</span>
            </div>
          )}


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
                    value={zoneArt.widthMM}
                    min={10}
                    max={400}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      updateZone(() => ({ widthMM: v }))
                    }}
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
                    value={zoneArt.heightMM}
                    min={10}
                    max={200}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      updateZone(() => ({ heightMM: v }))
                    }}
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

              <span className="range-header-actions">

                <strong>
                  {zoneArt.offsetXMM} mm
                </strong>

                {zoneArt.offsetXMM !== 0 && (
                  <button
                    type="button"
                    className="range-reset"
                    onClick={() => updateZone(() => ({ offsetXMM: 0 }))}
                    aria-label="Centralizar posição horizontal"
                    title="Centralizar"
                  >
                    ⟲
                  </button>
                )}

              </span>

            </div>

            <input
              type="range"
              min="-60"
              max="60"
              value={zoneArt.offsetXMM}
              onChange={(e) => {
                const v = Number(e.target.value)
                updateZone(() => ({ offsetXMM: v }))
              }}
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

              <span className="range-header-actions">

                <strong>
                  {zoneArt.offsetYMM} mm
                </strong>

                {zoneArt.offsetYMM !== 0 && (
                  <button
                    type="button"
                    className="range-reset"
                    onClick={() => updateZone(() => ({ offsetYMM: 0 }))}
                    aria-label="Centralizar posição vertical"
                    title="Centralizar"
                  >
                    ⟲
                  </button>
                )}

              </span>

            </div>

            <input
              type="range"
              min="-20"
              max="20"
              value={zoneArt.offsetYMM}
              onChange={(e) => {
                const v = Number(e.target.value)
                updateZone(() => ({ offsetYMM: v }))
              }}
            />

            <div className="range-limits">
              <span>−20</span>
              <span>0</span>
              <span>+20</span>
            </div>

          </div>


          {activeModel.printZones.length > 1 && (
            <button
              type="button"
              className="advanced-toggle"
              onClick={copyMeasuresToAll}
            >
              <span>⧉ Copiar estas medidas para todas as áreas</span>
            </button>
          )}

          {/* CALIBRAÇÃO */}

          <button
            type="button"
            className="advanced-toggle"
            onClick={() =>
              setShowCalibration((value) => !value)
            }
          >

            <span>
              ⚙ Calibração da peça
            </span>

            <span>
              {showCalibration ? '−' : '+'}
            </span>

          </button>


          {showCalibration && (

            <div className="calibration-box">

              <label className="input-field">

                <span>
                  Altura real da peça
                </span>

                <div className="number-input">

                  <input
                    type="number"
                    value={zoneArt.mugRealHeightMM}
                    min={10}
                    max={400}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      updateZone(() => ({ mugRealHeightMM: v }))
                    }}
                  />

                  <span>
                    mm
                  </span>

                </div>

              </label>

              <p>
                Ajuste conforme a altura real dessa área da
                peça para manter a escala da arte.
              </p>

            </div>

          )}

        </div>
      )
    })}


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

  </TabSection>
  )
}

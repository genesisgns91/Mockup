import { EXPORT_FORMATS } from '../config/exportFormats.js'

/*
  ==========================================================
  PAINEL DE EXPORTAÇÃO

  Conteúdo compartilhado entre o layout de desktop (card
  abaixo do viewport) e o de celular (aba "Exportar" do
  painel inferior). Só apresenta controles — todo o estado e
  as ações continuam vivendo no App.
  ==========================================================
*/
export default function ExportPanel({
  exportFormatId,
  setExportFormatId,
  transparentBg,
  setTransparentBg,
  videoQuality,
  setVideoQuality,
  videoSpeed,
  setVideoSpeed,
  videoEffect,
  setVideoEffect,
  isRecording,
  isExportingImage,
  handleScreenshot,
  handleRecord,
  recordProgress,
  exportError,
  hideHeading = false,
}) {
  return (
    <>
      {!hideHeading && (
      <div className="export-heading">

              <div>

                <span>
                  FINALIZE SEU MOCKUP
                </span>

                <strong>
                  Exporte sua criação
                </strong>

              </div>


              <div className="ink-mark">
                ✦
              </div>

            </div>


      )}

            {/* ==================================================
                FORMATO DE EXPORTAÇÃO
            ================================================== */}

            <div className="format-selector">

              <div className="format-selector-heading">
                <strong>
                  Formato de exportação
                </strong>

                <small>
                  Escolha a proporção ideal para cada rede social
                </small>
              </div>


              <div className="format-options">

                {EXPORT_FORMATS.map((format) => (

                  <button
                    key={format.id}
                    type="button"
                    className={
                      exportFormatId === format.id
                        ? 'format-option active'
                        : 'format-option'
                    }
                    onClick={() =>
                      setExportFormatId(format.id)
                    }
                  >

                    <span
                      className={`format-shape shape-${format.id}`}
                    />

                    <span className="format-option-text">
                      <strong>
                        {format.label}
                      </strong>

                      <small>
                        {format.hint}
                      </small>
                    </span>

                  </button>

                ))}

              </div>


              <label className="transparent-toggle">

                <span className="transparent-toggle-text">
                  <strong>
                    Fundo transparente
                  </strong>

                  <small>
                    Remove o fundo da imagem (apenas PNG)
                  </small>
                </span>

                <span className="switch">

                  <input
                    type="checkbox"
                    checked={transparentBg}
                    onChange={(e) =>
                      setTransparentBg(e.target.checked)
                    }
                  />

                  <span className="switch-track">
                    <span className="switch-thumb" />
                  </span>

                </span>

              </label>

            </div>

            <div
  className="video-settings"
  style={{
    marginBottom: '16px',
    display: 'grid',
    gap: '12px',
  }}
>
  <div>
  <div>
  <strong>
    Qualidade do vídeo
  </strong>

  <div
    style={{
      display: 'flex',
      gap: '8px',
      marginTop: '8px',
      flexWrap: 'wrap',
    }}
  >
    {[
      {
        id: 'low',
        label: 'Baixo',
        hint: '360p',
      },
      {
        id: 'standard',
        label: 'Padrão',
        hint: '720p',
      },
      {
        id: 'high',
        label: 'Alto',
        hint: '1080p',
      },
    ].map((quality) => (
      <button
        key={quality.id}
        type="button"
        className={
          videoQuality === quality.id
            ? 'btn btn-primary'
            : 'btn btn-secondary'
        }
        onClick={() =>
          setVideoQuality(quality.id)
        }
        disabled={isRecording}
      >
        {quality.label}
        <small
          style={{
            display: 'block',
            marginTop: '2px',
          }}
        >
          {quality.hint}
        </small>
      </button>
    ))}
  </div>
</div>

    <strong>
      Velocidade do vídeo
    </strong>

    <div
      style={{
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
      }}
    >
      {[0.5, 1, 2].map(
        (speed) => (
          <button
            key={speed}
            type="button"
            className={
              videoSpeed === speed
                ? 'btn btn-primary'
                : 'btn btn-secondary'
            }
            onClick={() =>
              setVideoSpeed(speed)
            }
            disabled={isRecording}
          >
            {speed}x
          </button>
        )
      )}
    </div>
  </div>

  <div>
    <strong>
      Efeito
    </strong>

    <select
      value={videoEffect}
      onChange={(e) =>
        setVideoEffect(
          e.target.value
        )
      }
      disabled={isRecording}
      style={{
        width: '100%',
        marginTop: '8px',
        padding: '10px',
        borderRadius: '8px',
      }}
    >
      <option value="mug">
        Giro da caneca
      </option>

      <option value="zoom">
        Zoom lento
      </option>

      <option value="camera-up">
        Câmera subindo
      </option>

      <option value="camera-spin">
        Giro da câmera
      </option>

      <option value="zoom-mug">
        Giro + zoom
      </option>

      <option value="none">
        Sem movimento
      </option>
    </select>
  </div>
</div>

            <div className="export-actions">


              <button
                className="btn btn-primary export-button"
                onClick={handleScreenshot}
                disabled={isExportingImage}
                aria-busy={isExportingImage}
              >

                <span className="button-symbol">
                  {isExportingImage ? '⟳' : '↓'}
                </span>

                <span>

                  <strong>
                    {isExportingImage ? 'Gerando...' : 'Salvar PNG'}
                  </strong>

                  <small>
                    Imagem em alta qualidade
                  </small>

                </span>

              </button>


              <button
                className="btn btn-secondary export-button"
                onClick={handleRecord}
                disabled={isRecording}
              >

                <span className="button-symbol">

                  {isRecording
                    ? '●'
                    : '▶'}

                </span>

                <span>

                  <strong>

                    {isRecording
                      ? 'Gravando...'
                      : 'Vídeo 360°'}

                  </strong>

                  <small>
                    Apresentação animada
                  </small>

                </span>

              </button>


            </div>


            {isRecording && (

              <div className="record-progress">
                <div
                  className="record-progress-fill"
                  style={{ width: `${recordProgress}%` }}
                />
              </div>

            )}


            {exportError && (

              <div className="export-note">

                <span>
                  !
                </span>

                {exportError}

              </div>

            )}
    </>
  )
}

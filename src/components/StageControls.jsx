import { useEffect, useRef, useState } from 'react'
import { EXPORT_FORMATS } from '../config/exportFormats.js'

/*
  ==========================================================
  CONTROLES DA CENA (desktop)

  • Segmented  — seletor com "pílula" deslizante
  • FormatSwitch   — proporção do quadro (Livre, 1:1, 4:5…)
  • ViewSizeSwitch — tamanho da visualização (como no YouTube)
  • QuickActions   — salvar PNG / vídeo 360° sempre à mão
  ==========================================================
*/

export function Segmented({ options, value, onChange, label, className = '' }) {
  const index = Math.max(0, options.findIndex((o) => o.id === value))

  return (
    <div
      className={`seg ${className}`}
      role="radiogroup"
      aria-label={label}
      style={{ '--n': options.length, '--i': index }}
    >
      <span className="seg-thumb" aria-hidden="true" />

      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          aria-label={option.label}
          className="seg-btn"
          data-tip={option.tip}
          onClick={() => onChange(option.id)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  )
}


const svgProps = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const VIEW_OPTIONS = [
  {
    id: 'wide',
    label: 'Retangular',
    tip: 'Retangular · tecla 1',
    icon: (
      <svg {...svgProps}>
        <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" />
      </svg>
    ),
  },
  {
    id: 'square',
    label: 'Quadrado',
    tip: 'Quadrado · tecla 2',
    icon: (
      <svg {...svgProps}>
        <rect x="5" y="5" width="14" height="14" rx="2.5" />
      </svg>
    ),
  },
  {
    id: 'expanded',
    label: 'Expandido',
    tip: 'Expandido · tecla 3',
    icon: (
      <svg {...svgProps}>
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      </svg>
    ),
  },
]

export function ViewSizeSwitch({ value, onChange }) {
  return (
    <Segmented
      label="Tamanho da visualização"
      options={VIEW_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}


export function FormatSwitch({ value, onChange }) {
  const options = EXPORT_FORMATS.map((format) => ({
    id: format.id,
    label: format.label,
    tip: `${format.label} · ${format.hint}`,
    icon: <span className={`format-shape shape-${format.id}`} />,
  }))

  return (
    <Segmented
      label="Proporção do quadro de exportação"
      className="seg-format"
      options={options}
      value={value}
      onChange={onChange}
    />
  )
}


/*
  Mostra um "✓" por instantes quando uma exportação termina
  sem erro — confirmação visual sem precisar rolar a página.
*/
function useDoneFlash(busy, error) {
  const [done, setDone] = useState(false)
  const was = useRef(false)

  useEffect(() => {
    let timer

    if (was.current && !busy && !error) {
      setDone(true)
      timer = setTimeout(() => setDone(false), 1900)
    }

    was.current = busy

    return () => clearTimeout(timer)
  }, [busy, error])

  return done
}

export function QuickActions({
  handleScreenshot,
  handleRecord,
  isExportingImage,
  isRecording,
  recordProgress,
  exportError,
}) {
  const imageDone = useDoneFlash(isExportingImage, exportError)
  const videoDone = useDoneFlash(isRecording, exportError)

  const spinner = <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
  const check = <path d="m5 12.5 4.5 4.5L19 7.5" />

  return (
    <div className="stage-quick">

      <button
        type="button"
        className={
          'stage-quick-btn'
          + (isExportingImage ? ' busy' : '')
          + (imageDone ? ' done' : '')
        }
        onClick={handleScreenshot}
        disabled={isRecording || isExportingImage}
        data-tip="Salvar imagem PNG"
        aria-label="Salvar imagem PNG"
      >
        <svg {...svgProps} width={19} height={19}>
          {isExportingImage ? spinner : imageDone ? check : (
            <>
              <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
              <circle cx="12" cy="12.5" r="3.3" />
            </>
          )}
        </svg>
      </button>

      <button
        type="button"
        className={
          'stage-quick-btn'
          + (isRecording ? ' busy' : '')
          + (videoDone ? ' done' : '')
        }
        onClick={handleRecord}
        disabled={isRecording || isExportingImage}
        data-tip="Salvar vídeo 360°"
        data-tip-pos="end"
        aria-label="Salvar vídeo 360°"
      >
        <svg {...svgProps} width={19} height={19}>
          {isRecording ? spinner : videoDone ? check : (
            <>
              <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
              <path d="M18.5 3v3.5H15" />
              <path d="m10.3 9.6 4 2.4-4 2.4V9.6Z" />
            </>
          )}
        </svg>

        {isRecording && (
          <span className="quick-pct">
            {Math.round(recordProgress)}%
          </span>
        )}
      </button>

    </div>
  )
}

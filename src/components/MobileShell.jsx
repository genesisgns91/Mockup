import { memo, useCallback, useEffect, useRef, useState } from 'react'
import Viewport from './Viewport.jsx'
import ControlsPanel from './ControlsPanel.jsx'
import ExportPanel from './ExportPanel.jsx'
import {
  ModelPickerModal,
  getModelsByGroup,
  thumbUrl,
} from './ModelPicker.jsx'
import { getModel } from '../config/models.js'


/*
  ==========================================================
  SHELL MOBILE — "APP" PARA CELULAR

  Em vez de uma página longa (que brigava com o gesto de
  girar o modelo 3D), o celular ganha uma estrutura de
  aplicativo nativo:

    • cena 3D em tela cheia, que nunca rola a página;
    • barra superior flutuante (modelo atual + atalhos);
    • abas fixas embaixo (Modelo · Arte · Cores · Fundo · Exportar);
    • painel deslizante (bottom sheet) com 3 alturas — fechado,
      meia tela e tela cheia — arrastável pelo dedo;
    • "visão limpa" para ver o mockup sem nenhum controle.

  Todo o estado vive no App; aqui só há estado de interface.
  ==========================================================
*/

const MemoViewport = memo(Viewport)

const TABS = [
  { id: 'model', label: 'Modelo', icon: 'cube' },
  { id: 'art', label: 'Arte', icon: 'image' },
  { id: 'colors', label: 'Cores', icon: 'palette' },
  { id: 'background', label: 'Fundo', icon: 'layers' },
  { id: 'export', label: 'Exportar', icon: 'download' },
]

const SHEET_TITLES = {
  art: { title: 'Sua arte', hint: 'Imagem e posição na peça' },
  colors: { title: 'Cores e acabamento', hint: 'Personalize cada parte' },
  background: { title: 'Fundo da cena', hint: 'Cor ou imagem de ambiente' },
  export: { title: 'Exportar', hint: 'Imagem PNG ou vídeo 360°' },
}

const HINT_KEY = 'almatie-mockup:gesture-hint-seen'


function vibrate(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch {
    // dispositivos sem vibração simplesmente ignoram
  }
}


function Icon({ name, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (name) {
    case 'cube':
      return (
        <svg {...common}>
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
          <path d="M4 7.5 12 12l8-4.5M12 12v9" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m4 17 5-4.5 3.5 3L16 12l4 4.5" />
        </svg>
      )
    case 'palette':
      return (
        <svg {...common}>
          <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.6-1.3-2.8 0-1 .8-1.7 1.8-1.7H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.9 16.7 3.5 12 3.5Z" />
          <circle cx="7.8" cy="11" r=".9" fill="currentColor" />
          <circle cx="10.2" cy="7.6" r=".9" fill="currentColor" />
          <circle cx="14.4" cy="7.6" r=".9" fill="currentColor" />
        </svg>
      )
    case 'layers':
      return (
        <svg {...common}>
          <path d="m12 3.5 8.5 4.7L12 13 3.5 8.2 12 3.5Z" />
          <path d="m3.5 12.2 8.5 4.8 8.5-4.8" />
          <path d="m3.5 16.2 8.5 4.8 8.5-4.8" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 4v11" />
          <path d="m7.5 11 4.5 4.5 4.5-4.5" />
          <path d="M5 19.5h14" />
        </svg>
      )
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.8" />
        </svg>
      )
    case 'eye-off':
      return (
        <svg {...common}>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.7c.45-.1.9-.2 1.4-.2 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.5 7.2A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.95" />
          <path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 3.7" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m7 10 5 5 5-5" />
        </svg>
      )
    case 'expand':
      return (
        <svg {...common}>
          <path d="m7 14 5-5 5 5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'external':
      return (
        <svg {...common}>
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      )
    default:
      return null
  }
}


export default function MobileShell({
  controlsProps,
  viewportProps,
  exportProps,
  almatieUrl,
  isBusy,
}) {
  const { modelId, setModelId, artZones } = controlsProps

  const [tab, setTab] = useState(null) // null | 'art' | 'colors' | 'background' | 'export'
  const [snap, setSnap] = useState('half') // 'half' | 'full'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [clean, setClean] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showArtCta, setShowArtCta] = useState(false)

  const sheetRef = useRef(null)
  const dragRef = useRef(null)

  const activeModel = getModel(modelId)

  const hasArt = activeModel.printZones.some(
    (zone) => Boolean(artZones[zone.key]?.fileName)
  )

  const sheetState = clean ? 'closed' : tab ? snap : 'closed'
  const isOpen = sheetState !== 'closed'


  /*
    Modo "app": trava a rolagem da página e o "puxar para
    atualizar" enquanto este layout está ativo.
  */
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('m-mode')

    return () => root.classList.remove('m-mode')
  }, [])


  /*
    Dica de gesto: aparece uma vez, some ao primeiro toque na
    cena (ou sozinha depois de alguns segundos).
  */
  useEffect(() => {
    let seen = false

    try {
      seen = localStorage.getItem(HINT_KEY) === '1'
    } catch {
      // armazenamento indisponível: mostra a dica de qualquer forma
    }

    if (seen) return undefined

    const show = setTimeout(() => setShowHint(true), 900)
    const hide = setTimeout(() => setShowHint(false), 7500)

    return () => {
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [])

  const dismissHint = useCallback(() => {
    setShowHint(false)

    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      // ignora
    }
  }, [])


  /*
    Convite discreto para enviar a arte: surge depois de um
    instante se o painel está fechado e ainda não há arte.
  */
  useEffect(() => {
    if (hasArt || isOpen || clean) {
      setShowArtCta(false)
      return undefined
    }

    const timer = setTimeout(() => setShowArtCta(true), 2400)

    return () => clearTimeout(timer)
  }, [hasArt, isOpen, clean])


  const handleTab = (id) => {
    vibrate()

    if (id === 'model') {
      setPickerOpen(true)
      return
    }

    if (clean) setClean(false)

    if (tab === id && !clean) {
      setTab(null)
      return
    }

    setTab(id)
    setSnap('half')
  }


  const toggleClean = () => {
    vibrate(12)
    dismissHint()
    setClean((value) => !value)
  }


  /*
    ---------- arrastar o painel ----------
    Durante o arraste mexemos direto no estilo do elemento
    (sem setState) para não re-renderizar a cena 3D a cada
    movimento do dedo.
  */
  const onGrabDown = (e) => {
    const el = sheetRef.current
    if (!el) return

    e.currentTarget.setPointerCapture(e.pointerId)

    dragRef.current = {
      startY: e.clientY,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
      dy: 0,
      moved: false,
    }

    el.style.transition = 'none'
  }

  const onGrabMove = (e) => {
    const d = dragRef.current
    const el = sheetRef.current
    if (!d || !el) return

    const now = performance.now()
    const dt = Math.max(1, now - d.lastT)

    d.velocity = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = now

    let dy = e.clientY - d.startY

    if (Math.abs(dy) > 4) d.moved = true

    // resistência elástica ao puxar além do topo
    const maxUp = snap === 'half' ? -Math.round(window.innerHeight * 0.4) : 0
    if (dy < maxUp) dy = maxUp + (dy - maxUp) * 0.25
    if (snap === 'full' && dy < 0) dy *= 0.2

    d.dy = dy
    el.style.setProperty('--m-drag', `${dy}px`)
  }

  const onGrabUp = (e) => {
    const d = dragRef.current
    const el = sheetRef.current
    dragRef.current = null

    if (!d || !el) return

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ponteiro já liberado
    }

    el.style.transition = ''
    el.style.removeProperty('--m-drag')

    // toque simples no puxador alterna meia tela ↔ tela cheia
    if (!d.moved) {
      vibrate(6)
      setSnap((s) => (s === 'half' ? 'full' : 'half'))
      return
    }

    const fast = Math.abs(d.velocity) > 0.55

    if (snap === 'half') {
      if (d.dy > 70 || (fast && d.velocity > 0)) {
        vibrate(6)
        setTab(null)
      } else if (d.dy < -50 || (fast && d.velocity < 0)) {
        vibrate(6)
        setSnap('full')
      }
    } else if (d.dy > 90 || (fast && d.velocity > 0)) {
      vibrate(6)
      if (d.dy > 260) setTab(null)
      else setSnap('half')
    }
  }


  const modelsByGroup = getModelsByGroup()
  const sheetMeta = tab ? SHEET_TITLES[tab] : null
  const activeIndex = tab ? TABS.findIndex((t) => t.id === tab) : -1
  const indicatorIndex = pickerOpen ? 0 : activeIndex

  const recording = exportProps.isRecording

  return (
    <div
      className="m-app"
      data-sheet={sheetState}
      data-clean={clean ? 'true' : 'false'}
    >

      {/* ================= CENA 3D ================= */}

      <div
        className="m-stage"
        onPointerDown={showHint ? dismissHint : undefined}
      >
        <MemoViewport
          {...viewportProps}
          className="viewport m-viewport"
          showHelp={false}
        />
      </div>

      <div
        className={`m-scrim${sheetState === 'full' ? ' on' : ''}`}
        onClick={() => setSnap('half')}
        aria-hidden="true"
      />


      {/* ============ DICA DE GESTO (1ª vez) ============ */}

      {showHint && !clean && (
        <div className="m-hint" aria-hidden="true">
          <div className="m-hint-card">
            <span className="m-hint-finger" />
            <span className="m-hint-text">
              Arraste para girar
              <small>Pince com dois dedos para o zoom</small>
            </span>
          </div>
        </div>
      )}


      {/* ============== BARRA SUPERIOR ============== */}

      <header className="m-topbar">

        <button
          type="button"
          className="m-model-pill"
          onClick={() => handleTab('model')}
          aria-label={`Modelo atual: ${activeModel.name}. Toque para trocar`}
        >
          <span className="m-model-thumb" key={modelId}>
            <img src={thumbUrl(modelId)} alt="" />
          </span>

          <span className="m-model-text">
            <small>Modelo</small>
            <strong>{activeModel.shortName || activeModel.name}</strong>
          </span>

          <span className="m-model-chevron">
            <Icon name="chevron" size={18} />
          </span>
        </button>

        <div className="m-topbar-actions">

          <a
            className="m-icon-btn m-almatie-link"
            href={almatieUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ir para o site Almatiê (abre em nova aba)"
            title="Ir para o site Almatiê"
          >
            <Icon name="external" size={16} />
          </a>

          <button
            type="button"
            className="m-icon-btn"
            onClick={toggleClean}
            aria-label="Visão limpa: esconder controles"
            aria-pressed={clean}
          >
            <Icon name="eye-off" size={19} />
          </button>

        </div>

        {recording && (
          <div className="m-topbar-progress" role="progressbar" aria-label="Gravando vídeo">
            <span style={{ width: `${exportProps.recordProgress}%` }} />
          </div>
        )}

      </header>


      {/* =========== CONVITE PARA ENVIAR ARTE =========== */}

      {showArtCta && !isOpen && !clean && (
        <button
          type="button"
          className="m-art-cta"
          onClick={() => handleTab('art')}
        >
          <span className="m-art-cta-icon">
            <Icon name="plus" size={18} />
          </span>
          Enviar sua arte
        </button>
      )}


      {/* ============= VISÃO LIMPA: VOLTAR ============= */}

      <button
        type="button"
        className="m-clean-restore"
        onClick={toggleClean}
        aria-label="Mostrar controles"
        tabIndex={clean ? 0 : -1}
      >
        <Icon name="eye" size={20} />
        <span>Mostrar controles</span>
      </button>


      {/* ============== PAINEL DESLIZANTE ============== */}

      <section
        ref={sheetRef}
        className="m-sheet"
        aria-hidden={!isOpen}
        aria-label={sheetMeta ? sheetMeta.title : 'Painel'}
      >

        <div
          className="m-grab"
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
        >

          <span className="m-grab-bar" />

          <div className="m-sheet-head">

            <div className="m-sheet-title">
              <strong>{sheetMeta?.title}</strong>
              <small>{sheetMeta?.hint}</small>
            </div>

            <div
              className="m-sheet-head-actions"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="m-icon-btn small m-expand-btn"
                onClick={() => {
                  vibrate(6)
                  setSnap((s) => (s === 'half' ? 'full' : 'half'))
                }}
                aria-label={snap === 'half' ? 'Expandir painel' : 'Recolher painel'}
                data-snap={snap}
              >
                <Icon name="expand" size={18} />
              </button>

              <button
                type="button"
                className="m-icon-btn small"
                onClick={() => {
                  vibrate(6)
                  setTab(null)
                }}
                aria-label="Fechar painel"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

          </div>

        </div>

        <div className="m-sheet-body" key={tab || 'none'}>

          {tab === 'export' && (
            <div className="m-export">
              <ExportPanel {...exportProps} hideHeading />
            </div>
          )}

          {(tab === 'art' || tab === 'colors' || tab === 'background') && (
            <ControlsPanel {...controlsProps} mobileTab={tab} />
          )}

        </div>

      </section>


      {/* ================= ABAS ================= */}

      <nav className="m-tabbar" aria-label="Seções do editor">

        <span
          className="m-tab-indicator"
          style={{
            transform: `translateX(${Math.max(indicatorIndex, 0) * 100}%)`,
            opacity: indicatorIndex >= 0 ? 1 : 0,
          }}
          aria-hidden="true"
        />

        {TABS.map((item) => {
          const active = item.id === 'model'
            ? pickerOpen
            : tab === item.id && !clean

          const needsArt = item.id === 'art' && !hasArt

          return (
            <button
              key={item.id}
              type="button"
              className={`m-tab${active ? ' active' : ''}`}
              onClick={() => handleTab(item.id)}
              aria-pressed={active}
              disabled={isBusy && item.id !== 'export'}
            >
              <span className="m-tab-icon" key={active ? 'on' : 'off'}>
                <Icon name={item.icon} size={22} />
                {needsArt && <span className="m-tab-dot" />}
              </span>
              <span className="m-tab-label">{item.label}</span>
            </button>
          )
        })}

      </nav>


      {/* ========== ESCOLHA DE MODELO (tela cheia) ========== */}

      {pickerOpen && (
        <ModelPickerModal
          variant="sheet"
          modelsByGroup={modelsByGroup}
          activeModelId={modelId}
          onSelect={(id) => {
            vibrate(10)
            setModelId(id)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

    </div>
  )
}

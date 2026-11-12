import { memo, useCallback, useEffect, useState } from 'react'
import Viewport from './Viewport.jsx'
import ControlsPanel from './ControlsPanel.jsx'
import ExportPanel from './ExportPanel.jsx'
import {
  ModelPickerModal,
  getModelsByGroup,
  thumbUrl,
} from './ModelPicker.jsx'
import { getModel } from '../config/models.js'
import BrandLink from './BrandMark.jsx'
import { Icon } from './Icons.jsx'
import { useSheetDrag, vibrate } from '../hooks/useSheetDrag.js'
import { ViewSizeSwitch, QuickActions } from './StageControls.jsx'


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


export default function MobileShell({
  controlsProps,
  viewportProps,
  exportProps,
  almatieUrl,
  isBusy,

  history = null,
  onOpenSheet = null,

  desktop = false,
  viewMode = 'expanded',
  onViewMode = () => {},
}) {
  const { modelId, setModelId, artZones } = controlsProps

  const [tab, setTab] = useState(null) // null | 'art' | 'colors' | 'background' | 'export'
  const [snap, setSnap] = useState('half') // 'half' | 'full'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [clean, setClean] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showArtCta, setShowArtCta] = useState(false)


  const activeModel = getModel(modelId)

  const bgEditMode = viewportProps.bgEditMode

  // ao ajustar o fundo na cena, o painel sai da frente
  useEffect(() => {
    if (bgEditMode) setTab(null)
  }, [bgEditMode])

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


  const { sheetRef, onGrabDown, onGrabMove, onGrabUp } = useSheetDrag({
    snap,
    setSnap,
    close: () => setTab(null),
  })


  const modelsByGroup = getModelsByGroup()
  const sheetMeta = tab ? SHEET_TITLES[tab] : null
  const activeIndex = tab ? TABS.findIndex((t) => t.id === tab) : -1
  const indicatorIndex = pickerOpen ? 0 : activeIndex

  const recording = exportProps.isRecording

  return (
    <div
      className={`m-app${desktop ? ' m-desktop' : ''}`}
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
          className="viewport-area m-viewport-area"
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
              <small>
                {desktop
                  ? 'Use o scroll do mouse para o zoom'
                  : 'Pince com dois dedos para o zoom'}
              </small>
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

          {desktop && (
            <>
              <ViewSizeSwitch value={viewMode} onChange={onViewMode} />

              <QuickActions {...exportProps} />
            </>
          )}

          <BrandLink href={almatieUrl} variant="mobile" />

          {onOpenSheet && !desktop && (
            <button
              type="button"
              className="m-icon-btn"
              onClick={() => {
                vibrate(8)
                onOpenSheet()
              }}
              aria-label="Abrir o gabarito de impressão"
              title="Gabarito de impressão"
            >
              <Icon name="sheet" size={19} />
            </button>
          )}

          {history && (
            <button
              type="button"
              className="m-icon-btn"
              onClick={() => {
                vibrate(8)
                history.undo()
              }}
              disabled={!history.canUndo}
              aria-label="Desfazer última alteração"
              title="Desfazer"
            >
              <Icon name="undo" size={19} />
            </button>
          )}

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
          onPointerDown={desktop ? undefined : onGrabDown}
          onPointerMove={desktop ? undefined : onGrabMove}
          onPointerUp={desktop ? undefined : onGrabUp}
          onPointerCancel={desktop ? undefined : onGrabUp}
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
          variant={desktop ? 'dialog' : 'sheet'}
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

import { useEffect, useRef, useState } from 'react'
import SiteHeader from '../components/SiteHeader.jsx'
import { Icon } from '../components/Icons.jsx'
import { useSheetDrag, vibrate } from '../hooks/useSheetDrag.js'
import ModeSwitch from '../sheet/ModeSwitch.jsx'
import DtfEditor from './DtfEditor.jsx'
import { DTF_TABS, ImagesPane, ObjectPane, PagePane, SavePane, WarningList } from './DtfPanels.jsx'

/*
  ==========================================================
  GABARITO DTF — telas (desktop e celular)
  ==========================================================
*/

function Pane({ tab, dtf, onAdd }) {
  if (tab === 'page') return <PagePane dtf={dtf} />
  if (tab === 'images') return <ImagesPane dtf={dtf} onAdd={onAdd} />
  if (tab === 'object') return <ObjectPane dtf={dtf} />

  return <SavePane dtf={dtf} />
}

/* seletor de arquivos compartilhado (botões, painel e folha vazia) */
function useFilePicker(dtf) {
  const inputRef = useRef(null)

  const open = () => inputRef.current?.click()

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        dtf.addFiles(e.target.files)
        e.target.value = ''
      }}
    />
  )

  return { open, input }
}

/* Ctrl+V com imagens na área de transferência; Ctrl+Z / Ctrl+Shift+Z */
function useGlobalShortcuts(dtf) {
  const ref = useRef(dtf)

  ref.current = dtf

  useEffect(() => {
    const onPaste = (e) => {
      const tag = e.target?.tagName

      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const files = [...(e.clipboardData?.files || [])]

      if (files.length) {
        e.preventDefault()
        ref.current.addFiles(files)
      }
    }

    const onKey = (e) => {
      const tag = e.target?.tagName

      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (!(e.ctrlKey || e.metaKey) || e.altKey) return

      const key = e.key.toLowerCase()

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        ref.current.history.undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        ref.current.history.redo()
      }
    }

    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
    }
  }, [])
}

function QuickSave({ dtf }) {
  const disabled = Boolean(dtf.busy) || !dtf.objects.length

  return (
    <div className="sheet-quick">

      <button
        type="button"
        className="sheet-quick-btn"
        onClick={() => dtf.exportAs('pdf')}
        disabled={disabled}
        data-tip={dtf.objects.length ? 'Salvar em PDF' : 'Insira uma imagem primeiro'}
      >
        <Icon name="download" size={17} />
        {dtf.busy === 'pdf' ? 'Gerando…' : 'PDF'}
      </button>

      <button
        type="button"
        className="sheet-quick-btn"
        onClick={() => dtf.exportAs('png')}
        disabled={disabled}
        data-tip={dtf.objects.length ? 'Salvar em PNG transparente' : 'Insira uma imagem primeiro'}
        data-tip-pos="end"
      >
        <Icon name="image" size={17} />
        {dtf.busy === 'png' ? `${Math.round(dtf.progress * 100)}%` : 'PNG'}
      </button>

    </div>
  )
}

function Chips({ dtf }) {
  const { settings, objects } = dtf
  const warnCount = dtf.overlaps.length + dtf.lowQuality.length + dtf.outside.length

  return (
    <div className="dtf-chips">

      <span className="sheet-chip strong">
        {settings.paper} · {settings.orientation === 'landscape' ? 'paisagem' : 'retrato'}
      </span>

      <span className="sheet-chip">
        {objects.length} {objects.length === 1 ? 'imagem' : 'imagens'}
      </span>

      <span className="sheet-chip ok">Fundo transparente</span>

      {dtf.overlaps.length > 0 && (
        <button
          type="button"
          className="sheet-chip warn"
          onClick={() => dtf.select([...new Set(dtf.overlaps.flat())])}
          title="Selecionar as imagens sobrepostas"
        >
          Sobreposição: {dtf.overlaps.length}
        </button>
      )}

      {dtf.lowQuality.length > 0 && (
        <button
          type="button"
          className="sheet-chip warn"
          onClick={() => dtf.select(dtf.lowQuality)}
          title="Selecionar as imagens de baixa qualidade"
        >
          Qualidade baixa: {dtf.lowQuality.length}
        </button>
      )}

      {dtf.outside.length > 0 && (
        <button
          type="button"
          className="sheet-chip warn"
          onClick={() => dtf.select(dtf.outside)}
          title="Selecionar as imagens que saem da folha"
        >
          Fora da folha: {dtf.outside.length}
        </button>
      )}

      {settings.mirror && <span className="sheet-chip accent">↔ Espelhado</span>}

      {warnCount === 0 && objects.length > 0 && <span className="sheet-chip ok">Sem avisos</span>}

    </div>
  )
}


/* ---------- DESKTOP ---------- */

function DesktopDtf({ dtf, mode, onMode, onSection }) {
  const [tab, setTab] = useState('images')
  const { open, input } = useFilePicker(dtf)

  useGlobalShortcuts(dtf)

  // ao selecionar algo na folha, mostra a aba "Objeto" (como a barra de propriedades do Corel)
  const had = useRef(false)

  useEffect(() => {
    const has = dtf.selected.length > 0

    if (has && !had.current && (tab === 'page' || tab === 'save')) setTab('object')

    had.current = has
  }, [dtf.selected.length, tab])

  const index = DTF_TABS.findIndex((t) => t.id === tab)
  const current = DTF_TABS[index]

  return (
    <div className="app sheet-app dtf-app">

      <SiteHeader section="sheet" onSection={onSection} subtitle="Gabarito de impressão">

        <div className="history-buttons">
          <button
            type="button"
            className="history-btn"
            onClick={dtf.history.undo}
            disabled={!dtf.history.canUndo}
            data-tip="Desfazer · Ctrl+Z"
            aria-label="Desfazer"
          >
            <Icon name="undo" size={17} />
          </button>

          <button
            type="button"
            className="history-btn"
            onClick={dtf.history.redo}
            disabled={!dtf.history.canRedo}
            data-tip="Refazer · Ctrl+Shift+Z"
            data-tip-pos="end"
            aria-label="Refazer"
          >
            <Icon name="redo" size={17} />
          </button>
        </div>

      </SiteHeader>

      <div className="workspace">

        <aside className="panel">

          <div className="panel-heading panel-heading-tabbed">

            <div className="panel-title-row">
              <div>
                <span className="section-kicker">GABARITO PARA DTF</span>
                <h2>Folha livre</h2>
              </div>
            </div>

            <nav
              className="panel-tabs"
              role="tablist"
              aria-label="Etapas do gabarito DTF"
              style={{ '--n': DTF_TABS.length, '--i': Math.max(index, 0) }}
            >

              <span className="panel-tab-thumb" aria-hidden="true" />

              {DTF_TABS.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === tab}
                  className={`panel-tab${item.id === tab ? ' active' : ''}`}
                  onClick={() => setTab(item.id)}
                >

                  <span className="panel-tab-icon">
                    <Icon name={item.icon} size={20} />

                    {item.id === 'images' && dtf.objects.length === 0 && <span className="panel-tab-dot" />}

                    {item.id === 'object' && dtf.selected.length > 0 && tab !== 'object' && (
                      <span className="panel-tab-dot" />
                    )}
                  </span>

                  <span className="panel-tab-label">
                    <em>{i + 1}</em>
                    {item.label}
                  </span>

                </button>
              ))}

            </nav>

          </div>

          <div className="tab-pane" key={tab}>

            <header className="tab-pane-head">

              <span className="tab-pane-icon" aria-hidden="true">
                <Icon name={current.icon} size={22} />
              </span>

              <div className="tab-pane-text">
                <span className="tab-pane-step">{current.label.toUpperCase()}</span>
                <h3>{current.title}</h3>
                <p>{current.desc}</p>
              </div>

            </header>

            <div className="tab-pane-body">
              <Pane tab={tab} dtf={dtf} onAdd={open} />
            </div>

          </div>

        </aside>


        <main className="stage sheet-stage dtf-stage">

          <div className="stage-header">

            <div className="stage-title-group">
              <div>
                <span className="section-kicker">EDITOR LIVRE · DTF</span>
                <h2>Monte a folha</h2>
              </div>
            </div>

            <div className="stage-tools">
              <ModeSwitch mode={mode} onMode={onMode} />

              <button type="button" className="sheet-add-btn" onClick={open}>
                <Icon name="plus" size={17} />
                Adicionar
              </button>

              <QuickSave dtf={dtf} />
            </div>

          </div>

          <div className="sheet-stage-body dtf-stage-body">
            <DtfEditor dtf={dtf} onAdd={open} />
            <Chips dtf={dtf} />
          </div>

          {input}

        </main>

      </div>

    </div>
  )
}


/* ---------- CELULAR ---------- */

function MobileDtf({ dtf, mode, onMode, onSection }) {
  const [tab, setTab] = useState(null)
  const [snap, setSnap] = useState('half')
  const { open, input } = useFilePicker(dtf)

  const isOpen = Boolean(tab)
  const state = isOpen ? snap : 'closed'

  const { sheetRef, onGrabDown, onGrabMove, onGrabUp } = useSheetDrag({
    snap,
    setSnap,
    close: () => setTab(null),
  })

  const current = DTF_TABS.find((t) => t.id === tab)
  const index = tab ? DTF_TABS.findIndex((t) => t.id === tab) : -1

  const had = useRef(false)

  // selecionar uma imagem abre a aba "Objeto" em meia altura
  useEffect(() => {
    const has = dtf.selected.length > 0

    if (has && !had.current && !tab) {
      setTab('object')
      setSnap('half')
    }

    if (!has && had.current && tab === 'object') setTab(null)

    had.current = has
  }, [dtf.selected.length, tab])

  const choose = (id) => {
    vibrate()

    if (tab === id) {
      setTab(null)
      return
    }

    setTab(id)
    setSnap('half')
  }

  return (
    <div className="m-app m-sheetapp m-dtfapp" data-sheet={state} data-clean="false">

      <div className="m-stage">
        <DtfEditor dtf={dtf} compact onAdd={open} />
      </div>

      <header className="m-topbar">

        <button
          type="button"
          className="m-icon-btn"
          onClick={() => onSection('mockup')}
          aria-label="Voltar ao mockup 3D"
          title="Voltar ao mockup 3D"
        >
          <Icon name="back" size={20} />
        </button>

        <ModeSwitch mode={mode} onMode={onMode} />

        <div className="m-topbar-actions">

          <button
            type="button"
            className="m-icon-btn"
            onClick={() => {
              vibrate(8)
              dtf.history.undo()
            }}
            disabled={!dtf.history.canUndo}
            aria-label="Desfazer"
          >
            <Icon name="undo" size={19} />
          </button>

          <button type="button" className="m-fab-add" onClick={open} aria-label="Adicionar imagens">
            <Icon name="plus" size={22} />
          </button>

        </div>

      </header>

      <section
        ref={sheetRef}
        className="m-sheet"
        aria-hidden={!isOpen}
        aria-label={current ? current.title : 'Painel'}
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
              <strong>{current?.title}</strong>
              <small>{current?.desc}</small>
            </div>

            <div className="m-sheet-head-actions" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" className="m-icon-btn small" onClick={() => setTab(null)} aria-label="Fechar painel">
                <Icon name="close" size={17} />
              </button>
            </div>

          </div>

        </div>

        <div className="m-sheet-body" key={tab || 'none'}>
          {tab && (
            <div className="sheet-pane-mobile">
              <Pane tab={tab} dtf={dtf} onAdd={open} />
            </div>
          )}
        </div>

      </section>

      <nav className="m-tabbar" aria-label="Etapas do gabarito DTF">

        <span
          className="m-tab-indicator"
          style={{
            transform: `translateX(${Math.max(index, 0) * 100}%)`,
            opacity: index >= 0 ? 1 : 0,
          }}
          aria-hidden="true"
        />

        {DTF_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`m-tab${tab === item.id ? ' active' : ''}`}
            onClick={() => choose(item.id)}
            aria-pressed={tab === item.id}
          >
            <span className="m-tab-icon" key={tab === item.id ? 'on' : 'off'}>
              <Icon name={item.icon} size={22} />
              {item.id === 'images' && dtf.objects.length === 0 && <span className="m-tab-dot" />}
            </span>
            <span className="m-tab-label">{item.label}</span>
          </button>
        ))}

      </nav>

      {input}

    </div>
  )
}


export default function DtfStudio({ dtf, isMobile, mode, onMode, onSection }) {
  useGlobalShortcutsMobileSafe(dtf, isMobile)

  return isMobile
    ? <MobileDtf dtf={dtf} mode={mode} onMode={onMode} onSection={onSection} />
    : <DesktopDtf dtf={dtf} mode={mode} onMode={onMode} onSection={onSection} />
}

// no celular só o "colar" interessa (sem teclado físico), mas o gancho é o mesmo
function useGlobalShortcutsMobileSafe(dtf, isMobile) {
  const ref = useRef(dtf)

  ref.current = dtf

  useEffect(() => {
    if (!isMobile) return undefined

    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])]

      if (files.length) ref.current.addFiles(files)
    }

    window.addEventListener('paste', onPaste)

    return () => window.removeEventListener('paste', onPaste)
  }, [isMobile])
}

export { WarningList }

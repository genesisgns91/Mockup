import { useState } from 'react'
import SiteHeader from '../components/SiteHeader.jsx'
import { Icon } from '../components/Icons.jsx'
import { useSheetDrag, vibrate } from '../hooks/useSheetDrag.js'
import SheetPreview from './SheetPreview.jsx'
import { AdjustPane, ArtsPane, MeasurePane, SHEET_TABS, SavePane } from './SheetPanes.jsx'

/*
  ==========================================================
  GABARITO DE IMPRESSÃO — telas

  • Desktop: painel de 4 etapas à esquerda + folha em escala à direita.
  • Celular: app com a folha em tela cheia, abas embaixo e painel
    deslizante (mesma lógica do mockup 3D).
  ==========================================================
*/

function Pane({ tab, sheet }) {
  if (tab === 'measure') return <MeasurePane sheet={sheet} />
  if (tab === 'arts') return <ArtsPane sheet={sheet} />
  if (tab === 'adjust') return <AdjustPane sheet={sheet} />

  return <SavePane sheet={sheet} />
}

function QuickSave({ sheet }) {
  const { busy, items, exportAs, progress } = sheet
  const disabled = Boolean(busy) || !items.length

  return (
    <div className="sheet-quick">

      <button
        type="button"
        className="sheet-quick-btn"
        onClick={() => exportAs('pdf')}
        disabled={disabled}
        data-tip={items.length ? 'Salvar em PDF' : 'Envie uma arte primeiro'}
      >
        <Icon name="download" size={17} />
        {busy === 'pdf' ? 'Gerando…' : 'PDF'}
      </button>

      <button
        type="button"
        className="sheet-quick-btn"
        onClick={() => exportAs('png')}
        disabled={disabled}
        data-tip={items.length ? 'Salvar em PNG transparente' : 'Envie uma arte primeiro'}
        data-tip-pos="end"
      >
        <Icon name="image" size={17} />
        {busy === 'png' ? `${Math.round(progress * 100)}%` : 'PNG'}
      </button>

    </div>
  )
}


/* ---------- DESKTOP ---------- */

function DesktopSheet({ sheet, onSection }) {
  const [tab, setTab] = useState('measure')
  const [pickSlot, setPickSlot] = useState(null)

  const index = SHEET_TABS.findIndex((t) => t.id === tab)
  const current = SHEET_TABS[index]
  const hasArt = sheet.filledCount > 0

  return (
    <div className="app sheet-app">

      <SiteHeader
        section="sheet"
        onSection={onSection}
        subtitle="Gabarito de impressão"
      >
        <button
          type="button"
          className="history-btn"
          onClick={sheet.reset}
          data-tip="Restaurar medidas padrão"
          data-tip-pos="end"
          aria-label="Restaurar medidas padrão"
        >
          <Icon name="reset" size={17} />
        </button>
      </SiteHeader>


      <div className="workspace">

        <aside className="panel">

          <div className="panel-heading panel-heading-tabbed">

            <div className="panel-title-row">
              <div>
                <span className="section-kicker">GABARITO PARA SUBLIMAÇÃO</span>
                <h2>Monte a folha</h2>
              </div>
            </div>

            <nav
              className="panel-tabs"
              role="tablist"
              aria-label="Etapas do gabarito"
              style={{ '--n': SHEET_TABS.length, '--i': Math.max(index, 0) }}
            >

              <span className="panel-tab-thumb" aria-hidden="true" />

              {SHEET_TABS.map((item, i) => (
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

                    {item.id === 'arts' && !hasArt && <span className="panel-tab-dot" />}

                    {item.id === 'arts' && hasArt && (
                      <span className="panel-tab-check">
                        <Icon name="check" size={9} />
                      </span>
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
                <span className="tab-pane-step">PASSO {index + 1} DE {SHEET_TABS.length}</span>
                <h3>{current.title}</h3>
                <p>{current.desc}</p>
              </div>

            </header>

            <div className="tab-pane-body">
              <Pane tab={tab} sheet={sheet} />
            </div>

          </div>


          <div className="panel-nav">

            <button
              type="button"
              className="panel-nav-btn ghost"
              onClick={() => setTab(SHEET_TABS[index - 1].id)}
              disabled={index <= 0}
            >
              <Icon name="arrow-left" size={16} />
              Voltar
            </button>

            {index < SHEET_TABS.length - 1 ? (
              <button
                type="button"
                className="panel-nav-btn primary"
                onClick={() => setTab(SHEET_TABS[index + 1].id)}
              >
                Próximo: {SHEET_TABS[index + 1].label}
                <Icon name="arrow-right" size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="panel-nav-btn primary"
                onClick={() => sheet.exportAs('pdf')}
                disabled={!sheet.items.length || Boolean(sheet.busy)}
              >
                Salvar em PDF
                <Icon name="download" size={16} />
              </button>
            )}

          </div>

        </aside>


        <main className="stage sheet-stage">

          <div className="stage-header">

            <div className="stage-title-group">
              <div>
                <span className="section-kicker">FOLHA EM ESCALA REAL</span>
                <h2>Prévia do gabarito</h2>
              </div>
            </div>

            <div className="stage-tools">
              <QuickSave sheet={sheet} />
            </div>

          </div>

          <div className="sheet-stage-body">
            <SheetPreview
              sheet={sheet}
              onPickSlot={(slot) => {
                setTab('arts')
                setPickSlot(slot)
              }}
            />
          </div>

          {pickSlot !== null && (
            <input
              type="file"
              accept="image/*"
              hidden
              ref={(el) => {
                if (el) {
                  el.onchange = () => {
                    sheet.uploadAt(pickSlot, el.files?.[0])
                    setPickSlot(null)
                  }

                  el.oncancel = () => setPickSlot(null)
                  el.click()
                }
              }}
            />
          )}

        </main>

      </div>

    </div>
  )
}


/* ---------- CELULAR ---------- */

function MobileSheet({ sheet, onSection }) {
  const [tab, setTab] = useState(null)
  const [snap, setSnap] = useState('half')

  const open = Boolean(tab)
  const state = open ? snap : 'closed'

  const { sheetRef, onGrabDown, onGrabMove, onGrabUp } = useSheetDrag({
    snap,
    setSnap,
    close: () => setTab(null),
  })

  const hasArt = sheet.filledCount > 0
  const current = SHEET_TABS.find((t) => t.id === tab)
  const index = tab ? SHEET_TABS.findIndex((t) => t.id === tab) : -1

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
    <div className="m-app m-sheetapp" data-sheet={state} data-clean="false">

      <div className="m-stage">
        <SheetPreview
          sheet={sheet}
          onPickSlot={() => choose('arts')}
        />
      </div>

      <div
        className={`m-scrim${state === 'full' ? ' on' : ''}`}
        onClick={() => setSnap('half')}
        aria-hidden="true"
      />

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

        <div className="m-title-pill">
          <small>Gabarito</small>
          <strong>
            {sheet.settings.paper} · {sheet.items.length} {sheet.items.length === 1 ? 'arte' : 'artes'}
          </strong>
        </div>

        <div className="m-topbar-actions">
          <button
            type="button"
            className="m-save-btn"
            onClick={() => sheet.exportAs('pdf')}
            disabled={!sheet.items.length || Boolean(sheet.busy)}
            aria-label="Salvar em PDF"
          >
            <Icon name="download" size={18} />
            {sheet.busy === 'pdf' ? 'Gerando…' : 'PDF'}
          </button>
        </div>

      </header>

      <section
        ref={sheetRef}
        className="m-sheet"
        aria-hidden={!open}
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

            <div
              className="m-sheet-head-actions"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="m-icon-btn small"
                onClick={() => setTab(null)}
                aria-label="Fechar painel"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

          </div>

        </div>

        <div className="m-sheet-body" key={tab || 'none'}>
          {tab && <div className="sheet-pane-mobile"><Pane tab={tab} sheet={sheet} /></div>}
        </div>

      </section>

      <nav className="m-tabbar" aria-label="Etapas do gabarito">

        <span
          className="m-tab-indicator"
          style={{
            transform: `translateX(${Math.max(index, 0) * 100}%)`,
            opacity: index >= 0 ? 1 : 0,
          }}
          aria-hidden="true"
        />

        {SHEET_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`m-tab${tab === item.id ? ' active' : ''}`}
            onClick={() => choose(item.id)}
            aria-pressed={tab === item.id}
          >
            <span className="m-tab-icon" key={tab === item.id ? 'on' : 'off'}>
              <Icon name={item.icon} size={22} />
              {item.id === 'arts' && !hasArt && <span className="m-tab-dot" />}
            </span>
            <span className="m-tab-label">{item.label}</span>
          </button>
        ))}

      </nav>

    </div>
  )
}


export default function SheetStudio({ sheet, isMobile, onSection }) {
  return isMobile
    ? <MobileSheet sheet={sheet} onSection={onSection} />
    : <DesktopSheet sheet={sheet} onSection={onSection} />
}

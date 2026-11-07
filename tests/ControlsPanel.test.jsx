import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import ControlsPanel from '../src/components/ControlsPanel.jsx'
import { ToastProvider } from '../src/components/Toast.jsx'
import { MODELS, getModel } from '../src/config/models.js'

const noop = () => {}

function props(modelId) {
  const model = getModel(modelId)
  const artZones = {}
  const partColors = {}

  for (const zone of model.printZones) {
    artZones[zone.key] = { widthMM: 210, heightMM: 92, offsetXMM: 0, offsetYMM: 0, mugRealHeightMM: 95 }
  }

  for (const part of model.colorParts) partColors[part.key] = part.default

  return {
    artZones, setArtZones: noop,
    background: { type: 'color', color: '#F3ECE3', image: null, fit: 'cover', zoom: 1, offsetXFrac: 0.5, offsetYFrac: 0.5 },
    setBackground: noop, partColors, setPartColors: noop,
    glassOpacity: 0.8, setGlassOpacity: noop, mugShine: 0.5, setMugShine: noop,
    modelId, setModelId: noop, warning: null,
    linkArt: false, setLinkArt: noop, activeZoneKey: null, setActiveZoneKey: noop,
    frameAspect: null, onEditBackground: noop, onArtFile: noop, onBackgroundFile: noop,
  }
}

describe('ControlsPanel', () => {
  it('renderiza todas as abas de todos os modelos sem erro (desktop e celular)', () => {
    let renders = 0

    for (const id of Object.keys(MODELS)) {
      for (const mobileTab of [undefined, 'art', 'colors', 'background']) {
        const html = renderToString(
          <ToastProvider>
            <ControlsPanel {...props(id)} mobileTab={mobileTab} />
          </ToastProvider>
        )

        expect(html.length).toBeGreaterThan(100)
        renders += 1
      }
    }

    expect(renders).toBe(Object.keys(MODELS).length * 4)
  })

  it('no desktop mostra as quatro etapas e a navegação', () => {
    const html = renderToString(
      <ToastProvider>
        <ControlsPanel {...props('single')} />
      </ToastProvider>
    )

    for (const label of ['Modelo', 'Arte', 'Cores', 'Fundo']) {
      expect(html).toContain(label)
    }

    expect(html).toContain('panel-nav')
  })
})

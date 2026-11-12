/*
  ==========================================================
  GABARITO DE IMPRESSÃO — folhas e medidas padrão
  ==========================================================
*/

export const PAPERS = {
  A4: { id: 'A4', label: 'A4', w: 210, h: 297 },
  A3: { id: 'A3', label: 'A3', w: 297, h: 420 },
}

export const MAX_ARTS = 6
export const MARGIN_MIN = 0
export const MARGIN_MAX = 10
export const GAP_MAX = 10
export const DPI_OPTIONS = [300, 600]

/*
  Medidas padrão de arte (largura × altura, em milímetros).

  verified: true  → medida de referência confirmada em fichas/modelos
                    de fabricantes e lojas de sublimação.
  verified: false → medida aproximada (varia entre fabricantes):
                    confira com o seu fornecedor ou use "Personalizada".
*/
export const ART_PRESETS = [
  {
    id: 'caneca-325',
    group: 'Canecas',
    name: 'Caneca 325 ml',
    detail: 'Padrão · 11 oz',
    w: 210,
    h: 95,
    verified: true,
  },
  {
    id: 'caneca-450',
    group: 'Canecas',
    name: 'Caneca 450 ml',
    detail: 'Canecão · 15 oz',
    w: 235,
    h: 95,
    verified: false,
  },
  {
    id: 'chopp-475',
    group: 'Chopp',
    name: 'Caneca de chopp 475 ml',
    detail: 'Vidro jateado',
    w: 210,
    h: 90,
    verified: false,
  },
  {
    id: 'garrafa-500',
    group: 'Garrafas',
    name: 'Garrafinha 500 ml',
    detail: 'Squeeze pequeno',
    w: 200,
    h: 110,
    verified: false,
  },
  {
    id: 'squeeze-600',
    group: 'Garrafas',
    name: 'Squeeze 600 ml',
    detail: 'Alumínio branco',
    w: 230,
    h: 135,
    verified: true,
  },
]

export const CUSTOM_PRESET_ID = 'custom'
export const DEFAULT_PRESET_ID = 'caneca-325'

export const CUSTOM_LIMITS = { min: 20, max: 420 }

export function getPreset(id) {
  return ART_PRESETS.find((p) => p.id === id) || ART_PRESETS[0]
}

export function resolveArtSize(presetId, custom) {
  if (presetId === CUSTOM_PRESET_ID) {
    const clamp = (v) =>
      Math.min(CUSTOM_LIMITS.max, Math.max(CUSTOM_LIMITS.min, Number(v) || 0))

    return { w: clamp(custom?.w), h: clamp(custom?.h) }
  }

  const preset = getPreset(presetId)

  return { w: preset.w, h: preset.h }
}

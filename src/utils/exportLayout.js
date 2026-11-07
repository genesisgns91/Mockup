/*
  ==========================================================
  UTILITÁRIOS DE LAYOUT PARA FUNDO E EXPORTAÇÃO

  Funções puras, sem dependências de React ou Three.js,
  para que o mesmo cálculo seja usado:

  - na prévia ao vivo do fundo (painel de controle)
  - no guia de corte sobre o viewport 3D
  - na composição final do PNG/vídeo exportado

  Isso garante que o que o usuário vê é exatamente
  o que será salvo.
  ==========================================================
*/

export function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}


/*
  Calcula tamanho e posição de uma imagem dentro de uma
  caixa (boxWidth x boxHeight), respeitando o modo de
  encaixe, o zoom e a posição (offsetXFrac / offsetYFrac,
  de 0 a 1; 0.5 = centralizada).

  fit:
    'cover'   -> preenche a caixa inteira, cortando o excesso
    'contain' -> a imagem inteira aparece dentro da caixa
    'width'   -> a largura da imagem preenche a caixa
    'height'  -> a altura da imagem preenche a caixa

  zoom vai de ZOOM_MIN a ZOOM_MAX (1 = tamanho do encaixe).
  Abaixo de 1 a imagem fica menor que a caixa e a cor de
  fundo aparece ao redor.
*/
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 5

export function clampZoom(value) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value) || 1))
}

export function getImageLayout(
  naturalWidth,
  naturalHeight,
  boxWidth,
  boxHeight,
  fit = 'cover',
  zoom = 1,
  offsetXFrac = 0.5,
  offsetYFrac = 0.5
) {
  if (
    !naturalWidth ||
    !naturalHeight ||
    !boxWidth ||
    !boxHeight
  ) {
    return {
      drawW: boxWidth || 0,
      drawH: boxHeight || 0,
      x: 0,
      y: 0,
    }
  }

  const widthScale = boxWidth / naturalWidth
  const heightScale = boxHeight / naturalHeight

  let baseScale = Math.max(widthScale, heightScale)

  if (fit === 'contain') baseScale = Math.min(widthScale, heightScale)
  if (fit === 'width') baseScale = widthScale
  if (fit === 'height') baseScale = heightScale

  const scale = baseScale * clampZoom(zoom)

  const drawW = naturalWidth * scale
  const drawH = naturalHeight * scale

  /*
    (caixa - imagem) * fração funciona nos dois casos:
    imagem maior que a caixa (valor negativo = corte) e
    imagem menor (valor positivo = margem).
  */
  const x = (boxWidth - drawW) * clamp01(offsetXFrac)
  const y = (boxHeight - drawH) * clamp01(offsetYFrac)

  return { drawW, drawH, x, y }
}


/*
  Calcula o retângulo de recorte "cover" de um canvas de
  origem (sw x sh) para um formato alvo (targetAspect),
  permitindo deslocar o centro do recorte via
  offsetXFrac / offsetYFrac (0 a 1, 0.5 = centralizado).

  Usado tanto pelo guia visual sobre o viewport quanto
  pela exportação (PNG e vídeo), para que o recorte final
  seja sempre igual ao que foi mostrado ao usuário.
*/
export function computeCoverCrop(
  sw,
  sh,
  targetAspect,
  offsetXFrac = 0.5,
  offsetYFrac = 0.5
) {
  const sourceAspect = sw / sh

  let cropW
  let cropH

  if (sourceAspect > targetAspect) {
    cropH = sh
    cropW = sh * targetAspect
  } else {
    cropW = sw
    cropH = sw / targetAspect
  }

  const maxX = Math.max(0, sw - cropW)
  const maxY = Math.max(0, sh - cropH)

  const cropX = maxX * clamp01(offsetXFrac)
  const cropY = maxY * clamp01(offsetYFrac)

  return { cropW, cropH, cropX, cropY }
}

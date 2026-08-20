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
  encaixe, o zoom extra e a posição de arraste
  (offsetXFrac / offsetYFrac, de 0 a 1).

  fit:
    'cover'  -> preenche a caixa inteira, cortando o excesso
    'width'  -> a largura da imagem preenche a caixa
    'height' -> a altura da imagem preenche a caixa
*/
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

  const coverScale = Math.max(
    boxWidth / naturalWidth,
    boxHeight / naturalHeight
  )

  const widthScale = boxWidth / naturalWidth
  const heightScale = boxHeight / naturalHeight

  let baseScale = coverScale

  if (fit === 'width') baseScale = widthScale
  if (fit === 'height') baseScale = heightScale

  const scale = baseScale * Math.max(1, zoom || 1)

  const drawW = naturalWidth * scale
  const drawH = naturalHeight * scale

  const overflowX = Math.max(0, drawW - boxWidth)
  const overflowY = Math.max(0, drawH - boxHeight)

  const x = -overflowX * clamp01(offsetXFrac)
  const y = -overflowY * clamp01(offsetYFrac)

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

/*
  ==========================================================
  PREPARO DAS ARTES PARA EXPORTAR (somente no navegador)

  Cada arte é "assada" em um canvas do tamanho exato da célula
  na resolução escolhida (300/600 DPI), já espelhada e/ou
  girada, e encaixada (inteira ou preenchendo). O PDF e o PNG
  usam exatamente o mesmo resultado.
  ==========================================================
*/

export const mmToPx = (mm, dpi) => Math.max(1, Math.round((mm / 25.4) * dpi))

function sourceSize(img) {
  return {
    w: img.naturalWidth || img.width,
    h: img.naturalHeight || img.height,
  }
}

/*
  Reduz em etapas de 1/2 (melhor qualidade que um único salto
  grande) até chegar perto do tamanho final.
*/
export function stepDown(img, targetW, targetH) {
  let { w, h } = sourceSize(img)
  let source = img

  while (w / 2 >= targetW && h / 2 >= targetH) {
    const canvas = document.createElement('canvas')

    canvas.width = Math.max(1, Math.round(w / 2))
    canvas.height = Math.max(1, Math.round(h / 2))

    const ctx = canvas.getContext('2d')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

    source = canvas
    w = canvas.width
    h = canvas.height
  }

  return source
}

export function bakeArt(img, cellW, cellH, { rotated = false, mirror = false, fit = 'contain' } = {}) {
  const canvas = document.createElement('canvas')

  canvas.width = cellW
  canvas.height = cellH

  const ctx = canvas.getContext('2d')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const frameW = rotated ? cellH : cellW
  const frameH = rotated ? cellW : cellH

  const { w: iw, h: ih } = sourceSize(img)

  const scale =
    fit === 'cover'
      ? Math.max(frameW / iw, frameH / ih)
      : Math.min(frameW / iw, frameH / ih)

  const drawW = iw * scale
  const drawH = ih * scale

  const source = scale < 0.5 ? stepDown(img, drawW, drawH) : img

  ctx.save()

  ctx.beginPath()
  ctx.rect(0, 0, cellW, cellH)
  ctx.clip()

  ctx.translate(cellW / 2, cellH / 2)

  if (rotated) ctx.rotate(Math.PI / 2)
  if (mirror) ctx.scale(-1, 1)

  ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH)

  ctx.restore()

  return canvas
}


/*
  Objeto livre (editor DTF): "assa" a imagem já girada/espelhada dentro
  do retângulo que envolve o objeto (cw × ch pixels), com fundo
  transparente nos cantos.
*/
export function bakeFree(img, o, dpi, cw, ch) {
  const ppm = dpi / 25.4

  const canvas = document.createElement('canvas')

  canvas.width = cw
  canvas.height = ch

  const ctx = canvas.getContext('2d')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const dw = o.w * ppm
  const dh = o.h * ppm

  const { w: iw, h: ih } = sourceSize(img)

  const source = Math.min(dw / iw, dh / ih) < 0.5 ? stepDown(img, dw, dh) : img

  ctx.translate(cw / 2, ch / 2)
  ctx.rotate((o.angle * Math.PI) / 180)
  ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1)
  ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh)

  return canvas
}

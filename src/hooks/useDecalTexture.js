import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

// Resolution (px) used for the largest dimension of the printable canvas.
const WRAP_PX = 2048

/**
 * Builds a CanvasTexture for whichever mesh(es) receive the uploaded artwork.
 *
 * Two modes, controlled by `mode`:
 *
 * - 'cylindrical' (canecas, garrafas, copos): the print mesh's UV wraps
 *   u:0..1 around the full circumference and v:0..1 from bottom to top.
 *   `radiusUnits`/`heightUnits` (measured from the mesh geometry) plus the
 *   `realHeightMM` calibration convert model units to millimeters.
 *
 * - 'flat' (camisetas, almofadas, azulejos, bolsas, etc.): the print mesh
 *   is a flat panel whose UV already covers u:0..1 / v:0..1. `widthUnits`/
 *   `heightUnits` (the panel's own bounding box) plus the same
 *   `realHeightMM` calibration convert model units to millimeters — no
 *   circumference math needed.
 *
 * In both modes the canvas is always filled first with `baseColor` (the
 * product's own color) so areas without artwork show the product color
 * instead of black/transparent — the print mesh usually covers most of the
 * visible surface, not just a small decal strip.
 *
 * @param {Object} params
 * @param {HTMLImageElement|null} params.artImage
 * @param {number} params.artWidthMM
 * @param {number} params.artHeightMM
 * @param {number} params.offsetXMM
 * @param {number} params.offsetYMM
 * @param {'cylindrical'|'flat'} params.mode
 * @param {number} params.radiusUnits - (cylindrical) print mesh radius, model units
 * @param {number} params.widthUnits - (flat) print mesh width, model units
 * @param {number} params.heightUnits - print mesh height, model units
 * @param {number} params.realHeightMM - calibration: real height of the piece (mm)
 * @param {string} params.baseColor
 */
export function useDecalTexture({
  artImage,
  artWidthMM,
  artHeightMM,
  offsetXMM,
  offsetYMM,
  mode = 'cylindrical',
  radiusUnits,
  widthUnits,
  heightUnits,
  realHeightMM,
  baseColor,
}) {
  const canvasRef = useRef(null)
  const textureRef = useRef(null)
  const [warning, setWarning] = useState(null)

  const { spanMM, wrapHeightPx, pxPerMM } = useMemo(() => {
    if (!heightUnits) {
      return { spanMM: 0, wrapHeightPx: 0, pxPerMM: 0 }
    }

    const mmPerUnit = realHeightMM / heightUnits

    // "spanMM" is the circumference (cylindrical) or the panel width (flat) —
    // whichever dimension the artwork's width wraps/fits into.
    const spanMM =
      mode === 'flat'
        ? (widthUnits || 0) * mmPerUnit
        : 2 * Math.PI * (radiusUnits || 0) * mmPerUnit

    if (!spanMM) {
      return { spanMM: 0, wrapHeightPx: 0, pxPerMM: 0 }
    }

    const pxPerMM = WRAP_PX / spanMM
    const wrapHeightPx = Math.round(pxPerMM * realHeightMM)
    return { spanMM, wrapHeightPx, pxPerMM }
  }, [mode, radiusUnits, widthUnits, heightUnits, realHeightMM])

  const texture = useMemo(() => {
    if (!wrapHeightPx) return null
    const canvas = document.createElement('canvas')
    canvas.width = WRAP_PX
    canvas.height = wrapHeightPx
    canvasRef.current = canvas
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.anisotropy = 8
    textureRef.current = tex
    return tex
  }, [wrapHeightPx])

  useEffect(() => {
    const canvas = canvasRef.current
    const tex = textureRef.current
    if (!canvas || !tex || !pxPerMM) return

    const ctx = canvas.getContext('2d')

    // Always start with an opaque product-colored background so the piece
    // never shows black/transparent in areas without artwork.
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = baseColor || '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (!artImage) {
      tex.needsUpdate = true
      setWarning(null)
      return
    }

    const artWidthPx = artWidthMM * pxPerMM
    const artHeightPx = artHeightMM * pxPerMM

    if (artWidthMM >= spanMM) {
      setWarning(
        mode === 'flat'
          ? `A largura da arte (${artWidthMM.toFixed(
              0
            )}mm) é maior ou igual à largura da peça (${spanMM.toFixed(
              0
            )}mm). Reduza a largura para a arte caber corretamente.`
          : `A largura da arte (${artWidthMM.toFixed(
              0
            )}mm) é maior ou igual à circunferência da peça (${spanMM.toFixed(
              0
            )}mm). Reduza a largura para deixar um espaço em branco na alça.`
      )
    } else {
      setWarning(null)
    }

    const centerX = canvas.width / 2 + offsetXMM * pxPerMM
    const centerY = canvas.height / 2 - offsetYMM * pxPerMM

    const drawX = centerX - artWidthPx / 2
    const drawY = centerY - artHeightPx / 2

    ctx.save()
    // Clip to the printable canvas so art never bleeds outside it.
    ctx.beginPath()
    ctx.rect(0, 0, canvas.width, canvas.height)
    ctx.clip()
    ctx.drawImage(artImage, drawX, drawY, artWidthPx, artHeightPx)
    ctx.restore()

    tex.needsUpdate = true
  }, [
    artImage,
    artWidthMM,
    artHeightMM,
    offsetXMM,
    offsetYMM,
    pxPerMM,
    spanMM,
    mode,
    baseColor,
  ])

  return { texture, spanMM, realHeightMM, warning }
}

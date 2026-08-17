import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

// Resolution (px) used to represent the full 360° wrap (u = 0..1) of the mug.
// Height is derived to keep pixels square (no stretching) based on real mm.
const WRAP_PX = 2048

/**
 * Builds a CanvasTexture for the mug's "decal"/"print" mesh.
 *
 * The decal mesh's UV goes u:0..1 around the full circumference and v:0..1
 * from the bottom rim to the top rim. The UV seam (u=0 / u=1) sits right
 * behind the handle attachment, so leaving the left/right edges of the
 * canvas untouched by the artwork automatically hides the seam+gap behind
 * the handle, and the artwork is naturally centered on the side opposite
 * the handle.
 *
 * The canvas background is always filled with `baseColor` first (the mug's
 * ceramic color) before the artwork is drawn on top. This is what makes the
 * areas around/behind the artwork show up as ceramic-colored instead of
 * black: the print mesh IS most of the mug's visible body, not just a thin
 * decal strip, so it must always have an opaque, correctly colored canvas
 * behind it — even when no artwork has been uploaded yet.
 *
 * @param {Object} params
 * @param {HTMLImageElement|null} params.artImage - uploaded artwork image
 * @param {number} params.artWidthMM - artwork width (wraps around the mug)
 * @param {number} params.artHeightMM - artwork height (top to bottom)
 * @param {number} params.offsetXMM - horizontal shift from center (mm)
 * @param {number} params.offsetYMM - vertical shift from center (mm)
 * @param {number} params.mugRadiusUnits - decal mesh radius in model units
 * @param {number} params.mugHeightUnits - decal mesh wall height in model units
 * @param {number} params.mugRealHeightMM - calibration: real wall height in mm
 * @param {string} params.baseColor - ceramic base color painted behind the artwork
 */
export function useDecalTexture({
  artImage,
  artWidthMM,
  artHeightMM,
  offsetXMM,
  offsetYMM,
  mugRadiusUnits,
  mugHeightUnits,
  mugRealHeightMM,
  baseColor,
}) {
  const canvasRef = useRef(null)
  const textureRef = useRef(null)
  const [warning, setWarning] = useState(null)

  const { circumferenceMM, wrapHeightPx, pxPerMM } = useMemo(() => {
    if (!mugRadiusUnits || !mugHeightUnits) {
      return { circumferenceMM: 0, wrapHeightPx: 0, pxPerMM: 0 }
    }
    const mmPerUnit = mugRealHeightMM / mugHeightUnits
    const circumferenceMM = 2 * Math.PI * mugRadiusUnits * mmPerUnit
    const pxPerMM = WRAP_PX / circumferenceMM
    const wrapHeightPx = Math.round(pxPerMM * mugRealHeightMM)
    return { circumferenceMM, wrapHeightPx, pxPerMM }
  }, [mugRadiusUnits, mugHeightUnits, mugRealHeightMM])

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

    // Always start with an opaque ceramic-colored background so the mug
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

    if (artWidthMM >= circumferenceMM) {
      setWarning(
        `A largura da arte (${artWidthMM.toFixed(
          0
        )}mm) é maior ou igual à circunferência da caneca (${circumferenceMM.toFixed(
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
    // Clip to the printable wrap band so art never bleeds outside the canvas
    // (top/bottom rim and, via canvas edges, the handle area stay untouched).
    ctx.beginPath()
    ctx.rect(0, 0, canvas.width, canvas.height)
    ctx.clip()
    ctx.drawImage(artImage, drawX, drawY, artWidthPx, artHeightPx)
    ctx.restore()

    tex.needsUpdate = true
  }, [artImage, artWidthMM, artHeightMM, offsetXMM, offsetYMM, pxPerMM, circumferenceMM, baseColor])

  return { texture, circumferenceMM, wallHeightMM: mugRealHeightMM, warning }
}

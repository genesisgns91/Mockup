import * as THREE from 'three'
import { MATERIAL } from '../../config/models.js'


/*
  0 = fosco
  1 = brilho máximo

  Parâmetros físicos por família de material. "shine" (o slider de
  brilho do painel) só se aplica a materiais onde faz sentido variar
  (cerâmica e plástico); os demais têm um acabamento fisicamente
  coerente fixo, para tecido nunca parecer plástico brilhante, metal
  nunca parecer fosco, etc.
*/
export function getMaterialParams(materialKind, shine) {
  const s = Math.max(0, Math.min(1, Number(shine) || 0))

  switch (materialKind) {
    case MATERIAL.CERAMIC:
      return {
        metalness: 0,
        roughness: 0.72 - s * 0.50,
        clearcoat: s,
        clearcoatRoughness: 0.65 - s * 0.50,
        envMapIntensity: 0.25 + s * 0.75,
      }

    case MATERIAL.PLASTIC:
      return {
        metalness: 0,
        roughness: 0.45 - s * 0.30,
        clearcoat: 0.35 + s * 0.4,
        clearcoatRoughness: 0.3 - s * 0.2,
        envMapIntensity: 0.5 + s * 0.5,
      }

    case MATERIAL.GLASS:
      return {
        metalness: 0,
        roughness: 0.05,
        transmission: 0.9,
        thickness: 0.4,
        ior: 1.45,
        clearcoat: 0.3,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.1,
        transparent: true,
      }

    case MATERIAL.METAL:
      return {
        metalness: 0.9,
        roughness: 0.32,
        clearcoat: 0.1,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.2,
      }

    case MATERIAL.LEATHER:
      return {
        metalness: 0,
        roughness: 0.55,
        clearcoat: 0.08,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.35,
      }

    case MATERIAL.FOAM:
      return {
        metalness: 0,
        roughness: 0.95,
        clearcoat: 0,
        envMapIntensity: 0.15,
      }

    case MATERIAL.CARDBOARD:
      return {
        metalness: 0,
        roughness: 0.9,
        clearcoat: 0,
        envMapIntensity: 0.2,
      }

    case MATERIAL.FABRIC:
    default:
      return {
        metalness: 0,
        roughness: 0.92,
        clearcoat: 0,
        envMapIntensity: 0.2,
      }
  }
}

/*
  Parâmetros para a PEÇA COM A ARTE aplicada (o "print"). Igual ao
  material do corpo na maioria dos casos — mas em peças de vidro a
  tinta da estampa cobre a transparência (não faz sentido a arte
  "vazar luz" através do vidro), então usamos um acabamento opaco e
  levemente brilhante em vez do vidro transmissivo puro.
*/
export function getPrintMaterialParams(materialKind, shine) {
  if (materialKind === MATERIAL.GLASS) {
    return getMaterialParams(
      MATERIAL.PLASTIC,
      Math.max(Number(shine) || 0, 0.5)
    )
  }

  return getMaterialParams(materialKind, shine)
}

/*
  Papel completamente fosco.

  Não depende do brilho da caneca.
  Não altera a cor da imagem.
*/
export function getPaperMaterialParams() {
  return {
    color: new THREE.Color(
      0xffffff
    ),

    roughness: 1,

    metalness: 0,

    envMapIntensity: 0,

    side: THREE.DoubleSide,
  }
}

/*
  Cria uma cópia independente da textura
  para a folha.
*/
export function createPaperTexture(texture) {
  if (!texture) return null

  const paperTexture =
    texture.clone()

  paperTexture.colorSpace =
    THREE.SRGBColorSpace

  paperTexture.wrapS =
    THREE.ClampToEdgeWrapping

  paperTexture.wrapT =
    THREE.ClampToEdgeWrapping

  paperTexture.repeat.set(
    1,
    1
  )

  paperTexture.offset.set(
    0,
    0
  )

  paperTexture.needsUpdate =
    true

  return paperTexture
}

export function createColorMaterial(materialKind, hexColor, shine, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hexColor),
    ...getMaterialParams(materialKind, shine),
    side: THREE.DoubleSide,
    ...extra,
  })
}

/*
  ==========================================================
  FAIXA COM GLITTER

  Gera uma textura procedural (não depende da arte anexada
  pelo usuário): a cor escolhida + centenas de pontinhos claros
  espalhados, repetida ao redor da peça (RepeatWrapping) para
  cobrir os 360° com densidade uniforme, sem precisar calibrar
  medidas reais como a arte anexada.
  ==========================================================
*/
export function createGlitterTexture(hexColor) {
  const size = 512

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')

  ctx.fillStyle = hexColor || '#d4af37'
  ctx.fillRect(0, 0, size, size)

  const speckCount = 2600

  for (let i = 0; i < speckCount; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 1.6 + 0.25
    const brightness = 0.45 + Math.random() * 0.55

    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${brightness})`
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(7, 1.3)
  tex.anisotropy = 8
  tex.needsUpdate = true

  return tex
}

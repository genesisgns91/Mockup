import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Canvas,
  useThree,
  useLoader,
  useFrame,
} from '@react-three/fiber'
import {
  OrbitControls,
  ContactShadows,
} from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import { useDecalTexture } from '../hooks/useDecalTexture.js'
import {
  getImageLayout,
  computeCoverCrop,
} from '../utils/exportLayout.js'
import { MATERIAL, PRINT_MODE, getModel } from '../config/models.js'


/*
  Ambiente de estúdio (reflexos/iluminação) GERADO LOCALMENTE,
  sem depender de nenhum arquivo .hdr baixado de CDN externa.
  Mais rápido e continua funcionando mesmo em redes restritas.
*/
function StudioEnvironment() {
  const { gl, scene } = useThree()

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)

    const envTexture = pmrem.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture

    scene.environment = envTexture

    return () => {
      scene.environment = null
      envTexture.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return null
}


/*
  ==========================================================
  FUNDO

  Fundo sólido continua sendo desenhado pelo Three.js
  (scene.background = Color), como antes.

  Fundo de IMAGEM agora é responsabilidade do App.jsx,
  renderizado em HTML por trás do canvas (que fica
  transparente). Isso permite controle total de encaixe,
  zoom e posição por arraste, com a mesma composição
  aplicada também na exportação (PNG/vídeo).
  ==========================================================
*/
function SceneBackground({ background }) {
  const { scene } = useThree()

  useEffect(() => {
    if (background.type === 'color') {
      scene.background = new THREE.Color(
        background.color
      )

      return () => {
        scene.background = null
      }
    }

    scene.background = null

    return undefined
  }, [
    background.type,
    background.color,
    scene,
  ])

  return null
}


const TARGET_HEIGHT = 1.7

/*
  Duração da animação de giro 360°
  usada tanto no player 3D quanto
  na barra de progresso da UI.
*/
export const ROTATE_SECONDS = 6


/*
  Arquivos cujas faces curvas (com mais de 3 lados) ficam com
  aparência de "estática"/ruído sob luz de ambiente, porque a
  triangulação simples do carregador desalinha a normal do arquivo
  com o triângulo real. Ver comentário onde isso é usado.
*/
const NEEDS_NORMAL_FIX = new Set([
  'model-mousepad.obj',
  'model-mochila-saco.obj',
  'model-long-drink-transparente.obj',
])


function modelUrl(config) {
  return `${import.meta.env.BASE_URL}${config.file}`
}


function baseName(name) {
  return name.replace(/\.\d+$/, '')
}


/*
  Nomes de peças que carregam a arte impressa. Cobre "print",
  "print.001" (sufixo já removido por baseName), "printA"/"printB"
  e variações como "strip_print", "handle_print", "heart_mug_print".
  Um único regex genérico cobre todos os 37 modelos sem precisar de
  lista por modelo.
*/
function isPrintPartName(name) {
  return /print/i.test(name)
}


/*
  0 = fosco
  1 = brilho máximo

  Parâmetros físicos por família de material. "shine" (o slider de
  brilho do painel) só se aplica a materiais onde faz sentido variar
  (cerâmica e plástico); os demais têm um acabamento fisicamente
  coerente fixo, para tecido nunca parecer plástico brilhante, metal
  nunca parecer fosco, etc.
*/
function getMaterialParams(materialKind, shine) {
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
function getPrintMaterialParams(materialKind, shine) {
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
function getPaperMaterialParams() {
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
function createPaperTexture(texture) {
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


// "printA"/"printB": placeholders da folha solta (só existem em modelos
// com "hasPaper"). Precisam ser distinguidos da área de impressão real
// ("print", "strip_print", "heart_mug_print"...), que casa com o regex
// genérico isPrintPartName.
function isLooseSheetName(name) {
  return /^print[A-Z]$/.test(name)
}


function createColorMaterial(materialKind, hexColor, shine, extra = {}) {
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
function createGlitterTexture(hexColor) {
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


/*
  Componente "invisível" (não desenha nada) cujo único trabalho é
  chamar o hook useDecalTexture para UMA zona de arte e devolver o
  resultado pro componente Mug via callback. Existe porque um modelo
  pode ter várias zonas de arte (frente/verso, caneca 1/caneca 2...)
  e hooks não podem ser chamados um número variável de vezes — cada
  zona ganha sua própria instância deste componente.
*/
function ZoneTexture({
  zone,
  artZone,
  measurement,
  baseColor,
  onTexture,
}) {
  const { texture, warning } = useDecalTexture({
    artImage: artZone?.image,
    artWidthMM: artZone?.widthMM,
    artHeightMM: artZone?.heightMM,
    offsetXMM: artZone?.offsetXMM,
    offsetYMM: artZone?.offsetYMM,
    mode: zone.mode,
    radiusUnits: measurement?.radiusUnits,
    widthUnits: measurement?.widthUnits,
    heightUnits: measurement?.heightUnits,
    realHeightMM: artZone?.mugRealHeightMM,
    baseColor,
  })

  useEffect(() => {
    onTexture(zone.key, texture, warning)
  }, [zone.key, texture, warning, onTexture])

  return null
}


function Mug({
  artZones,
  partColors,
  glassOpacity,
  mugShine,
  modelId,
  magicPlaying,
  onFrame,
  onWarning,
}) {
  const config = getModel(modelId)

  const obj = useLoader(
    OBJLoader,
    modelUrl(config)
  )

  const group = useMemo(
    () => obj.clone(true),
    [obj]
  )

  /*
    Alguns .obj de origem têm faces com mais de 3 lados (quads,
    pentágonos...) em regiões curvas. O carregador as triangula de
    forma simples (leque a partir do 1º vértice), o que pode deixar
    a normal gravada no arquivo desalinhada com o triângulo real —
    isso aparece como um brilho "ruído/estático" nas peças com
    reflexo de ambiente. Corrigido juntando vértices coincidentes e
    recalculando normais limpas a partir da geometria de verdade.
  */
  useMemo(() => {
    if (!NEEDS_NORMAL_FIX.has(config.file)) return

    group.traverse((child) => {
      if (!child.isMesh) return

      try {
        const merged = mergeVertices(child.geometry, 1e-4)
        merged.computeVertexNormals()
        child.geometry.dispose()
        child.geometry = merged
      } catch (e) {
        // geometria mantida como veio, caso a mesclagem falhe
      }
    })
  }, [group, config.file])

  // { [zoneKey]: { mode, radiusUnits, widthUnits, heightUnits } }
  const [measurements, setMeasurements] =
    useState({})

  // { [zoneKey]: { texture, warning } }
  const [zoneTextures, setZoneTextures] =
    useState({})

  const groupRef = useRef(null)

  const bodyColorPart =
    config.colorParts[0]

  const bodyColorHex =
    partColors[bodyColorPart.key] ||
    bodyColorPart.default


  const handleZoneTexture = useMemo(() => {
    return (key, texture, warning) => {
      setZoneTextures((prev) => {
        const current = prev[key]

        if (
          current?.texture === texture &&
          current?.warning === warning
        ) {
          return prev
        }

        return {
          ...prev,
          [key]: { texture, warning },
        }
      })
    }
  }, [])


  useEffect(() => {
    const box =
      new THREE.Box3().setFromObject(group)

    const size = new THREE.Vector3()
    const center = new THREE.Vector3()

    box.getSize(size)
    box.getCenter(center)

    const scale =
      TARGET_HEIGHT / size.y

    group.scale.setScalar(scale)

    group.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale
    )

    onFrame?.({
      width: size.x * scale,
      height: size.y * scale,
      depth: size.z * scale,
    })
  }, [group, onFrame])


  /*
    PASSO 1 — ESTRUTURAL

    Percorre todas as peças do modelo e, para cada uma, decide o
    que ela é: oculta (pivot/decal), folha solta (papel), faixa de
    glitter, peça de cor fixa (ferragem), peça colorível (com sua
    própria cor), ou zona de arte (medida aqui, o material entra
    no passo 2 assim que a textura ficar pronta).
  */
  useEffect(() => {
    const paperMaterial =
      new THREE.MeshStandardMaterial(
        getPaperMaterialParams()
      )

    const colorMaterials = new Map()

    for (const part of config.colorParts) {
      colorMaterials.set(
        part.key,
        createColorMaterial(
          part.material,
          partColors[part.key] || part.default,
          mugShine
        )
      )
    }

    const fixedMaterials = new Map()

    for (const part of config.fixedParts || []) {
      const mat = createColorMaterial(
        part.material,
        part.color,
        mugShine
      )

      for (const name of part.meshNames) {
        fixedMaterials.set(name, mat)
      }
    }

    let glitterMaterial = null
    let glitterTexture = null

    if (config.glitterBand) {
      const glitterColorHex =
        partColors[config.glitterBand.colorKey] ||
        config.colorParts.find(
          (p) => p.key === config.glitterBand.colorKey
        )?.default ||
        '#d4af37'

      glitterTexture =
        createGlitterTexture(glitterColorHex)

      glitterMaterial =
        new THREE.MeshPhysicalMaterial({
          map: glitterTexture,
          color: new THREE.Color(0xffffff),
          metalness: 0.15,
          roughness: 0.26,
          clearcoat: 0.9,
          clearcoatRoughness: 0.12,
          envMapIntensity: 1.3,
          side: THREE.DoubleSide,
        })
    }

    const nextMeasurements = {}
    const measuredZones = new Set()

    group.traverse((child) => {
      if (!child.isMesh) return

      const rawName = child.name
      const name = baseName(rawName)

      child.castShadow = true
      child.receiveShadow = true

      // --- peças ocultas -------------------------------------
      if (name === 'pivot' || rawName === 'decal') {
        child.visible = false
        return
      }

      // --- folha solta (só existe visível em hasPaper) --------
      if (isLooseSheetName(name)) {
        if (config.hasPaper) {
          child.visible = true
          child.material = paperMaterial
        } else {
          child.visible = false
        }
        return
      }

      // --- faixa de glitter ------------------------------------
      if (
        config.glitterBand &&
        config.glitterBand.meshNames.includes(name)
      ) {
        child.visible = true
        child.material = glitterMaterial
        return
      }

      // --- zona de arte (medida agora, material no passo 2) ---
      const zone = config.printZones.find((z) =>
        z.meshNames.includes(rawName)
      )

      if (zone) {
        child.visible = true

        if (!measuredZones.has(zone.key)) {
          measuredZones.add(zone.key)

          const pos =
            child.geometry.attributes.position

          let minX = Infinity
          let maxX = -Infinity
          let minY = Infinity
          let maxY = -Infinity
          let minZ = Infinity
          let maxZ = -Infinity

          let sumX = 0
          let sumZ = 0

          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i)
            const y = pos.getY(i)
            const z = pos.getZ(i)

            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            if (z < minZ) minZ = z
            if (z > maxZ) maxZ = z

            sumX += x
            sumZ += z
          }

          const mode =
            zone.mode || PRINT_MODE.CYLINDRICAL

          if (mode === PRINT_MODE.FLAT) {
            /*
              Painel "de pé" (camiseta/almofada/azulejo: a face olha
              para Z, largura=X, altura=Y) ou "deitado" (mousepad: a
              face olha para cima, largura=X, altura=Z). O eixo mais
              fino é a espessura da peça — os outros dois viram
              largura/altura.
            */
            const rangeX = maxX - minX
            const rangeY = maxY - minY
            const rangeZ = maxZ - minZ

            if (rangeY <= rangeX && rangeY <= rangeZ) {
              nextMeasurements[zone.key] = {
                mode,
                widthUnits: rangeX,
                heightUnits: rangeZ,
              }
            } else if (rangeZ <= rangeX && rangeZ <= rangeY) {
              nextMeasurements[zone.key] = {
                mode,
                widthUnits: rangeX,
                heightUnits: rangeY,
              }
            } else {
              nextMeasurements[zone.key] = {
                mode,
                widthUnits: rangeZ,
                heightUnits: rangeY,
              }
            }
          } else {
            const centerX = sumX / pos.count
            const centerZ = sumZ / pos.count

            let rSum = 0

            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i) - centerX
              const z = pos.getZ(i) - centerZ
              rSum += Math.hypot(x, z)
            }

            nextMeasurements[zone.key] = {
              mode,
              radiusUnits: rSum / pos.count,
              heightUnits: maxY - minY,
            }
          }
        }

        return
      }

      // --- peça de cor fixa (ferragem) ------------------------
      if (fixedMaterials.has(name)) {
        child.visible = true
        child.material = fixedMaterials.get(name)
        return
      }

      // --- peça colorível --------------------------------------
      const colorPart = config.colorParts.find(
        (p) => p.key !== 'body' && p.meshNames.includes(name)
      )

      child.visible = true
      child.material = colorMaterials.get(
        colorPart ? colorPart.key : 'body'
      )
    })

    setMeasurements((prev) => {
      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(nextMeasurements)

      const same =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((k) => {
          const a = prev[k]
          const b = nextMeasurements[k]
          return (
            a &&
            a.mode === b.mode &&
            a.radiusUnits === b.radiusUnits &&
            a.widthUnits === b.widthUnits &&
            a.heightUnits === b.heightUnits
          )
        })

      return same ? prev : nextMeasurements
    })

    /*
      TRANSPARÊNCIA (vidro)

      Aplicada por cima do material já criado para a colorPart
      indicada em config.glassOpacity — não muda a peça impressa
      (a arte continua opaca e legível, ver getPrintMaterialParams).
    */
    if (config.glassOpacity) {
      const mat = colorMaterials.get(
        config.glassOpacity.key
      )

      if (mat) {
        const amount = Math.max(
          0,
          Math.min(1, Number(glassOpacity ?? config.glassOpacity.default))
        )

        mat.transmission = amount * 0.95
        mat.transparent = true
        mat.opacity = 1
        mat.needsUpdate = true
      }
    }

    return () => {
      paperMaterial.dispose()
      colorMaterials.forEach((m) => m.dispose())
      fixedMaterials.forEach((m) => m.dispose())

      if (glitterMaterial) glitterMaterial.dispose()
      if (glitterTexture) glitterTexture.dispose()
    }

  }, [
    group,
    config,
    mugShine,
    partColors,
    glassOpacity,
  ])


  /*
    PASSO 2 — TEXTURA DE CADA ZONA

    Um <ZoneTexture> "invisível" por zona de arte, que devolve a
    textura pronta (ou o aviso de largura excedida) pro estado
    zoneTextures assim que estiver disponível.
  */
  const zoneNodes = config.printZones.map((zone) => (
    <ZoneTexture
      key={zone.key}
      zone={zone}
      artZone={artZones[zone.key]}
      measurement={measurements[zone.key]}
      baseColor={bodyColorHex}
      onTexture={handleZoneTexture}
    />
  ))


  useEffect(() => {
    const messages = config.printZones
      .map((zone) => {
        const w = zoneTextures[zone.key]?.warning
        return w ? `${zone.label}: ${w}` : null
      })
      .filter(Boolean)

    onWarning?.(messages.length ? messages.join(' | ') : null)
  }, [zoneTextures, config, onWarning])


  const magicOverlaysRef = useRef([])

  useEffect(() => {
    const printMaterialKind =
      bodyColorPart.material

    /*
      Quando a peça tem controle de transparência (vidro), a arte
      também deve ficar transparente — não faz sentido a arte ficar
      opaca "flutuando" sobre um copo transparente. Nesse caso usamos
      os parâmetros de vidro de verdade (não o substituto opaco) e
      aplicamos a mesma quantidade de transmissão escolhida no slider.
    */
    /*
      IMPORTANTE: "transmission" (vidro de verdade, com refração) é
      pesado — exige um passe de render extra por objeto. O corpo já
      usa 1 objeto transmissivo (abaixo). Se a arte também usasse
      transmission, seriam 2 objetos transmissivos na mesma peça, o
      que derruba a taxa de quadros (e pode travar em aparelhos mais
      fracos). Por isso a arte simula a transparência com opacidade
      simples — visualmente também fica "ver através", só que leve.
    */
    const printParams = config.glassOpacity
      ? { ...getMaterialParams(printMaterialKind, mugShine), transmission: 0 }
      : getPrintMaterialParams(printMaterialKind, mugShine)

    const opacityAmount = config.glassOpacity
      ? Math.max(
          0,
          Math.min(1, Number(glassOpacity ?? config.glassOpacity.default))
        )
      : null

    const zoneMaterials = new Map()

    for (const zone of config.printZones) {
      const entry = zoneTextures[zone.key]
      if (!entry?.texture) continue

      const mat = new THREE.MeshPhysicalMaterial({
        map: entry.texture,
        color: new THREE.Color(0xffffff),
        ...printParams,
        side: THREE.DoubleSide,
      })

      if (opacityAmount !== null) {
        mat.transparent = true
        mat.opacity = Math.max(0.35, 1 - opacityAmount * 0.85)
      }

      zoneMaterials.set(zone.key, mat)
    }

    /*
      TEXTURA/ARTE DA FOLHA SOLTA (trioPaper)

      Espelha a mesma arte de uma das zonas (config.paperFromZone),
      totalmente fosca, sem alterar a cor.
    */
    let paperTexture = null
    let paperPrintMaterial = null

    if (config.hasPaper && config.paperFromZone) {
      const sourceTexture =
        zoneTextures[config.paperFromZone]?.texture

      if (sourceTexture) {
        paperTexture = createPaperTexture(sourceTexture)

        paperPrintMaterial = new THREE.MeshBasicMaterial({
          map: paperTexture,
          color: new THREE.Color(0xffffff),
          side: THREE.DoubleSide,
        })
      }
    }

    /*
      EFEITO "CANECA MÁGICA"

      Em vez de aplicar a arte diretamente na peça, cria uma CÓPIA
      transparente por cima dela (mesma geometria, mesma posição) e
      anima a opacidade dessa cópia entre 0 e 1 — a peça original
      (opaca, na cor "Corpo" escolhida, normalmente preta) some e
      aparece por baixo, simulando a mudança térmica real do produto.
    */
    const magicOverlays = []

    const bodyBlackMaterial = config.magicAnimation
      ? new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(
            partColors[bodyColorPart.key] || bodyColorPart.default
          ),
          ...getMaterialParams(bodyColorPart.material, mugShine),
          side: THREE.DoubleSide,
        })
      : null

    group.traverse((child) => {
      if (!child.isMesh) return

      const rawName = child.name
      const name = baseName(rawName)

      const zone = config.printZones.find((z) =>
        z.meshNames.includes(rawName)
      )

      if (zone) {
        const mat = zoneMaterials.get(zone.key)
        if (!mat) return

        if (config.magicAnimation) {
          // peça original: opaca, cor "Corpo" (preta por padrão)
          child.material = bodyBlackMaterial
          child.material.needsUpdate = true

          // cópia transparente por cima, com a arte
          const overlay = new THREE.Mesh(child.geometry, mat.clone())
          overlay.material.transparent = true
          overlay.material.depthWrite = false
          overlay.material.opacity = 0
          overlay.renderOrder = 1
          overlay.position.copy(child.position)
          overlay.rotation.copy(child.rotation)
          overlay.scale.copy(child.scale)
          overlay.castShadow = false
          overlay.receiveShadow = false

          child.parent.add(overlay)
          magicOverlays.push(overlay)
        } else {
          child.material = mat
          child.material.needsUpdate = true
        }

        return
      }

      if (
        config.hasPaper &&
        paperPrintMaterial &&
        isLooseSheetName(name)
      ) {
        child.material = paperPrintMaterial
        child.material.needsUpdate = true
      }
    })

    magicOverlaysRef.current = magicOverlays

    return () => {
      magicOverlaysRef.current = []

      magicOverlays.forEach((overlay) => {
        overlay.parent?.remove(overlay)
        overlay.material.dispose()
      })

      if (bodyBlackMaterial) bodyBlackMaterial.dispose()

      zoneMaterials.forEach((m) => m.dispose())

      if (paperPrintMaterial) paperPrintMaterial.dispose()
      if (paperTexture) paperTexture.dispose()
    }

  }, [
    group,
    zoneTextures,
    config,
    mugShine,
    bodyColorPart,
    partColors,
    glassOpacity,
  ])


  /*
    Avança o crossfade preto ⇄ arte da caneca mágica a cada quadro,
    só quando o usuário clicou em "reproduzir" (magicPlaying). As
    duas canecas do kit animam exatamente juntas (mesma fase).
    Enquanto pausado, fica parado na caneca preta.
  */
  useFrame(({ clock }) => {
    if (!config.magicAnimation) return

    const overlays = magicOverlaysRef.current
    if (!overlays.length) return

    if (!magicPlaying) {
      overlays.forEach((overlay) => {
        overlay.material.opacity = 0
      })
      return
    }

    const t =
      (Math.sin(clock.elapsedTime * 0.7) + 1) / 2

    overlays.forEach((overlay) => {
      overlay.material.opacity = t
    })
  })


  return (
    <>
      <primitive
        ref={groupRef}
        object={group}
      />

      {zoneNodes}
    </>
  )
}


function CameraRig({ frame }) {
  const {
    camera,
    size,
    controls,
  } = useThree()


  useEffect(() => {
    if (!frame) return

    const fovRad =
      (
        camera.fov *
        Math.PI
      ) / 180

    const aspect =
      size.width / size.height

    const distForHeight =
      frame.height /
      2 /
      Math.tan(fovRad / 2)

    const distForWidth =
      frame.width /
      2 /
      (
        Math.tan(fovRad / 2) *
        aspect
      )

    const distance =
      Math.max(
        distForHeight,
        distForWidth
      ) * 1.4


    const target =
      new THREE.Vector3(
        0,
        frame.height / 2,
        0
      )

    const dir =
      new THREE.Vector3(
        0.85,
        0.55,
        1
      ).normalize()


    camera.position.copy(
      dir
        .multiplyScalar(distance)
        .add(target)
    )

    camera.near =
      Math.max(
        0.01,
        distance / 100
      )

    camera.far =
      distance * 20

    camera.lookAt(target)

    camera.updateProjectionMatrix()


    if (controls) {
      controls.target.copy(target)

      controls.minDistance =
        distance * 0.45

      /*
        NOVO:
        Zoom out mais generoso, para dar mais
        espaço de composição/enquadramento.
      */
      controls.maxDistance =
        distance * 4.5

      controls.update()
    }

    /*
      BUGFIX:
      Esse efeito reposiciona a câmera para o
      enquadramento padrão. Antes, ele também rodava
      de novo sempre que "size" (tamanho do canvas)
      mudava — e no celular, rolar a página esconde/
      mostra a barra de endereço do navegador, o que
      dispara um resize do canvas e resetava qualquer
      ajuste manual que o usuário tivesse feito na
      posição da caneca.

      Agora o reposicionamento só acontece quando
      "frame" muda de verdade (ou seja, quando o
      modelo de caneca é trocado). camera/size/controls
      continuam sendo lidos normalmente aqui dentro,
      só não fazem o efeito rodar de novo sozinhos.
    */
  }, [frame]) // eslint-disable-line react-hooks/exhaustive-deps


  return null
}


function CaptureRig({
  registerApi,
  spinTargetRef,
  videoSpeed = 1,
  videoEffect = 'mug',
  videoQuality = 'standard',
}) {
  const {
    gl,
    scene,
    camera,
    size,
    controls,
  } = useThree()

  const recordingRef = useRef(false)
  const animationProgressRef = useRef(0)
  const recordingDurationRef = useRef(ROTATE_SECONDS)

  const initialRotationRef = useRef(0)
  const initialCameraPositionRef = useRef(
    new THREE.Vector3()
  )
  const initialCameraTargetRef = useRef(
    new THREE.Vector3()
  )

  useFrame((_, delta) => {
    if (!recordingRef.current) return

    const speed =
      Number(videoSpeed) || 1

    const duration =
      recordingDurationRef.current

    animationProgressRef.current +=
      (delta * speed) / duration

    const progress =
      Math.min(
        1,
        animationProgressRef.current
      )

    const startRotation =
      initialRotationRef.current

    const startCamera =
      initialCameraPositionRef.current

    const target =
      initialCameraTargetRef.current

    if (
      videoEffect === 'mug' &&
      spinTargetRef.current
    ) {
      spinTargetRef.current.rotation.y =
        startRotation +
        progress * Math.PI * 2
    }

    if (
      videoEffect === 'zoom'
    ) {
      const zoomAmount =
        0.18 *
        Math.sin(progress * Math.PI)

      camera.position
        .copy(startCamera)
        .sub(target)
        .multiplyScalar(1 - zoomAmount)
        .add(target)

      camera.lookAt(target)
    }

    if (
      videoEffect === 'camera-up'
    ) {
      const offset =
        startCamera.clone().sub(target)

      const horizontalRadius =
        Math.sqrt(
          offset.x * offset.x +
          offset.z * offset.z
        )

      const startAngle =
        Math.atan2(
          offset.z,
          offset.x
        )

      const angle =
        startAngle +
        progress * Math.PI * 2

      /*
        Começa bem abaixo da caneca
        e termina acima dela.
      */
      const startHeight =
        target.y -
        horizontalRadius * 0.75

      const endHeight =
        target.y +
        horizontalRadius * 0.75

      const height =
        startHeight +
        (endHeight - startHeight) *
          progress

      const radius =
        horizontalRadius *
        (0.82 + progress * 0.18)

      /*
        A caneca também gira junto
        com o movimento da câmera.
      */
      if (spinTargetRef.current) {
        spinTargetRef.current.rotation.y =
          startRotation +
          progress * Math.PI * 2
      }

      camera.position.set(
        target.x +
          Math.cos(angle) * radius,

        height,

        target.z +
          Math.sin(angle) * radius
      )

      camera.lookAt(target)
    }

    if (
      videoEffect === 'camera-spin'
    ) {
      const offset =
        startCamera.clone()
          .sub(target)

      const angle =
        progress * Math.PI * 2

      const rotated =
        offset.clone()

      rotated.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        angle
      )

      camera.position
        .copy(target)
        .add(rotated)

      camera.lookAt(target)
    }

    if (
      videoEffect === 'zoom-mug'
    ) {
      if (spinTargetRef.current) {
        spinTargetRef.current.rotation.y =
          startRotation +
          progress * Math.PI * 2
      }

      const zoomAmount =
        0.14 *
        Math.sin(progress * Math.PI)

      camera.position
        .copy(startCamera)
        .sub(target)
        .multiplyScalar(1 - zoomAmount)
        .add(target)

      camera.lookAt(target)
    }

    camera.updateMatrixWorld()
  })

  useEffect(() => {
    registerApi({

      screenshot: (options = {}) => {
        const {
          multiplier = 3,
          transparent = false,
          format = null,
          backgroundOptions = null,
          cropOffsetXFrac = 0.5,
          cropOffsetYFrac = 0.5,
        } = options

        const prevRatio =
          gl.getPixelRatio()

        const prevBackground =
          scene.background

        const prevClearColor =
          new THREE.Color()

        gl.getClearColor(
          prevClearColor
        )

        const prevClearAlpha =
          gl.getClearAlpha()

        const targetRatio =
          Math.min(
            4,
            prevRatio * multiplier
          )

        gl.setPixelRatio(
          targetRatio
        )

        gl.setSize(
          size.width,
          size.height,
          false
        )

        const useBackgroundLayer =
          !!backgroundOptions &&
          !transparent

        if (
          transparent ||
          useBackgroundLayer
        ) {
          scene.background = null
          gl.setClearColor(
            0x000000,
            0
          )
        }

        gl.render(
          scene,
          camera
        )

        const sourceCanvas =
          gl.domElement

        const sw =
          sourceCanvas.width

        const sh =
          sourceCanvas.height

        const outputWidth =
          format
            ? format.width
            : sw

        const outputHeight =
          format
            ? format.height
            : sh

        const targetAspect =
          outputWidth /
          outputHeight

        const {
          cropW,
          cropH,
          cropX,
          cropY,
        } = computeCoverCrop(
          sw,
          sh,
          targetAspect,
          cropOffsetXFrac,
          cropOffsetYFrac
        )

        const output =
          document.createElement(
            'canvas'
          )

        output.width =
          outputWidth

        output.height =
          outputHeight

        const octx =
          output.getContext('2d')

        if (useBackgroundLayer) {
          const bgLayer =
            document.createElement(
              'canvas'
            )

          bgLayer.width = sw
          bgLayer.height = sh

          const bctx =
            bgLayer.getContext('2d')

          const layout =
            getImageLayout(
              backgroundOptions.naturalWidth,
              backgroundOptions.naturalHeight,
              sw,
              sh,
              backgroundOptions.fit,
              backgroundOptions.zoom,
              backgroundOptions.offsetXFrac,
              backgroundOptions.offsetYFrac
            )

          bctx.drawImage(
            backgroundOptions.image,
            layout.x,
            layout.y,
            layout.drawW,
            layout.drawH
          )

          octx.drawImage(
            bgLayer,
            cropX,
            cropY,
            cropW,
            cropH,
            0,
            0,
            outputWidth,
            outputHeight
          )
        }

        octx.drawImage(
          sourceCanvas,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          outputWidth,
          outputHeight
        )

        const dataUrl =
          output.toDataURL(
            'image/png',
            1.0
          )

        if (
          transparent ||
          useBackgroundLayer
        ) {
          scene.background =
            prevBackground

          gl.setClearColor(
            prevClearColor,
            prevClearAlpha
          )
        }

        gl.setPixelRatio(
          prevRatio
        )

        gl.setSize(
          size.width,
          size.height,
          false
        )

        gl.render(
          scene,
          camera
        )

        return dataUrl
      },

      startRecording: (
        onDone,
        options = {}
      ) => {
        const {
          format = null,
          backgroundOptions = null,
          cropOffsetXFrac = 0.5,
          cropOffsetYFrac = 0.5,
          speed = videoSpeed,
          effect = videoEffect,
          quality = videoQuality,
        } = options

        const qualityLongSide =
        quality === 'low'
          ? 640
          : quality === 'high'
            ? 1920
            : 1280
      
      const canvas =
        gl.domElement
      
      const previousPixelRatio =
        gl.getPixelRatio()
      
      const previousCanvasWidth =
        canvas.width
      
      const previousCanvasHeight =
        canvas.height
      
      /*
        Renderiza o Three.js em resolução real de
        exportação, e não apenas no tamanho visual
        do viewport.
      */
      let outputWidth
      let outputHeight
      
      if (format) {
        const aspect =
          format.width /
          format.height
      
        if (format.width >= format.height) {
          outputWidth =
            quality === 'high'
              ? 1920
              : quality === 'standard'
                ? 1280
                : 640
      
          outputHeight =
            Math.round(
              outputWidth / aspect
            )
        } else {
          outputHeight =
            quality === 'high'
              ? 1920
              : quality === 'standard'
                ? 1280
                : 640
      
          outputWidth =
            Math.round(
              outputHeight * aspect
            )
        }
      } else {
        const aspect =
          size.width / size.height
      
        if (size.width >= size.height) {
          outputWidth =
            qualityLongSide
      
          outputHeight =
            Math.round(
              outputWidth / aspect
            )
        } else {
          outputHeight =
            qualityLongSide
      
          outputWidth =
            Math.round(
              outputHeight * aspect
            )
        }
      }
      
      /*
        O canvas WebGL passa a ter exatamente a
        resolução necessária para a gravação.
      */
      const targetPixelRatio =
        Math.max(
          1,
          outputHeight / size.height,
          outputWidth / size.width
        )
      
      gl.setPixelRatio(
        targetPixelRatio
      )
      
      gl.setSize(
        size.width,
        size.height,
        false
      )
      
      const needsComposite = true

        let streamSource = canvas
        let compositeCanvas = null
        let compositeCtx = null
        let compositeRafId = null
        let bgLayerCanvas = null

        if (needsComposite) {
          compositeCanvas =
            document.createElement(
              'canvas'
            )

          compositeCanvas.width =
            outputWidth

          compositeCanvas.height =
            outputHeight

          compositeCtx =
            compositeCanvas.getContext(
              '2d'
            )

          streamSource =
            compositeCanvas
        }

        const prevBackground =
          scene.background

        const prevClearColor =
          new THREE.Color()

        gl.getClearColor(
          prevClearColor
        )

        const prevClearAlpha =
          gl.getClearAlpha()

        if (backgroundOptions) {
          scene.background = null
          gl.setClearColor(
            0x000000,
            0
          )
        }

        const restoreBackground = () => {
          if (backgroundOptions) {
            scene.background =
              prevBackground

            gl.setClearColor(
              prevClearColor,
              prevClearAlpha
            )
          }
        }

        if (
          !streamSource.captureStream
        ) {
          restoreBackground()

          onDone(
            null,
            null,
            'Seu navegador não suporta gravação de vídeo.'
          )

          return
        }

        const stream =
        streamSource.captureStream(30)
      
      const videoTrack =
        stream.getVideoTracks()[0]
      
      if (videoTrack) {
        videoTrack.contentHint =
          'detail'
      }

        const candidates = [
          'video/mp4;codecs=avc1.42E01E',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm',
        ]

        const mimeType =
          candidates.find(
            (m) =>
              window.MediaRecorder &&
              MediaRecorder.isTypeSupported(m)
          )

        if (!window.MediaRecorder) {
          restoreBackground()

          onDone(
            null,
            null,
            'MediaRecorder não é suportado neste navegador.'
          )

          return
        }

const videoBitsPerSecond =
  quality === 'low'
    ? 5_000_000
    : quality === 'high'
      ? 24_000_000
      : 12_000_000

const recorderOptions = {
  videoBitsPerSecond,
}

if (mimeType) {
  recorderOptions.mimeType =
    mimeType
}

const recorder =
  new MediaRecorder(
    stream,
    recorderOptions
  )


        const chunks = []

        /*
          IMPORTANTE:
          salva exatamente a posição atual
          antes da gravação.
        */
        const savedRotation =
          spinTargetRef.current
            ? spinTargetRef.current.rotation.y
            : 0

        const savedCameraPosition =
          camera.position.clone()

        const savedCameraTarget =
          controls
            ? controls.target.clone()
            : new THREE.Vector3(
                0,
                0,
                0
              )

        initialRotationRef.current =
          savedRotation

        initialCameraPositionRef.current =
          savedCameraPosition

        initialCameraTargetRef.current =
          savedCameraTarget

        const normalizedSpeed =
          [0.5, 1, 2].includes(
            Number(speed)
          )
            ? Number(speed)
            : 1

        recordingDurationRef.current =
          ROTATE_SECONDS /
          normalizedSpeed

        animationProgressRef.current =
          0

        recorder.ondataavailable =
          (e) => {
            if (
              e.data &&
              e.data.size
            ) {
              chunks.push(
                e.data
              )
            }
          }

        const stopCompositeLoop = () => {
          if (compositeRafId) {
            cancelAnimationFrame(
              compositeRafId
            )

            compositeRafId = null
          }
        }

        recorder.onstop = () => {
          recordingRef.current =
            false

          stopCompositeLoop()
          restoreBackground()

          /*
            Restaura exatamente a posição
            que o usuário tinha antes.
          */
          if (
            spinTargetRef.current
          ) {
            spinTargetRef.current.rotation.y =
              savedRotation
          }

          camera.position.copy(
            savedCameraPosition
          )

          camera.lookAt(
            savedCameraTarget
          )

          if (controls) {
            controls.target.copy(
              savedCameraTarget
            )

            controls.update()
          }

          camera.updateProjectionMatrix()
          gl.setPixelRatio(
            previousPixelRatio
          )
          
          gl.setSize(
            size.width,
            size.height,
            false
          )
          
          const blob =
            new Blob(
              chunks,
              {
                type:
                  mimeType ||
                  'video/webm',
              }
            )

          onDone(
            blob,
            mimeType,
            null
          )
        }

        recordingRef.current =
          true

        /*
          NÃO existe mais:
          rotation.y = 0

          O vídeo começa exatamente
          do enquadramento atual.
        */

          if (needsComposite) {
            const targetAspect =
              outputWidth /
              outputHeight
          
            const drawFrame = () => {
              const sw =
                canvas.width
          
              const sh =
                canvas.height
          
              if (sw && sh) {
                const {
                  cropW,
                  cropH,
                  cropX,
                  cropY,
                } = computeCoverCrop(
                  sw,
                  sh,
                  targetAspect,
                  cropOffsetXFrac,
                  cropOffsetYFrac
                )
          
                /*
                  Limpa SEMPRE o frame anterior.
                  Isso evita resíduos e mistura de
                  frames durante a gravação.
                */
                compositeCtx.clearRect(
                  0,
                  0,
                  outputWidth,
                  outputHeight
                )
          
                /*
                  FUNDO
                */
                if (backgroundOptions) {
                  if (
                    !bgLayerCanvas ||
                    bgLayerCanvas.width !== sw ||
                    bgLayerCanvas.height !== sh
                  ) {
                    bgLayerCanvas =
                      document.createElement(
                        'canvas'
                      )
          
                    bgLayerCanvas.width =
                      sw
          
                    bgLayerCanvas.height =
                      sh
          
                    const bctx =
                      bgLayerCanvas.getContext(
                        '2d'
                      )
          
                    const layout =
                      getImageLayout(
                        backgroundOptions.naturalWidth,
                        backgroundOptions.naturalHeight,
                        sw,
                        sh,
                        backgroundOptions.fit,
                        backgroundOptions.zoom,
                        backgroundOptions.offsetXFrac,
                        backgroundOptions.offsetYFrac
                      )
          
                    bctx.drawImage(
                      backgroundOptions.image,
                      layout.x,
                      layout.y,
                      layout.drawW,
                      layout.drawH
                    )
                  }
          
                  compositeCtx.drawImage(
                    bgLayerCanvas,
                    cropX,
                    cropY,
                    cropW,
                    cropH,
                    0,
                    0,
                    outputWidth,
                    outputHeight
                  )
                }
          
                /*
                  CANECA / THREE.JS
                */
                compositeCtx.drawImage(
                  canvas,
                  cropX,
                  cropY,
                  cropW,
                  cropH,
                  0,
                  0,
                  outputWidth,
                  outputHeight
                )
              }
          
              compositeRafId =
                requestAnimationFrame(
                  drawFrame
                )
            }
          
            drawFrame()
          }
        
          recorder.start()

        setTimeout(
          () => recorder.stop(),
          recordingDurationRef.current *
            1000
        )
      },
    })
  }, [
    registerApi,
    gl,
    scene,
    camera,
    size,
    controls,
    spinTargetRef,
    videoSpeed,
    videoEffect,
    videoQuality,
  ])

  return null
}

export default function MugScene({
  artZones,
  background,
  partColors,
  glassOpacity,
  mugShine,
  modelId,
  magicPlaying,
  registerApi,
  spinTargetRef,
  videoSpeed,
  videoEffect,
  videoQuality,
  onWarning,
}) {
  const [frame, setFrame] =
    useState(null)

  /*
    IMPORTANTE:
    Esses objetos precisam ser memoizados (criados
    apenas uma vez). Se fossem literais recriados a
    cada render, o react-three-fiber reaplicaria a
    configuracao inicial da camera sempre que
    qualquer estado do App mudasse (ex: trocar o
    formato de exportacao, a qualidade do video,
    etc.), resetando a posicao/zoom que o usuario
    ja tinha ajustado manualmente no viewport.
  */
  const initialCamera = useMemo(
    () => ({
      position: [
        2.7,
        1.8,
        3.0,
      ],
      fov: 30,
    }),
    []
  )

  const glConfig = useMemo(
    () => ({
      toneMapping:
        THREE.ACESFilmicToneMapping,

      toneMappingExposure: 1.1,

      preserveDrawingBuffer: true,

      alpha: true,

      premultipliedAlpha: false,

      antialias: true,

      powerPreference: 'high-performance',
    }),
    []
  )


  return (
<Canvas
  shadows
  dpr={[1, 2]}
  style={{
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 2,
    background: 'transparent',
  }}
  camera={initialCamera}
  gl={glConfig}
    >

      <SceneBackground
        background={background}
      />

      <ambientLight
        intensity={0.55}
      />

      <directionalLight
        position={[3, 5, 2]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={1.5}
        shadow-camera-bottom={-1.5}
      />

      <directionalLight
        position={[-3, 2, -2]}
        intensity={0.5}
      />

      <StudioEnvironment />

      <group
        ref={spinTargetRef}
      >

        <Mug
          artZones={artZones}
          partColors={partColors}
          glassOpacity={glassOpacity}
          mugShine={mugShine}
          modelId={modelId}
          magicPlaying={magicPlaying}
          onFrame={setFrame}
          onWarning={onWarning}
        />

      </group>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.55}
        scale={
          Math.max(
            4,
            (
              frame?.width ||
              2
            ) * 1.6
          )
        }
        blur={2.4}
        far={1.2}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minPolarAngle={
          Math.PI / 6
        }
        maxPolarAngle={
          Math.PI / 1.7
        }
      />

      <CameraRig
        frame={frame}
      />

<CaptureRig
  registerApi={registerApi}
  spinTargetRef={spinTargetRef}
  videoSpeed={videoSpeed}
  videoEffect={videoEffect}
  videoQuality={videoQuality}
/>

    </Canvas>
  )
}

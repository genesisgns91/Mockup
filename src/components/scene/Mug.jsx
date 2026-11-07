import { useEffect, useMemo, useRef, useState } from 'react'
import { useLoader, useFrame } from '@react-three/fiber'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import { useDecalTexture } from '../../hooks/useDecalTexture.js'
import { PRINT_MODE, getModel } from '../../config/models.js'
import { TARGET_HEIGHT, NEEDS_NORMAL_FIX, modelUrl, baseName, isLooseSheetName } from './constants.js'
import { getMaterialParams, getPrintMaterialParams, getPaperMaterialParams, createPaperTexture, createColorMaterial, createGlitterTexture } from './materials.js'


/*
  Componente "invisível" (não desenha nada) cujo único trabalho é
  chamar o hook useDecalTexture para UMA zona de arte e devolver o
  resultado pro componente Mug via callback. Existe porque um modelo
  pode ter várias zonas de arte (frente/verso, caneca 1/caneca 2...)
  e hooks não podem ser chamados um número variável de vezes — cada
  zona ganha sua própria instância deste componente.
*/
export function ZoneTexture({
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

export function Mug({
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
      } catch {
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

      Usa opacidade direta (transparent+opacity) em vez de
      "transmission" físico: o transmission depende de um passe de
      render extra (capturar o que está atrás do objeto) que nem
      sempre aparece de forma visível dependendo do fundo da cena —
      opacidade dá um efeito "vidro" sempre visível e mais leve.
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

        mat.transmission = 0
        mat.transparent = true
        mat.opacity = Math.max(0.08, 1 - amount)
        mat.depthWrite = amount > 0.4 ? false : true
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

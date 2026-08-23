import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Canvas,
  useThree,
  useLoader,
  useFrame,
} from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  ContactShadows,
} from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import * as THREE from 'three'
import { useDecalTexture } from '../hooks/useDecalTexture.js'
import {
  getImageLayout,
  computeCoverCrop,
} from '../utils/exportLayout.js'
import { MATERIAL, PRINT_MODE, getModel } from '../config/models.js'


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


function Mug({
  art,
  mugColors,
  mugShine,
  modelId,
  onFrame,
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

  const [measurements, setMeasurements] =
    useState(null)

  const groupRef = useRef(null)


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


  useEffect(() => {
    const bodyParams = {
      ...getMaterialParams(config.material, mugShine),
      ...(config.materialBoost || {}),
    }

    const neutralParams =
      getMaterialParams(config.material, mugShine)


    const bodyMaterial =
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(mugColors.body),
        ...bodyParams,
        side: THREE.DoubleSide,
      })


    const insideMaterial =
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(mugColors.inside),
        ...neutralParams,
        side: THREE.DoubleSide,
      })


    const handleMaterial =
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(mugColors.handle),
        ...neutralParams,
        side: THREE.DoubleSide,
      })


    const paperMaterial =
      new THREE.MeshStandardMaterial(
        getPaperMaterialParams()
      )

    /*
      Materiais de "peças especiais" (metal, plástico, vidro, espuma...)
      declarados em config.partOverrides. Criados sob demanda e
      reaproveitados entre peças do mesmo tipo dentro do mesmo modelo.
    */
    const overrideMaterials = new Map()

    function getOverrideMaterial(materialKind) {
      if (!overrideMaterials.has(materialKind)) {
        overrideMaterials.set(
          materialKind,
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(mugColors.body),
            ...getMaterialParams(materialKind, mugShine),
            side: THREE.DoubleSide,
          })
        )
      }

      return overrideMaterials.get(materialKind)
    }


    const printTargets = config.printTargets || null

    let printRadiusUnits = null
    let printHeightUnits = null
    let printWidthUnits = null


    group.traverse((child) => {
      if (!child.isMesh) return

      const name =
        baseName(child.name)

      const override =
        config.partOverrides?.[name]


      if (name === 'pivot' || override === MATERIAL.HIDDEN) {
        child.visible = false
        return
      }


      child.castShadow = true
      child.receiveShadow = true


      if (name === 'decal') {
        child.visible = false
        return
      }


      const isLooseSheet =
        isLooseSheetName(name)

      if (isLooseSheet) {
        /*
          Folha solta (só existe visualmente em modelos com "hasPaper",
          ex: trioPaper). Nos demais modelos que compartilham o mesmo
          .obj de base, ela fica escondida.
        */
        if (config.hasPaper) {
          child.visible = true
          child.material = paperMaterial
        } else {
          child.visible = false
        }
        return
      }


      const isPrintTarget =
        printTargets
          ? printTargets.includes(name)
          : isPrintPartName(name)

      if (isPrintTarget) {
        /*
          ÁREA DE IMPRESSÃO

          Medida uma única vez (na primeira peça encontrada) e reusada
          para as demais cópias do mesmo tipo (ex: as 3 canecas do trio).
        */
        if (printHeightUnits === null) {
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


          if (config.printMode === PRINT_MODE.FLAT) {
            /*
              Peça "plana" pode estar de pé (camiseta, almofada, azulejo
              — a face olha para o eixo Z, então a largura vem de X e a
              altura de Y) OU deitada (mousepad — a face olha para cima,
              eixo Y, então a largura vem de X e a "altura" (a outra
              direção da estampa) vem de Z). Detectamos automaticamente
              qual é o eixo "fino" (a espessura da peça) e usamos os
              outros dois como largura/altura, para nunca dividir por
              uma variação quase zero.
            */
            const rangeX = maxX - minX
            const rangeY = maxY - minY
            const rangeZ = maxZ - minZ

            if (rangeY <= rangeX && rangeY <= rangeZ) {
              // eixo fino = Y (peça deitada, ex: mousepad)
              printWidthUnits = rangeX
              printHeightUnits = rangeZ
            } else if (rangeZ <= rangeX && rangeZ <= rangeY) {
              // eixo fino = Z (peça de pé, ex: camiseta/almofada/azulejo)
              printWidthUnits = rangeX
              printHeightUnits = rangeY
            } else {
              // eixo fino = X (raro)
              printWidthUnits = rangeZ
              printHeightUnits = rangeY
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

            printRadiusUnits = rSum / pos.count
            printHeightUnits = maxY - minY
          }
        }

        return
      }


      if (override) {
        child.material =
          getOverrideMaterial(override)

        return
      }


      /*
        endsWith (em vez de ===) para também cobrir nomes compostos
        como "heart_mug_inside" / "mug_handle" (ex: caneca casal),
        sem confundir com peças tipo "handle_chrome" ou
        "handle_support" (que não TERMINAM em handle/inside).
      */
      if (name.endsWith('inside') || name.includes('interior')) {
        child.material = insideMaterial
        return
      }


      if (name.endsWith('handle')) {
        child.material = handleMaterial
        return
      }


      child.material = bodyMaterial
    })


    if (printHeightUnits !== null) {
      setMeasurements({
        mode: config.printMode,
        radiusUnits: printRadiusUnits,
        widthUnits: printWidthUnits,
        heightUnits: printHeightUnits,
      })
    } else {
      setMeasurements(null)
    }


    return () => {
      bodyMaterial.dispose()
      insideMaterial.dispose()
      handleMaterial.dispose()
      paperMaterial.dispose()

      overrideMaterials.forEach((m) => m.dispose())
    }

  }, [
    group,
    config,
    mugShine,
    mugColors.body,
    mugColors.inside,
    mugColors.handle,
  ])


  const {
    texture,
    warning,
  } = useDecalTexture({
    artImage: art.image,
    artWidthMM: art.widthMM,
    artHeightMM: art.heightMM,
    offsetXMM: art.offsetXMM,
    offsetYMM: art.offsetYMM,
    mode: measurements?.mode || config.printMode,
    radiusUnits: measurements?.radiusUnits,
    widthUnits: measurements?.widthUnits,
    heightUnits: measurements?.heightUnits,
    realHeightMM: art.mugRealHeightMM,
    baseColor: mugColors.body,
  })


  useEffect(() => {
    art.onWarning?.(warning)
  }, [warning, art])


  useEffect(() => {
    if (!texture) return

    const printParams =
      getPrintMaterialParams(
        config.material,
        mugShine
      )

    /*
      ARTE DA PEÇA
    */
    const printMaterial =
      new THREE.MeshPhysicalMaterial({
        map: texture,
        color: new THREE.Color(0xffffff),
        ...printParams,
        side: THREE.DoubleSide,
      })


    /*
      TEXTURA DA FOLHA

      Cópia independente,
      mantendo as cores originais.
    */
    const paperTexture =
      createPaperTexture(texture)


    /*
      ARTE DA FOLHA

      Totalmente fosca.
      Sem emissive.
      Sem alteração de brilho.
      Sem alteração de cor.
    */
    const paperPrintMaterial =
      new THREE.MeshBasicMaterial({
        map: paperTexture,
        color: new THREE.Color(0xffffff),
        side: THREE.DoubleSide,
      })


    const printTargets = config.printTargets || null


    group.traverse((child) => {
      if (!child.isMesh) return

      const name =
        baseName(child.name)


      const isPrintTarget =
        printTargets
          ? printTargets.includes(name)
          : isPrintPartName(name) && !isLooseSheetName(name)

      if (isPrintTarget) {
        child.visible = true
        child.material = printMaterial
        child.material.needsUpdate = true
        return
      }


      if (config.hasPaper && isLooseSheetName(name)) {
        child.visible = true
        child.material = paperPrintMaterial
        child.material.needsUpdate = true
      }
    })


    return () => {
      printMaterial.dispose()
      paperPrintMaterial.dispose()

      if (paperTexture) {
        paperTexture.dispose()
      }
    }

  }, [
    group,
    texture,
    config,
    mugShine,
  ])


  return (
    <primitive
      ref={groupRef}
      object={group}
    />
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
  art,
  background,
  mugColors,
  mugShine,
  modelId,
  registerApi,
  spinTargetRef,
  videoSpeed,
  videoEffect,
  videoQuality,
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

      <Environment
        preset="studio"
      />

      <group
        ref={spinTargetRef}
      >

        <Mug
          art={art}
          mugColors={mugColors}
          mugShine={mugShine}
          modelId={modelId}
          onFrame={setFrame}
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

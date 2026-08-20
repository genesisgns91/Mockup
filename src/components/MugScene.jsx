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


const MODEL_URLS = {
  single:
    `${import.meta.env.BASE_URL}model.obj`,

  duo:
    `${import.meta.env.BASE_URL}model-duo.obj`,

  trio:
    `${import.meta.env.BASE_URL}model-trio.obj`,

  trioPaper:
    `${import.meta.env.BASE_URL}model-trio-paper.obj`,
}


function baseName(name) {
  return name.replace(/\.\d+$/, '')
}


/*
  0 = fosco
  1 = brilho máximo
*/
function getMugMaterialParams(mugShine) {
  const shine = Math.max(
    0,
    Math.min(
      1,
      Number(mugShine) || 0
    )
  )

  return {
    metalness: 0,

    roughness:
      0.72 - shine * 0.50,

    clearcoat:
      shine,

    clearcoatRoughness:
      0.65 - shine * 0.50,

    envMapIntensity:
      0.25 + shine * 0.75,
  }
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


function Mug({
  art,
  mugColors,
  mugShine,
  modelId,
  onFrame,
}) {
  const modelUrl =
    MODEL_URLS[modelId] ||
    MODEL_URLS.single

  const obj = useLoader(
    OBJLoader,
    modelUrl
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
    const mugMaterialParams =
      getMugMaterialParams(
        mugShine
      )


    const bodyMaterial =
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(
          mugColors.body
        ),
        ...mugMaterialParams,
      })


    const insideMaterial =
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(
          mugColors.inside
        ),
        ...mugMaterialParams,
      })


    const handleMaterial =
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(
          mugColors.handle
        ),
        ...mugMaterialParams,
      })


    const paperMaterial =
      new THREE.MeshStandardMaterial(
        getPaperMaterialParams()
      )


    let printRadiusUnits = null
    let printHeightUnits = null


    group.traverse((child) => {
      if (!child.isMesh) return

      const name =
        baseName(child.name)


      if (name === 'pivot') {
        child.visible = false
        return
      }


      child.castShadow = true
      child.receiveShadow = true


      if (name === 'inside') {
        child.material =
          insideMaterial

        return
      }


      if (name === 'handle') {
        child.material =
          handleMaterial

        return
      }


      if (name === 'decal') {
        child.visible = false
        return
      }


      /*
        MODELOS SEM FOLHA
      */
      if (
        modelId !== 'trioPaper' &&
        name !== 'print' &&
        name.startsWith('print')
      ) {
        child.visible = false
        return
      }


      /*
        FOLHAS DO MODELO trioPaper
      */
      if (
        modelId === 'trioPaper' &&
        name !== 'print' &&
        name.startsWith('print')
      ) {
        child.visible = true

        child.material =
          paperMaterial

        return
      }


      /*
        ÁREA DE IMPRESSÃO DAS CANECAS
      */
      if (name === 'print') {

        if (
          printRadiusUnits === null
        ) {
          const pos =
            child.geometry.attributes.position

          let minY = Infinity
          let maxY = -Infinity

          let sumX = 0
          let sumZ = 0


          for (
            let i = 0;
            i < pos.count;
            i++
          ) {
            const y =
              pos.getY(i)

            if (y < minY) {
              minY = y
            }

            if (y > maxY) {
              maxY = y
            }

            sumX += pos.getX(i)
            sumZ += pos.getZ(i)
          }


          const centerX =
            sumX / pos.count

          const centerZ =
            sumZ / pos.count


          let rSum = 0


          for (
            let i = 0;
            i < pos.count;
            i++
          ) {
            const x =
              pos.getX(i) -
              centerX

            const z =
              pos.getZ(i) -
              centerZ

            rSum += Math.hypot(
              x,
              z
            )
          }


          printRadiusUnits =
            rSum / pos.count

          printHeightUnits =
            maxY - minY
        }

        return
      }


      child.material =
        bodyMaterial
    })


    if (
      printRadiusUnits !== null
    ) {
      setMeasurements({
        radiusUnits:
          printRadiusUnits,

        heightUnits:
          printHeightUnits,
      })
    }


    return () => {
      bodyMaterial.dispose()
      insideMaterial.dispose()
      handleMaterial.dispose()
      paperMaterial.dispose()
    }

  }, [
    group,
    modelId,
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
    mugRadiusUnits:
      measurements?.radiusUnits,
    mugHeightUnits:
      measurements?.heightUnits,
    mugRealHeightMM:
      art.mugRealHeightMM,
    baseColor:
      mugColors.body,
  })


  useEffect(() => {
    art.onWarning?.(warning)
  }, [warning, art])


  useEffect(() => {
    if (!texture) return

    const mugMaterialParams =
      getMugMaterialParams(
        mugShine
      )


    /*
      ARTE DAS CANECAS
    */
    const mugPrintMaterial =
      new THREE.MeshPhysicalMaterial({
        map: texture,

        color:
          new THREE.Color(
            0xffffff
          ),

        ...mugMaterialParams,

        side: THREE.DoubleSide,
      })


    /*
      TEXTURA DA FOLHA

      Cópia independente,
      mantendo as cores originais.
    */
    const paperTexture =
      createPaperTexture(
        texture
      )


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

        color:
          new THREE.Color(
            0xffffff
          ),

        side: THREE.DoubleSide,
      })


    group.traverse((child) => {
      if (!child.isMesh) return

      const name =
        baseName(child.name)


      /*
        ARTE NAS CANECAS
      */
      if (name === 'print') {
        child.visible = true

        child.material =
          mugPrintMaterial

        child.material.needsUpdate =
          true

        return
      }


      /*
        ARTE NAS FOLHAS
      */
      if (
        modelId === 'trioPaper' &&
        name !== 'print' &&
        name.startsWith('print')
      ) {
        child.visible = true

        child.material =
          paperPrintMaterial

        child.material.needsUpdate =
          true
      }
    })


    return () => {
      mugPrintMaterial.dispose()
      paperPrintMaterial.dispose()

      if (paperTexture) {
        paperTexture.dispose()
      }
    }

  }, [
    group,
    texture,
    modelId,
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

  }, [
    frame,
    camera,
    size,
    controls,
  ])


  return null
}


function CaptureRig({
  registerApi,
  spinTargetRef,
}) {
  const {
    gl,
    scene,
    camera,
    size,
  } = useThree()

  const recordingRef =
    useRef(false)


  useFrame((_, delta) => {
    if (
      recordingRef.current &&
      spinTargetRef.current
    ) {
      spinTargetRef.current.rotation.y +=
        (
          delta *
          Math.PI *
          2
        ) /
        ROTATE_SECONDS
    }
  })


  useEffect(() => {
    registerApi({

      /*
        ======================================================
        SCREENSHOT

        options.multiplier      -> fator de super-resolução
        options.transparent     -> remove o fundo (PNG com alfa)
        options.format          -> { width, height } para
                                    recorte em formato social.
                                    null = tamanho livre
        options.backgroundOptions
                                 -> { image, naturalWidth,
                                    naturalHeight, fit, zoom,
                                    offsetXFrac, offsetYFrac }
                                    para compor a imagem de
                                    fundo por baixo da caneca.
                                    Ignorado quando transparent
                                    é true.
        options.cropOffsetXFrac,
        options.cropOffsetYFrac -> deslocam o centro do
                                    recorte do formato (0.5 =
                                    centralizado), definidos
                                    ao arrastar o guia de
                                    corte no viewport.
        ======================================================
      */
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
          gl.setClearColor(0x000000, 0)
        }

        gl.render(
          scene,
          camera
        )

        const sourceCanvas =
          gl.domElement

        const sw = sourceCanvas.width
        const sh = sourceCanvas.height

        const outputWidth =
          format ? format.width : sw

        const outputHeight =
          format ? format.height : sh

        const targetAspect =
          outputWidth / outputHeight

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

        output.width = outputWidth
        output.height = outputHeight

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
            cropX, cropY, cropW, cropH,
            0, 0, outputWidth, outputHeight
          )
        }

        octx.drawImage(
          sourceCanvas,
          cropX, cropY, cropW, cropH,
          0, 0, outputWidth, outputHeight
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


      /*
        ======================================================
        GRAVAÇÃO DE VÍDEO 360°

        Mesmas opções de format/backgroundOptions/cropOffset
        do screenshot. A composição (fundo + caneca
        transparente + recorte) acontece quadro a quadro em
        um canvas 2D auxiliar, sem afetar a visualização ao
        vivo do usuário.
        ======================================================
      */
      startRecording: (
        onDone,
        options = {}
      ) => {
        const {
          format = null,
          backgroundOptions = null,
          cropOffsetXFrac = 0.5,
          cropOffsetYFrac = 0.5,
        } = options

        const canvas =
          gl.domElement

        const needsComposite =
          !!format ||
          !!backgroundOptions

        const outputWidth =
          format
            ? format.width
            : canvas.width

        const outputHeight =
          format
            ? format.height
            : canvas.height

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
          gl.setClearColor(0x000000, 0)
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


        if (!streamSource.captureStream) {
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


        const recorder =
          new MediaRecorder(
            stream,
            mimeType
              ? {
                  mimeType,
                  videoBitsPerSecond:
                    10_000_000,
                }
              : undefined
          )


        const chunks = []


        recorder.ondataavailable = (e) => {
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
          recordingRef.current = false

          stopCompositeLoop()
          restoreBackground()

          if (
            spinTargetRef.current
          ) {
            spinTargetRef.current.rotation.y = 0
          }

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


        recordingRef.current = true


        if (
          spinTargetRef.current
        ) {
          spinTargetRef.current.rotation.y = 0
        }


        if (needsComposite) {
          const targetAspect =
            outputWidth / outputHeight

          const drawFrame = () => {
            const sw = canvas.width
            const sh = canvas.height

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

                  bgLayerCanvas.width = sw
                  bgLayerCanvas.height = sh

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
                  cropX, cropY, cropW, cropH,
                  0, 0, outputWidth, outputHeight
                )
              } else {
                compositeCtx.clearRect(
                  0, 0, outputWidth, outputHeight
                )
              }

              compositeCtx.drawImage(
                canvas,
                cropX, cropY, cropW, cropH,
                0, 0, outputWidth, outputHeight
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
          ROTATE_SECONDS * 1000
        )
      },

    })

  }, [
    registerApi,
    gl,
    scene,
    camera,
    size,
    spinTargetRef,
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
}) {
  const [frame, setFrame] =
    useState(null)


  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        position: [
          2.7,
          1.8,
          3.0,
        ],
        fov: 30,
      }}
      gl={{
        toneMapping:
          THREE.ACESFilmicToneMapping,

        toneMappingExposure: 1.1,

        preserveDrawingBuffer: true,

        alpha: true,

        premultipliedAlpha: false,
      }}
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
      />

    </Canvas>
  )
}

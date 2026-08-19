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
  useTexture,
} from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import * as THREE from 'three'
import { useDecalTexture } from '../hooks/useDecalTexture.js'


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
  }, [
    background.type,
    background.color,
    scene,
  ])

  if (
    background.type === 'image' &&
    background.image
  ) {
    return (
      <BackgroundImage
        url={background.image}
      />
    )
  }

  return null
}


function BackgroundImage({ url }) {
  const { scene } = useThree()
  const texture = useTexture(url)

  useEffect(() => {
    texture.colorSpace =
      THREE.SRGBColorSpace

    scene.background = texture

    return () => {
      scene.background = null
    }
  }, [texture, scene])

  return null
}


const TARGET_HEIGHT = 1.7


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


const ROTATE_SECONDS = 6


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

      controls.maxDistance =
        distance * 2.5

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

      screenshot: (
        multiplier = 3
      ) => {
        const prevRatio =
          gl.getPixelRatio()

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

        gl.render(
          scene,
          camera
        )

        const dataUrl =
          gl.domElement.toDataURL(
            'image/png',
            1.0
          )

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


      startRecording: (onDone) => {
        const canvas =
          gl.domElement

        const stream =
          canvas.captureStream(30)

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


        recorder.onstop = () => {
          recordingRef.current = false

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
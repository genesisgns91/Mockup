import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getImageLayout, computeCoverCrop } from '../../utils/exportLayout.js'
import { ROTATE_SECONDS } from './constants.js'


export function CaptureRig({
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
          imageType = 'png',
          imageQuality = 0.92,
          scale = 1,
        } = options

        const mimeType =
          imageType === 'jpeg'
            ? 'image/jpeg'
            : imageType === 'webp'
              ? 'image/webp'
              : 'image/png'

        /*
          Maior lado permitido na saída: respeita o limite de textura
          da GPU (celulares costumam ter 4096) e nunca passa de 8192.
        */
        const maxDim = Math.min(
          gl.capabilities.maxTextureSize || 4096,
          8192
        )

        const outScale = format
          ? Math.min(
              scale,
              maxDim / Math.max(format.width, format.height)
            )
          : 1

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

        /*
          Sem formato (quadro livre) o tamanho segue a tela:
          1× = 3× de densidade, até 4× nas resoluções maiores.
          Com formato, a saída é formato × escala e a cena é
          renderizada grande o bastante para não "esticar" pixels.
        */
        const baseRatio = Math.min(
          4,
          prevRatio * (format ? multiplier : multiplier - 1 + scale)
        )

        const neededRatio = format
          ? Math.max(
              (format.width * outScale) / size.width,
              (format.height * outScale) / size.height
            )
          : 0

        const maxRatio = maxDim / Math.max(size.width, size.height)

        const targetRatio = Math.max(
          1,
          Math.min(maxRatio, Math.max(baseRatio, neededRatio))
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
            ? Math.round(format.width * outScale)
            : sw

        const outputHeight =
          format
            ? Math.round(format.height * outScale)
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

        if (mimeType === 'image/jpeg') {
          octx.fillStyle = '#ffffff'
          octx.fillRect(0, 0, outputWidth, outputHeight)
        }

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

          if (backgroundOptions.color) {
            bctx.fillStyle = backgroundOptions.color
            bctx.fillRect(0, 0, bctx.canvas.width, bctx.canvas.height)
          }

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
            mimeType,
            imageType === 'png' ? 1.0 : imageQuality
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
          
                    if (backgroundOptions.color) {
            bctx.fillStyle = backgroundOptions.color
            bctx.fillRect(0, 0, bctx.canvas.width, bctx.canvas.height)
          }

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

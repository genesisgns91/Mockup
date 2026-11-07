import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { StudioEnvironment, SceneBackground } from './scene/Environment.jsx'
import { Mug } from './scene/Mug.jsx'
import { CameraRig } from './scene/CameraRig.jsx'
import { CaptureRig } from './scene/CaptureRig.jsx'
import { KeyboardOrbit } from './scene/KeyboardOrbit.jsx'
import { detectLowPower } from './scene/constants.js'


/*
  Fica montado só enquanto o modelo 3D está carregando: avisa a
  interface para mostrar o indicador de "Carregando modelo…".
*/
function LoadingSignal({ onChange }) {
  useEffect(() => {
    if (onChange) onChange(true)

    return () => {
      if (onChange) onChange(false)
    }
  }, [onChange])

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
  reframeKey,
  resetToken,
  onLoadingChange,
  onContextLost,
  onContextRestored,
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

  /*
    Desempenho: aparelhos modestos usam menos pixels e sombra menor.
    Se a taxa de quadros cair durante o uso, a densidade baixa sozinha.
  */
  const lowPower = useMemo(() => detectLowPower(), [])
  const maxDpr = lowPower ? 1.5 : 2
  const [dpr, setDpr] = useState(maxDpr)
  const shadowSize = lowPower ? 1024 : 2048

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
  dpr={dpr}
  onCreated={({ gl }) => {
    const el = gl.domElement

    el.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      if (onContextLost) onContextLost()
    })

    el.addEventListener('webglcontextrestored', () => {
      if (onContextRestored) onContextRestored()
    })
  }}
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

      <PerformanceMonitor
        flipflops={2}
        onDecline={() => setDpr((d) => Math.max(1, d - 0.5))}
        onFallback={() => setDpr(1)}
      />

      <KeyboardOrbit />

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
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
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

        <Suspense fallback={<LoadingSignal onChange={onLoadingChange} />}>
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
        </Suspense>

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
        reframeKey={reframeKey}
        resetToken={resetToken}
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
